const fs    = require('fs');
const path  = require('path');
const https = require('https');

// Some blog hosts use self-signed or locally-issued certs that Node rejects.
const relaxedAgent = new https.Agent({ rejectUnauthorized: false });

const BROWSER_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control':   'no-cache',
};

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchUrl(url, extraHeaders = {}) {
    const fetch = (await import('node-fetch')).default;

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(url, {
            signal:  controller.signal,
            agent:   url.startsWith('https') ? relaxedAgent : undefined,
            headers: { ...BROWSER_HEADERS, ...extraHeaders },
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

// ─── HTML → clean Markdown ────────────────────────────────────────────────────
// Pipeline:
//   1. jsdom              — parse HTML into a DOM
//   2. @mozilla/readability — extract article body (strips nav/footer/ads)
//   3. turndown + GFM     — convert to Markdown, preserving tables

async function htmlToMarkdown(html, url) {
    const { JSDOM }        = require('jsdom');
    const { Readability }  = require('@mozilla/readability');
    const TurndownService  = require('turndown');
    const { gfm, tables }  = require('turndown-plugin-gfm');

    const dom      = new JSDOM(html, { url });
    const document = dom.window.document;

    const reader  = new Readability(document, { keepClasses: false });
    const article = reader.parse();

    if (!article?.content || article.content.length < 100) {
        throw new Error('Readability could not extract content — page may require JavaScript or a login.');
    }

    const td = new TurndownService({
        headingStyle:     'atx',
        bulletListMarker: '-',
        codeBlockStyle:   'fenced',
    });
    td.use(gfm);
    td.use(tables);
    td.remove(['script', 'style', 'noscript', 'iframe']);

    return td.turndown(article.content).replace(/\n{3,}/g, '\n\n').trim();
}

// ─── RSS fallback ─────────────────────────────────────────────────────────────
// Ghost and most blog platforms expose full article HTML in their RSS feed.
// Cloudflare typically does not block RSS endpoints.

async function fetchFromRSS(articleUrl) {
    const { origin, pathname } = new URL(articleUrl);

    // Common RSS/Atom feed paths to try
    const candidates = ['/rss/', '/rss.xml', '/feed/', '/feed.xml', '/atom.xml', '/blog/rss/'];

    for (const feedPath of candidates) {
        const feedUrl = origin + feedPath;
        console.log(`[BlogScraper] Trying RSS: ${feedUrl}`);

        try {
            const response = await fetchUrl(feedUrl, { Accept: 'application/rss+xml, application/xml, text/xml' });
            if (!response.ok) continue;

            const xml = await response.text();

            // Support both RSS <item> and Atom <entry> formats
            const itemPattern  = /<item>([\s\S]*?)<\/item>/g;
            const entryPattern = /<entry>([\s\S]*?)<\/entry>/g;
            const items = [...xml.matchAll(itemPattern), ...xml.matchAll(entryPattern)].map(m => m[1]);

            for (const item of items) {
                // Match on link — try <link>, <link href="...">, or <guid>
                const linkPatterns = [
                    /<link>(.*?)<\/link>/,
                    /<link[^>]+href=["'](.*?)["']/,
                    /<guid[^>]*>(.*?)<\/guid>/,
                ];
                const itemUrl = linkPatterns.map(p => item.match(p)?.[1]).find(Boolean)?.trim();
                if (!itemUrl) continue;

                // Normalize both URLs for comparison (strip trailing slash)
                const normalize = u => u.replace(/\/$/, '').toLowerCase();
                if (normalize(itemUrl) !== normalize(articleUrl)) continue;

                console.log(`[BlogScraper] Found article in RSS feed`);

                // Extract HTML content — Ghost uses <content:encoded>, Atom uses <content>
                const contentPatterns = [
                    /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/,
                    /<content[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/content>/,
                    /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/,
                    /<content[^>]*>([\s\S]*?)<\/content>/,
                ];
                const html = contentPatterns.map(p => item.match(p)?.[1]).find(Boolean);
                if (!html) continue;

                return htmlToMarkdown(html, articleUrl);
            }

            console.log(`[BlogScraper] Article URL not found in ${feedUrl}`);
        } catch (err) {
            console.warn(`[BlogScraper] RSS attempt failed for ${feedUrl}: ${err.message}`);
        }
    }

    return null;
}

// ─── Main scrape function ─────────────────────────────────────────────────────
// 1. Try direct page fetch + Readability + Markdown
// 2. On 403/block, fall back to RSS feed

async function scrapeSingleArticle(url) {
    // Attempt 1 — direct fetch
    try {
        const response = await fetchUrl(url);
        if (response.ok) {
            const html = await response.text();
            return await htmlToMarkdown(html, url);
        }
        console.warn(`[BlogScraper] Direct fetch returned ${response.status} — trying RSS fallback`);
    } catch (err) {
        console.warn(`[BlogScraper] Direct fetch failed (${err.message}) — trying RSS fallback`);
    }

    // Attempt 2 — RSS feed
    const rssContent = await fetchFromRSS(url);
    if (rssContent) return rssContent;

    throw new Error(
        'Could not retrieve article via direct fetch or RSS. ' +
        'The site may require JavaScript (Cloudflare challenge). ' +
        'You can paste the article text manually using !add-blog-text.'
    );
}

// ─── Recursively find all .md files under a directory ─────────────────────────

function findMdFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...findMdFiles(fullPath));
        else if (entry.isFile() && entry.name.endsWith('.md')) results.push(fullPath);
    }
    return results;
}

// ─── Re-scrape all blog articles under knowledge-base/blogs/ ─────────────────

async function scrapeBlogArticles() {
    const blogsDir = path.join(__dirname, 'knowledge-base', 'blogs');
    const mdFiles  = findMdFiles(blogsDir);

    if (mdFiles.length === 0) {
        console.log('[BlogScraper] No .md files found under knowledge-base/blogs/');
        return;
    }

    for (const filepath of mdFiles) {
        const raw         = fs.readFileSync(filepath, 'utf8');
        const sourceMatch = raw.match(/^Source:\s*(https?:\/\/\S+)/m);
        if (!sourceMatch) {
            console.log(`[BlogScraper] No Source URL in ${filepath} — skipping.`);
            continue;
        }

        const url = sourceMatch[1];
        console.log(`[BlogScraper] Scraping ${url} …`);

        try {
            const markdown       = await scrapeSingleArticle(url);
            const separatorIdx   = raw.indexOf('\n---\n');
            const header         = separatorIdx !== -1 ? raw.slice(0, separatorIdx) : raw.split('\n')[0];
            fs.writeFileSync(filepath, `${header}\n\n---\n\n${markdown}`, 'utf8');
            console.log(`[BlogScraper] ✅ Updated ${path.relative(__dirname, filepath)} (${markdown.length} chars)`);
        } catch (err) {
            console.error(`[BlogScraper] ❌ Failed for ${url}: ${err.message}`);
        }
    }

    console.log('[BlogScraper] Done.');
}

module.exports = { htmlToMarkdown, scrapeSingleArticle, scrapeBlogArticles };

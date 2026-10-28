'use strict';

/* ─── About this file ─────────────────────────────────────────────────────────
 * Turns a web page into clean Markdown for the knowledge base: direct fetch, then
 * jsdom → Readability → Turndown. Falls back to the site's RSS feed when the page is
 * blocked (e.g. by Cloudflare). Also reads a post's publish/modified dates, which
 * syncBlog uses to tell a real edit from a site redeploy.
 * Exports: htmlToMarkdown, scrapeSingleArticle, fetchPublishMeta
 * ────────────────────────────────────────────────────────────────────────── */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

// ─── Settings ────────────────────────────────────────────────────────────────

// Project root (currently unused in this file).
const ROOT_DIR = path.join(__dirname, '..');

// Some blog hosts use self-signed or locally-issued certs that Node rejects.
const relaxedAgent = new https.Agent({ rejectUnauthorized: false });

// Headers that make requests look like a normal desktop browser — some blog hosts refuse bare clients.
const BROWSER_HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control':   'no-cache',
};

// ─── Fetch helper ─────────────────────────────────────────────────────────────

// Fetches a URL with browser-like headers and a 15-second timeout, so a hanging site cannot stall a sync.
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

// Extracts the article body from raw HTML and converts it to Markdown (tables kept).
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

// Looks for the article in the site's RSS/Atom feeds and converts its HTML; returns null if not found.
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

// ─── Publish/modified metadata ─────────────────────────────────────────────────
// Ghost (and most CMSes) stamp each post page with article:published_time /
// article:modified_time meta tags — the editorial dates, set once and only touched
// by an actual content edit. A sitemap's <lastmod> is not the same thing: it can
// move on a site-wide redeploy or domain migration with zero content change, so it
// is not safe on its own to gate BLOG_SINCE_DATE or "did this post change" decisions.
// Only available via the direct-fetch path — the RSS fallback only carries the
// article body, not the page <head>, so both fields come back null there.

// Reads article:published_time, article:modified_time and the title from a page's <head>.
function extractPublishMeta(html) {
    // First capture group of `re` in the page, or null.
    const pick = (re) => (html.match(re) || [])[1] || null;
    return {
        publishedTime: pick(/property=["']article:published_time["']\s+content=["'](.*?)["']/),
        modifiedTime:  pick(/property=["']article:modified_time["']\s+content=["'](.*?)["']/),
        title:         pick(/property=["']og:title["']\s+content=["'](.*?)["']/) || pick(/<title>(.*?)<\/title>/),
    };
}

// Fetches a page and returns its publish metadata; all three fields are null on any failure.
async function fetchPublishMeta(url) {
    try {
        const response = await fetchUrl(url);
        if (!response.ok) return { publishedTime: null, modifiedTime: null, title: null };
        return extractPublishMeta(await response.text());
    } catch {
        return { publishedTime: null, modifiedTime: null, title: null };
    }
}

// ─── Main scrape function ─────────────────────────────────────────────────────
// 1. Try direct page fetch + Readability + Markdown
// 2. On 403/block, fall back to RSS feed

// Scrapes one article to Markdown (direct fetch, then RSS). Throws if both fail.
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

module.exports = { htmlToMarkdown, scrapeSingleArticle, fetchPublishMeta };

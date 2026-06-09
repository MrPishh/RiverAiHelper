'use strict';

const fs   = require('fs');
const path = require('path');
const { scrapeSingleArticle } = require('./blog-scraper');
const { ensureDir } = require('./utils');

// ─── Usage tracking ───────────────────────────────────────────────────────────

const ROOT_DIR           = path.join(__dirname, '..');
const USAGE_PATH         = path.join(ROOT_DIR, 'usage-stats.json');
const PRICE_INPUT        = 3.00;   // per 1M tokens, claude-sonnet-4-6
const PRICE_OUTPUT       = 15.00;
const PRICE_HAIKU_INPUT  = 0.80;   // per 1M tokens, claude-haiku-4-5
const PRICE_HAIKU_OUTPUT = 4.00;

function emptyBucket() {
    return { calls: 0, inputTokens: 0, outputTokens: 0 };
}

function loadUsageStats() {
    const blank = { since: new Date().toISOString(), sonnet: emptyBucket(), haiku: emptyBucket(), monthly: {} };
    if (!fs.existsSync(USAGE_PATH)) return blank;
    try {
        const s = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8'));
        // Migrate old flat format (pre Haiku tracking)
        if (s.calls !== undefined) {
            return {
                since:   s.since,
                sonnet:  { calls: s.calls, inputTokens: s.inputTokens, outputTokens: s.outputTokens },
                haiku:   emptyBucket(),
                monthly: {},
            };
        }
        s.monthly = s.monthly || {};
        return s;
    } catch { return blank; }
}

function trackUsage(inputTokens, outputTokens, model = 'sonnet') {
    const stats     = loadUsageStats();
    const monthKey  = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const bucket    = model === 'haiku' ? 'haiku' : 'sonnet';

    stats[bucket].calls        += 1;
    stats[bucket].inputTokens  += inputTokens;
    stats[bucket].outputTokens += outputTokens;

    if (!stats.monthly[monthKey]) stats.monthly[monthKey] = { sonnet: emptyBucket(), haiku: emptyBucket() };
    stats.monthly[monthKey][bucket].calls        += 1;
    stats.monthly[monthKey][bucket].inputTokens  += inputTokens;
    stats.monthly[monthKey][bucket].outputTokens += outputTokens;

    fs.writeFileSync(USAGE_PATH, JSON.stringify(stats, null, 2), 'utf8');
}

// ─── Docs sync ────────────────────────────────────────────────────────────────

const DOCS_SITEMAP_URL = 'https://docs.river.inc/sitemap-pages.xml';

async function syncDocs(forceAll = false) {
    const docsDir   = path.join(ROOT_DIR, 'knowledge-base', 'docs');
    const indexPath = path.join(docsDir, '_index.json');
    ensureDir(docsDir);

    let index = { sitemapUrl: DOCS_SITEMAP_URL, lastChecked: null, pages: [] };
    if (fs.existsSync(indexPath)) {
        try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
    }

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const fetch = (await import('node-fetch')).default;

    const r = await fetch(DOCS_SITEMAP_URL, { agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error(`Sitemap fetch failed: HTTP ${r.status}`);
    const xml      = await r.text();
    const liveUrls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);

    const indexedMap = new Map(index.pages.map(p => [p.url, p]));
    const liveUrlSet = new Set(liveUrls);

    let added = 0, updated = 0, removed = 0, failed = 0;
    const processedFiles = [];

    for (const page of index.pages) {
        if (!liveUrlSet.has(page.url)) {
            const fp = path.join(docsDir, page.file);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
            removed++;
        }
    }
    index.pages = index.pages.filter(p => liveUrlSet.has(p.url));

    const urlsToScrape = liveUrls.filter(u => {
        if (!indexedMap.has(u)) return true;
        if (!forceAll) return false;
        const entry = indexedMap.get(u);
        const fp    = path.join(docsDir, entry.file);
        if (fs.existsSync(fp) && fs.readFileSync(fp, 'utf8').includes('<!-- EXCLUDE -->')) {
            console.log(`[SyncDocs] Skipping curated file (has EXCLUDE markers): ${entry.file}`);
            return false;
        }
        return true;
    });

    for (const url of urlsToScrape) {
        const slug  = new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';
        const file  = `${slug}.md`;
        const fp    = path.join(docsDir, file);
        const isNew = !indexedMap.has(url);

        try {
            const pageText = await scrapeSingleArticle(url);
            fs.writeFileSync(fp, `# Doc: ${slug}\nSource: ${url}\nScraped: ${new Date().toISOString()}\n\n---\n\n${pageText}`, 'utf8');
            processedFiles.push({ filePath: fp, content: pageText });
            if (isNew) {
                index.pages.push({ url, slug, file, lastScraped: new Date().toISOString() });
                added++;
            } else {
                const entry = index.pages.find(p => p.url === url);
                if (entry) entry.lastScraped = new Date().toISOString();
                updated++;
            }
            console.log(`[SyncDocs] ${isNew ? 'Added' : 'Updated'}: ${slug}`);
        } catch (err) {
            console.error(`[SyncDocs] Failed ${url}: ${err.message}`);
            failed++;
        }
    }

    index.lastChecked = new Date().toISOString();
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
    return { added, updated, removed, failed, total: index.pages.length, processedFiles };
}

function registerDocInIndex(url, slug, file) {
    const indexPath = path.join(ROOT_DIR, 'knowledge-base', 'docs', '_index.json');
    let index = { sitemapUrl: DOCS_SITEMAP_URL, lastChecked: null, pages: [] };
    if (fs.existsSync(indexPath)) {
        try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
    }
    const existing = index.pages.find(p => p.url === url);
    if (existing) {
        existing.lastScraped = new Date().toISOString();
    } else {
        index.pages.push({ url, slug, file, lastScraped: new Date().toISOString() });
    }
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

// ─── Blog sync ────────────────────────────────────────────────────────────────

const BLOG_SITEMAP_URL = 'https://blog.river.inc/sitemap-posts.xml';
const BLOG_SINCE_DATE  = new Date('2025-05-15');

async function syncBlog() {
    const blogsDir  = path.join(ROOT_DIR, 'knowledge-base', 'blogs');
    const indexPath = path.join(blogsDir, '_index.json');
    ensureDir(blogsDir);

    let index = {
        sitemapUrl:          BLOG_SITEMAP_URL,
        configuredSinceDate: BLOG_SINCE_DATE.toISOString().slice(0, 10),
        effectiveSinceDate:  BLOG_SINCE_DATE.toISOString().slice(0, 10),
        lastChecked:         null,
        pages:               [],
        excluded:            [],
    };
    if (fs.existsSync(indexPath)) {
        try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
    }
    if (!index.excluded)            index.excluded = [];
    if (!index.configuredSinceDate) index.configuredSinceDate = BLOG_SINCE_DATE.toISOString().slice(0, 10);

    const deletedFromDisk = index.pages.filter(p => !fs.existsSync(path.join(blogsDir, p.file)));
    if (deletedFromDisk.length > 0) {
        console.log(`[SyncBlog] ${deletedFromDisk.length} file(s) deleted from disk — removing from index`);
        index.pages = index.pages.filter(p => fs.existsSync(path.join(blogsDir, p.file)));
    }

    if (!index.sinceHistory) index.sinceHistory = [];
    const storedEffective = index.effectiveSinceDate
        ? new Date(index.effectiveSinceDate)
        : new Date(index.configuredSinceDate);

    let effectiveSince = storedEffective;
    if (deletedFromDisk.length > 0) {
        const remainingDates = index.pages
            .map(p => p.lastmod ? new Date(p.lastmod) : null)
            .filter(Boolean)
            .sort((a, b) => a - b);
        const newEffective = remainingDates.length > 0
            ? remainingDates[0]
            : new Date(index.configuredSinceDate);
        if (newEffective > storedEffective) {
            index.sinceHistory.push({
                changedAt: new Date().toISOString(),
                from: storedEffective.toISOString().slice(0, 10),
                to:   newEffective.toISOString().slice(0, 10),
            });
            effectiveSince = newEffective;
        }
    }

    const https = require('https');
    const agent = new https.Agent({ rejectUnauthorized: false });
    const fetch = (await import('node-fetch')).default;

    const r = await fetch(BLOG_SITEMAP_URL, { agent, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error(`Sitemap fetch failed: HTTP ${r.status}`);
    const xml = await r.text();

    const liveEntries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => {
        const block   = m[1];
        const url     = block.match(/<loc>(.*?)<\/loc>/)?.[1] ?? '';
        const lastmod = block.match(/<lastmod>(.*?)<\/lastmod>/)?.[1] ?? '';
        return { url, lastmod };
    }).filter(e => e.url);

    const indexedMap = new Map(index.pages.map(p => [p.url, p]));
    const liveUrlSet = new Set(liveEntries.map(e => e.url));

    let added = 0, updated = 0, removed = 0, skipped = 0, failed = 0;
    const processedFiles = [];

    for (const page of index.pages) {
        if (!liveUrlSet.has(page.url)) {
            const fp = path.join(blogsDir, page.file);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
            removed++;
        }
    }
    index.pages = index.pages.filter(p => liveUrlSet.has(p.url));

    for (const { url, lastmod } of liveEntries) {
        if (index.excluded.includes(url)) { skipped++; continue; }
        if (lastmod && new Date(lastmod) < effectiveSince) { skipped++; continue; }

        const existing = indexedMap.get(url);
        const isNew    = !existing;
        const changed  = existing && lastmod && existing.lastmod !== lastmod;
        if (!isNew && !changed) { skipped++; continue; }

        const slug = new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';
        const file = `${slug}.md`;
        const fp   = path.join(blogsDir, file);

        try {
            const pageText = await scrapeSingleArticle(url);
            fs.writeFileSync(fp, `# Blog: ${slug}\nSource: ${url}\nScraped: ${new Date().toISOString()}\n\n---\n\n${pageText}`, 'utf8');
            processedFiles.push({ filePath: fp, content: pageText });
            if (isNew) {
                index.pages.push({ url, slug, file, lastmod, lastScraped: new Date().toISOString() });
                added++;
            } else {
                existing.lastmod     = lastmod;
                existing.lastScraped = new Date().toISOString();
                updated++;
            }
            console.log(`[SyncBlog] ${isNew ? 'Added' : 'Updated'}: ${slug}`);
        } catch (err) {
            console.error(`[SyncBlog] Failed ${url}: ${err.message}`);
            failed++;
        }
    }

    index.effectiveSinceDate = effectiveSince.toISOString().slice(0, 10);
    index.lastChecked        = new Date().toISOString();
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
    return {
        added, updated, removed, skipped, failed,
        total: index.pages.length,
        configuredSince: index.configuredSinceDate,
        effectiveSince:  index.effectiveSinceDate,
        deletedFromDisk: deletedFromDisk.length,
        sinceHistory:    index.sinceHistory,
        processedFiles,
    };
}

function registerBlogInIndex(url, slug, file) {
    const indexPath = path.join(ROOT_DIR, 'knowledge-base', 'blogs', '_index.json');
    let index = { sitemapUrl: BLOG_SITEMAP_URL, lastChecked: null, pages: [] };
    if (fs.existsSync(indexPath)) {
        try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
    }
    const existing = index.pages.find(p => p.url === url);
    if (existing) {
        existing.lastScraped = new Date().toISOString();
    } else {
        index.pages.push({ url, slug, file, lastmod: null, lastScraped: new Date().toISOString() });
    }
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

module.exports = {
    syncDocs, registerDocInIndex,
    syncBlog, registerBlogInIndex,
    loadUsageStats, trackUsage,
    PRICE_INPUT, PRICE_OUTPUT, PRICE_HAIKU_INPUT, PRICE_HAIKU_OUTPUT, USAGE_PATH,
    DOCS_SITEMAP_URL, BLOG_SITEMAP_URL,
};

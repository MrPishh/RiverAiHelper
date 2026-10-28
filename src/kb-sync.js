'use strict';

/* ─── QUICK REFERENCE ────────────────────────────────────────────────────────
 * Syncs docs and blog KB from sitemaps. Tracks Claude API usage stats.
 * Exports: syncDocs, syncBlog, registerDocInIndex, registerBlogInIndex,
 *          loadUsageStats, trackUsage, BLOG_SITEMAP_URL
 *
 * Function / Section                                           ~Line
 * ─────────────────────────────────────────────────────────────────
 * Usage stat price constants        PRICE_INPUT etc.              13
 * loadUsageStats()                  read data/usage-stats.json    21
 * trackUsage()                      update stats + console log    40
 * syncDocs()                        pull docs sitemap             62
 * registerDocInIndex()              write to docs/_index.json    138
 * syncBlog()                        pull blog sitemap + scrape   158
 * registerBlogInIndex()             write to blogs/_index.json   283
 * ─────────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const { scrapeSingleArticle, fetchPublishMeta } = require('./blog-scraper');
const { ensureDir } = require('./utils');

// ─── Usage tracking ───────────────────────────────────────────────────────────

const ROOT_DIR           = path.join(__dirname, '..');
const USAGE_PATH         = path.join(ROOT_DIR, 'data', 'usage-stats.json');
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

    ensureDir(path.dirname(USAGE_PATH));
    fs.writeFileSync(USAGE_PATH, JSON.stringify(stats, null, 2), 'utf8');
}

// ─── Docs sync ────────────────────────────────────────────────────────────────

const DOCS_SITEMAP_URL = 'https://docs.riverai.inc/sitemap-pages.xml';

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

    // Capture which files carry a manually-applied <!-- EXCLUDE --> marker BEFORE
    // any deletion/rewrite below — a domain change (old URL no longer in liveUrlSet)
    // deletes-and-recreates every page by filename, which would silently drop the marker.
    const excludedFiles = new Set();
    for (const page of index.pages) {
        const fp = path.join(docsDir, page.file);
        if (fs.existsSync(fp) && fs.readFileSync(fp, 'utf8').includes('<!-- EXCLUDE -->')) {
            excludedFiles.add(page.file);
        }
    }

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
            const body = excludedFiles.has(file) ? `<!-- EXCLUDE -->\n\n${pageText}` : pageText;
            fs.writeFileSync(fp, `# Doc: ${slug}\nSource: ${url}\nScraped: ${new Date().toISOString()}\n\n---\n\n${body}`, 'utf8');
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

const BLOG_SITEMAP_URL = 'https://blog.riverai.inc/sitemap-posts.xml';
const BLOG_SINCE_DATE  = new Date('2025-05-15');

async function syncBlog() {
    const blogsDir  = path.join(ROOT_DIR, 'knowledge-base', 'blogs');
    const indexPath = path.join(blogsDir, '_index.json');
    ensureDir(blogsDir);

    // Registry of posts permanently excluded by BLOG_SINCE_DATE, keyed by URL, so a
    // future lastmod bump (redeploy/migration) on a KNOWN legacy post can be recognized
    // by title instead of re-litigated from scratch. Self-maintaining: a URL is only
    // ever fetched once to seed its entry, then it's a free lookup on every later sync.
    const legacyRegistryPath = path.join(blogsDir, '_excluded-legacy.json');
    let legacyRegistry = { posts: {} };
    if (fs.existsSync(legacyRegistryPath)) {
        try { legacyRegistry = JSON.parse(fs.readFileSync(legacyRegistryPath, 'utf8')); } catch {}
    }
    if (!legacyRegistry.posts) legacyRegistry.posts = {};
    let legacyRegistryChanged = false;

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

    let added = 0, updated = 0, removed = 0, skipped = 0, failed = 0, filtered = 0;
    const processedFiles   = [];
    const flaggedForReview = [];

    // Capture which files carry a manually-applied <!-- EXCLUDE --> marker BEFORE
    // any deletion/rewrite below — a domain change (old URL no longer in liveUrlSet)
    // deletes-and-recreates every page by filename, which would silently drop the marker.
    const excludedFiles = new Set();
    for (const page of index.pages) {
        const fp = path.join(blogsDir, page.file);
        if (fs.existsSync(fp) && fs.readFileSync(fp, 'utf8').includes('<!-- EXCLUDE -->')) {
            excludedFiles.add(page.file);
        }
    }

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
        if (lastmod && new Date(lastmod) < effectiveSince) {
            skipped++;
            // Seed the legacy registry the first (and only the first) time we see this
            // URL, so a future lastmod bump on it can be recognized by title rather than
            // treated as an unknown. Cheap in steady state — only fires for URLs never
            // recorded before.
            if (!legacyRegistry.posts[url]) {
                const meta = await fetchPublishMeta(url);
                const slug = new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';
                legacyRegistry.posts[url] = {
                    slug, title: meta.title,
                    publishedTime: meta.publishedTime || lastmod,
                    firstSeen: new Date().toISOString(),
                };
                legacyRegistryChanged = true;
            }
            continue;
        }

        const existing = indexedMap.get(url);
        const isNew    = !existing;
        const changed  = existing && lastmod && existing.lastmod !== lastmod;
        if (!isNew && !changed) { skipped++; continue; }

        // Sitemap <lastmod> alone is not trustworthy here — it can move on a site-wide
        // redeploy/domain migration with zero editorial change (confirmed happening
        // during the 2026-09-04 river.inc -> riverai.inc migration). Cross-check against
        // the post's own article:published_time / article:modified_time (Ghost's
        // immutable content dates) before trusting a lastmod-driven add or rescrape.
        // If the check is inconclusive (RSS-only fallback site, fetch failure), fall
        // back to the sitemap lastmod exactly as before — no regression either way.
        const meta = await fetchPublishMeta(url);

        if (isNew && meta.publishedTime && new Date(meta.publishedTime) < effectiveSince) {
            // Don't silently decide either way — this is exactly the ambiguous case:
            // could be a genuine redeploy artifact (correctly stays excluded), or a page
            // whose true publish date sits right at the floor but reads as live/current
            // content (the 2026-09-04 migration surfaced exactly this for blog.riverai.inc/river/,
            // published_time 2025-05-13, two days before the 2025-05-15 floor). Hold it
            // out of the KB but report it so a human can `/include-blog` it if it belongs.
            // If this exact URL is already in the legacy registry (a previously-seen,
            // deliberately-excluded post), surface its known title too — a title match
            // against what we recorded before is a strong "still the same old post" signal.
            const known = legacyRegistry.posts[url];
            console.log(`[SyncBlog] Flagged ${url} for review — sitemap lastmod (${lastmod}) passed the date floor, but true article:published_time (${meta.publishedTime}) is pre-BLOG_SINCE_DATE. Not auto-added. Title: "${meta.title}"${known ? ` | previously recorded as "${known.title}" (first seen ${known.firstSeen})` : ' | never seen before this sync'}`);
            flaggedForReview.push({
                url, title: meta.title, publishedTime: meta.publishedTime, lastmod,
                previouslyKnownAs: known?.title ?? null,
            });
            skipped++; filtered++;
            continue;
        }
        if (changed && meta.modifiedTime && existing.modifiedTime && meta.modifiedTime === existing.modifiedTime) {
            console.log(`[SyncBlog] ${url} — sitemap lastmod changed (${existing.lastmod} -> ${lastmod}) but article:modified_time is unchanged (${meta.modifiedTime}). Redeploy artifact, not a real edit — skipping rescrape.`);
            existing.lastmod = lastmod;
            skipped++; filtered++;
            continue;
        }

        const slug = new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';
        const file = `${slug}.md`;
        const fp   = path.join(blogsDir, file);

        try {
            const pageText = await scrapeSingleArticle(url);
            const body = excludedFiles.has(file) ? `<!-- EXCLUDE -->\n\n${pageText}` : pageText;
            fs.writeFileSync(fp, `# Blog: ${slug}\nSource: ${url}\nScraped: ${new Date().toISOString()}\n\n---\n\n${body}`, 'utf8');
            processedFiles.push({ filePath: fp, content: pageText });
            if (isNew) {
                index.pages.push({ url, slug, file, lastmod, modifiedTime: meta.modifiedTime, lastScraped: new Date().toISOString() });
                added++;
            } else {
                existing.lastmod      = lastmod;
                existing.modifiedTime = meta.modifiedTime || existing.modifiedTime;
                existing.lastScraped  = new Date().toISOString();
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
    if (legacyRegistryChanged) {
        fs.writeFileSync(legacyRegistryPath, JSON.stringify(legacyRegistry, null, 2), 'utf8');
        console.log(`[SyncBlog] Legacy registry now tracks ${Object.keys(legacyRegistry.posts).length} excluded-by-date post(s).`);
    }
    return {
        added, updated, removed, skipped, failed, filtered, flaggedForReview,
        total: index.pages.length,
        configuredSince: index.configuredSinceDate,
        effectiveSince:  index.effectiveSinceDate,
        deletedFromDisk: deletedFromDisk.length,
        sinceHistory:    index.sinceHistory,
        legacyRegistryCount: Object.keys(legacyRegistry.posts).length,
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

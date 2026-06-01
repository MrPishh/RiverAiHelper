'use strict';

const fs   = require('fs');
const path = require('path');

const CORRECTIONS_DIR   = path.join(__dirname, 'knowledge-base', 'corrections');
const ANNOUNCEMENTS_DIR = path.join(__dirname, 'knowledge-base', 'announcements');
const SCAN_STATE_PATH   = path.join(ANNOUNCEMENTS_DIR, '_scan-state.json');
const BLOGS_INDEX_PATH  = path.join(__dirname, 'knowledge-base', 'blogs', '_index.json');

const CURATED_MAP = {
    EXCHANGE:  'exchanges-and-token.md',
    MILESTONE: 'ecosystem-milestones.md',
    NOTICE:    'important-notices.md',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadScanState() {
    if (!fs.existsSync(SCAN_STATE_PATH)) {
        // First run — initialise to now so only future announcements are scanned.
        return { lastScanned: new Date().toISOString() };
    }
    try { return JSON.parse(fs.readFileSync(SCAN_STATE_PATH, 'utf8')); }
    catch { return { lastScanned: new Date().toISOString() }; }
}

function saveScanState(state) {
    fs.writeFileSync(SCAN_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function loadCorrectionFiles() {
    if (!fs.existsSync(CORRECTIONS_DIR)) return [];
    return fs.readdirSync(CORRECTIONS_DIR)
        .filter(f => f.endsWith('.md') && !f.startsWith('_'))
        .map(f => ({
            name:    f,
            content: fs.readFileSync(path.join(CORRECTIONS_DIR, f), 'utf8').slice(0, 600),
        }));
}

function loadIndexedBlogUrls() {
    if (!fs.existsSync(BLOGS_INDEX_PATH)) return new Set();
    try {
        const index = JSON.parse(fs.readFileSync(BLOGS_INDEX_PATH, 'utf8'));
        return new Set((index.pages || []).map(p => p.url));
    } catch { return new Set(); }
}

function getRawAnnouncementFiles() {
    if (!fs.existsSync(ANNOUNCEMENTS_DIR)) return [];
    const files = [];
    for (const folder of fs.readdirSync(ANNOUNCEMENTS_DIR)) {
        if (!/_ann$/.test(folder)) continue;
        const folderPath = path.join(ANNOUNCEMENTS_DIR, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;
        for (const file of fs.readdirSync(folderPath)) {
            if (/^week\d+\.md$/.test(file)) files.push(path.join(folderPath, file));
        }
    }
    return files;
}

function parseAnnouncementEntries(text) {
    // Format written by appendToMonthlyWeeklyFile: \n\n---\n*<ISO timestamp>*\n<content>
    const parts   = text.split(/\n\n---\n/).filter(Boolean);
    const entries = [];
    for (const part of parts) {
        const match = part.match(/^\*([^*]+)\*\n([\s\S]+)/);
        if (!match) continue;
        const ts = new Date(match[1].trim());
        if (isNaN(ts)) continue;
        entries.push({ ts, content: match[2].trim() });
    }
    return entries;
}

function stripIndexedBlogUrls(content, indexedUrls) {
    return content.replace(/https?:\/\/blog\.river\.inc\/[^\s)]+/g, url => {
        const clean = url.replace(/[.,!?)\]]+$/, '');
        return indexedUrls.has(clean) ? '[blog post already indexed]' : url;
    });
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createMonitorModule(anthropic) {

    // ── Correction staleness check ─────────────────────────────────────────────
    // Called after !sync-blog / !sync-docs with the list of newly written files.
    // Returns an array of { newFile, correctionFile } pairs that need review.

    async function checkCorrectionStaleness(processedFiles) {
        if (!processedFiles || processedFiles.length === 0) return [];
        const corrections = loadCorrectionFiles();
        if (corrections.length === 0) return [];

        const warnings = [];
        const correctionSummary = corrections
            .map(c => `[${c.name}]:\n${c.content}`)
            .join('\n\n---\n\n');

        // Corrections block is identical for every file in this sync run — cache it.
        const correctionSystem = [{ type: 'text', text: `These are the active correction files for River Protocol (manual overrides for known-wrong content):\n\n${correctionSummary}`, cache_control: { type: 'ephemeral' } }];

        for (const { filePath, content: newContent } of processedFiles) {
            const slug = path.basename(filePath, '.md');
            try {
                const resp = await anthropic.messages.create({
                    model:      'claude-haiku-4-5-20251001',
                    max_tokens: 80,
                    system:     correctionSystem,
                    messages: [{
                        role: 'user',
                        content:
                            `A new article was added to the River Protocol knowledge base:\n` +
                            `File: ${slug}\n` +
                            `Content (first 1500 chars):\n${newContent.slice(0, 1500)}\n\n` +
                            `Does this article contradict, update, or potentially supersede any correction? ` +
                            `Reply with the correction file names that need review, one per line. ` +
                            `If none need review, reply NONE.`,
                    }],
                });
                const text   = resp.content[0].text.trim();
                if (text === 'NONE' || !text) continue;
                const flagged = text.split('\n').map(l => l.trim()).filter(l => l && l !== 'NONE');
                for (const corrFile of flagged) {
                    warnings.push({ newFile: slug, correctionFile: corrFile });
                }
            } catch (err) {
                console.error(`[Monitor] Staleness check failed for ${slug}:`, err.message);
            }
        }

        return warnings;
    }

    // ── Announcement auto-scan ─────────────────────────────────────────────────
    // Called during !sync-knowledge. Reads raw weekly announcement files,
    // filters to entries newer than the last scan, strips already-indexed blog
    // URLs, then asks Haiku whether remaining content contains net-new facts.
    // If yes, appends a summary to the relevant curated file.

    async function scanAnnouncementsForNewFacts() {
        const state        = loadScanState();
        const since        = state.lastScanned ? new Date(state.lastScanned) : null;
        const indexedBlogs = loadIndexedBlogUrls();
        const rawFiles     = getRawAnnouncementFiles();

        const newEntries = [];
        for (const filePath of rawFiles) {
            const text    = fs.readFileSync(filePath, 'utf8');
            const entries = parseAnnouncementEntries(text);
            for (const entry of entries) {
                if (!since || entry.ts > since) newEntries.push(entry);
            }
        }

        saveScanState({ lastScanned: new Date().toISOString() });

        if (newEntries.length === 0) return { scanned: 0, found: [], appended: [] };

        const found    = [];
        const appended = [];

        for (const entry of newEntries) {
            const cleaned        = stripIndexedBlogUrls(entry.content, indexedBlogs);
            const nonBlogContent = cleaned.replace(/\[blog post already indexed\]/g, '').trim();
            if (!nonBlogContent) continue; // entire entry was just a blog repost

            try {
                const resp = await anthropic.messages.create({
                    model:      'claude-haiku-4-5-20251001',
                    max_tokens: 120,
                    messages: [{
                        role: 'user',
                        content:
                            `River Protocol Discord announcement:\n\n${cleaned.slice(0, 800)}\n\n` +
                            `Does this contain net-new operational facts NOT already covered by indexed blog posts or docs?\n` +
                            `Net-new facts include: exchange/DEX listings, token address changes, product launches, ` +
                            `protocol parameter changes, safety notices, integration announcements.\n\n` +
                            `If YES: reply "YES [CATEGORY]" on line 1, then a 2-3 sentence factual summary on line 2.\n` +
                            `Categories: EXCHANGE (listings/DEX/token), MILESTONE (audits/investments/stats/launches), NOTICE (safety/operational alerts)\n` +
                            `If NO new facts: reply "NO"`,
                    }],
                });

                const text  = resp.content[0].text.trim();
                if (text.startsWith('NO')) continue;

                const lines    = text.split('\n').filter(Boolean);
                const catMatch = lines[0].match(/YES\s+(EXCHANGE|MILESTONE|NOTICE)/i);
                const summary  = lines.slice(1).join(' ').trim();
                if (!catMatch || !summary) continue;

                const category   = catMatch[1].toUpperCase();
                const targetFile = CURATED_MAP[category];
                if (!targetFile) continue;

                const targetPath = path.join(ANNOUNCEMENTS_DIR, targetFile);
                const dateStr    = entry.ts.toISOString().slice(0, 10);
                fs.appendFileSync(
                    targetPath,
                    `\n\n---\n*Auto-extracted from announcement — ${dateStr}*\n\n${summary}`,
                    'utf8'
                );

                found.push({ ts: entry.ts, category, summary });
                appended.push(targetFile);
                console.log(`[Monitor] Auto-appended to ${targetFile}: ${summary.slice(0, 80)}`);
            } catch (err) {
                console.error('[Monitor] Announcement scan failed:', err.message);
            }
        }

        return { scanned: newEntries.length, found, appended: [...new Set(appended)] };
    }

    return { checkCorrectionStaleness, scanAnnouncementsForNewFacts };
}

module.exports = { createMonitorModule };

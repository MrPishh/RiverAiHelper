'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { embed } = require('./embedder');

const ROOT_DIR   = path.join(__dirname, '..');
const KB_DIR     = path.join(ROOT_DIR, 'knowledge-base');
const CL_DIR     = path.join(ROOT_DIR, 'channel-learning');
const CACHE_PATH = path.join(ROOT_DIR, 'knowledge-base', '.embeddings-cache.json');

const CHUNK_SIZE    = 1500; // characters per chunk
const CHUNK_OVERLAP = 150;  // overlap between chunks to avoid cutting context mid-sentence
const TOP_K         = 8;    // chunks returned per search
const EMBED_BATCH   = 64;   // texts per Voyage API call

// ─── Source priority boost ────────────────────────────────────────────────────
// Corrections always surface above conflicting docs/blogs when topically relevant.

const SOURCE_PRIORITY = [
    { prefix: 'knowledge-base/corrections',   boost: 1.3  },
    { prefix: 'knowledge-base/blogs',         boost: 1.1  },
    { prefix: 'knowledge-base/announcements', boost: 1.1  },
];

function sourceBoost(fileLabel) {
    for (const { prefix, boost } of SOURCE_PRIORITY) {
        if (fileLabel.startsWith(prefix)) return boost;
    }
    return 1.0; // docs and channel-learning get no boost
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        const chunk = text.slice(start, end).trim();
        if (chunk.length > 50) chunks.push(chunk);
        if (end === text.length) break;
        start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks;
}

function hashText(text) {
    return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ─── Cache I/O ────────────────────────────────────────────────────────────────

function loadCache() {
    if (!fs.existsSync(CACHE_PATH)) return { version: 1, chunks: [] };
    try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
    catch { return { version: 1, chunks: [] }; }
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf8');
}

// ─── File discovery ───────────────────────────────────────────────────────────

function collectMdFiles(dir, label) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            // Skip raw-capture monthly folders (announcements/*_ann, tweets/*_tweet)
            // These contain unprocessed Discord messages — curated files in the parent handle indexing.
            if (/_ann$/.test(entry.name) || /_tweet$/.test(entry.name)) continue;
            results.push(...collectMdFiles(fullPath, `${label}/${entry.name}`));
        } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
            results.push({ path: fullPath, label: `${label}/${entry.name}` });
        }
    }
    return results;
}

// ─── Build / update index ─────────────────────────────────────────────────────
// Only re-embeds chunks whose text has changed. Safe to call after every sync.

async function buildIndex() {
    const cache    = loadCache();
    const chunkMap = new Map(cache.chunks.map(c => [c.id, c]));

    const files = [
        ...collectMdFiles(KB_DIR, 'knowledge-base'),
        ...collectMdFiles(CL_DIR, 'channel-learning'),
    ];

    const liveIds  = new Set();
    const toEmbed  = [];

    for (const file of files) {
        let raw;
        try { raw = fs.readFileSync(file.path, 'utf8').trim(); } catch { continue; }
        if (!raw) continue;

        // Strip manually excluded sections before chunking
        raw = raw.replace(/<!--\s*EXCLUDE\s*-->[\s\S]*?<!--\s*\/EXCLUDE\s*-->/gi, '').trim();
        if (!raw) continue;

        const chunks = chunkText(raw);
        for (let i = 0; i < chunks.length; i++) {
            const id   = `${file.label}::${i}`;
            const hash = hashText(chunks[i]);
            liveIds.add(id);

            const existing = chunkMap.get(id);
            if (!existing || existing.hash !== hash) {
                toEmbed.push({ id, file: file.label, chunkIndex: i, text: chunks[i], hash });
            }
        }
    }

    // Remove chunks for deleted/renamed files
    const removed = cache.chunks.filter(c => !liveIds.has(c.id)).length;
    cache.chunks  = cache.chunks.filter(c => liveIds.has(c.id));

    // Embed new/changed chunks in batches
    let embedded = 0;
    for (let i = 0; i < toEmbed.length; i += EMBED_BATCH) {
        const batch   = toEmbed.slice(i, i + EMBED_BATCH);
        const vectors = await embed(batch.map(c => c.text));

        for (let j = 0; j < batch.length; j++) {
            const { id, file, chunkIndex, text, hash } = batch[j];
            const entry = { id, file, chunkIndex, text, hash, embedding: vectors[j] };
            const idx   = cache.chunks.findIndex(c => c.id === id);
            if (idx !== -1) { cache.chunks[idx] = entry; } else { cache.chunks.push(entry); }
        }

        embedded += batch.length;
        console.log(`[RAG] Embedded ${embedded}/${toEmbed.length} chunks`);
    }

    saveCache(cache);

    const added   = toEmbed.filter(c => !chunkMap.has(c.id)).length;
    const updated = toEmbed.length - added;
    console.log(`[RAG] Index updated — added: ${added}, updated: ${updated}, removed: ${removed}, total: ${cache.chunks.length}`);
    return { added, updated, removed, total: cache.chunks.length };
}

// ─── Cosine similarity ────────────────────────────────────────────────────────

function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
}

// ─── Search ───────────────────────────────────────────────────────────────────
// Returns { context: string, sources: string[] } where context is the formatted
// chunks for Claude and sources is the deduplicated list of source file names.

async function searchKB(query, topK = TOP_K) {
    const cache = loadCache();
    if (cache.chunks.length === 0) return { context: '(Knowledge base is empty — run /sync-knowledge to index it.)', sources: [], rawChunks: [] };

    const [queryVec] = await embed([query]);

    const results = cache.chunks
        .map(c => ({ ...c, score: cosine(queryVec, c.embedding) * sourceBoost(c.file) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    const context = results.map(c => `### ${c.file}\n\n${c.text}`).join('\n\n---\n\n');
    const sources = [...new Set(results.map(c => c.file))];
    return { context, sources, rawChunks: results };
}

module.exports = { buildIndex, searchKB };

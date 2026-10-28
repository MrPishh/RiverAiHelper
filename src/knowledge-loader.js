'use strict';

/* ─── About this file ─────────────────────────────────────────────────────────
 * Legacy knowledge loader. Answers now come from rag.js; only getSourceFiles() is
 * still used — by the keyword fallback that labels sources in the staff
 * explanation embed.
 * Exports: getSourceFiles
 * ────────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');

// Folders whose Markdown files are read.
const ROOT_DIR = path.join(__dirname, '..');
const KB_DIR   = path.join(ROOT_DIR, 'knowledge-base');
const CL_DIR   = path.join(ROOT_DIR, 'channel-learning');

// Recursively reads every non-empty .md file under `dir` as { label, content }.
function readMdFiles(dir, labelPrefix) {
    const sections = [];
    if (!fs.existsSync(dir)) return sections;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            const nested = readMdFiles(fullPath, `${labelPrefix}/${entry.name}`);
            sections.push(...nested);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8').trim();
                if (content) {
                    sections.push({ label: `${labelPrefix}/${entry.name}`, content });
                }
            } catch (err) {
                console.warn(`[KnowledgeLoader] Could not read ${fullPath}: ${err.message}`);
            }
        }
    }

    return sections;
}

// Returns each source as { name, content } for relevance scoring.
function getSourceFiles() {
    const kbSections = readMdFiles(KB_DIR, 'knowledge-base');
    const clSections = readMdFiles(CL_DIR, 'channel-learning');
    return [...kbSections, ...clSections].map(s => ({ name: s.label, content: s.content }));
}

module.exports = { getSourceFiles };

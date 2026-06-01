const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, 'knowledge-base');
const CL_DIR = path.join(__dirname, 'channel-learning');

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

// Returns a combined string of all knowledge base content for use in prompts.
function loadKnowledgeBase() {
    const kbSections = readMdFiles(KB_DIR, 'knowledge-base');
    const clSections = readMdFiles(CL_DIR, 'channel-learning');
    const all = [...kbSections, ...clSections];

    if (all.length === 0) return '(No knowledge base content found.)';

    return all
        .map(s => `### ${s.label}\n\n${s.content}`)
        .join('\n\n---\n\n');
}

// Returns each source as { name, content } for relevance scoring.
function getSourceFiles() {
    const kbSections = readMdFiles(KB_DIR, 'knowledge-base');
    const clSections = readMdFiles(CL_DIR, 'channel-learning');
    return [...kbSections, ...clSections].map(s => ({ name: s.label, content: s.content }));
}

module.exports = { loadKnowledgeBase, getSourceFiles };

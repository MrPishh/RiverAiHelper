'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const Anthropic = require('@anthropic-ai/sdk');

const OUT_DIR = __dirname;
const BATCH_ID = fs.readFileSync(path.join(OUT_DIR, 'batch-id.txt'), 'utf8').trim();
const messages = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'messages.json'), 'utf8'));
const byCustomId = new Map(messages.map(m => [`${m.platform}_${m.id}`, m]));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseVerdict(text) {
    const t = text.trim();
    if (/^VERDICT:\s*CORRECT/i.test(t)) return { verdict: 'CORRECT' };
    const incorrectMatch = t.match(/^VERDICT:\s*INCORRECT\s*\|\s*SHOULD_BE:\s*([a-z-]+)\s*\|\s*REASON:\s*(.+)$/is);
    if (incorrectMatch) return { verdict: 'INCORRECT', shouldBe: incorrectMatch[1].trim(), reason: incorrectMatch[2].trim() };
    const ambiguousMatch = t.match(/^VERDICT:\s*AMBIGUOUS\s*\|\s*REASON:\s*(.+)$/is);
    if (ambiguousMatch) return { verdict: 'AMBIGUOUS', reason: ambiguousMatch[1].trim() };
    return { verdict: 'UNPARSEABLE', raw: t.slice(0, 200) };
}

(async () => {
    const perCategory = {}; // intent -> { total, correct, incorrect, ambiguous, unparseable, examples: [] }
    const errors = [];
    let processed = 0;

    for await (const result of await anthropic.messages.batches.results(BATCH_ID)) {
        const m = byCustomId.get(result.custom_id);
        if (!m) continue;

        if (result.result.type !== 'succeeded') {
            errors.push({ custom_id: result.custom_id, type: result.result.type, intent: m.intent });
            continue;
        }

        processed++;
        const text = result.result.message.content[0]?.text ?? '';
        const parsed = parseVerdict(text);

        if (!perCategory[m.intent]) {
            perCategory[m.intent] = { total: 0, correct: 0, incorrect: 0, ambiguous: 0, unparseable: 0, disagreements: [] };
        }
        const bucket = perCategory[m.intent];
        bucket.total++;

        if (parsed.verdict === 'CORRECT') {
            bucket.correct++;
        } else if (parsed.verdict === 'INCORRECT') {
            bucket.incorrect++;
            bucket.disagreements.push({
                platform: m.platform, channel: m.channel, content: m.content.slice(0, 150),
                assigned: m.intent, shouldBe: parsed.shouldBe, reason: parsed.reason,
            });
        } else if (parsed.verdict === 'AMBIGUOUS') {
            bucket.ambiguous++;
        } else {
            bucket.unparseable++;
        }
    }

    console.log(`Processed: ${processed}, Errors: ${errors.length}`);
    if (errors.length) {
        console.log('Error breakdown:', JSON.stringify(errors.reduce((acc, e) => { acc[e.type] = (acc[e.type]||0)+1; return acc; }, {})));
    }
    console.log('');

    // Sort categories by disagreement rate descending
    const rows = Object.entries(perCategory).map(([intent, b]) => ({
        intent,
        total: b.total,
        correct: b.correct,
        incorrect: b.incorrect,
        ambiguous: b.ambiguous,
        unparseable: b.unparseable,
        disagreeRate: ((b.incorrect / b.total) * 100).toFixed(1),
        disagreements: b.disagreements,
    })).sort((a, b) => b.disagreeRate - a.disagreeRate);

    console.log('=== PER-CATEGORY DISAGREEMENT RATES ===');
    for (const r of rows) {
        console.log(`${r.intent.padEnd(24)} total=${String(r.total).padStart(4)}  correct=${String(r.correct).padStart(4)}  incorrect=${String(r.incorrect).padStart(3)}  ambiguous=${String(r.ambiguous).padStart(3)}  disagree=${r.disagreeRate}%`);
    }

    fs.writeFileSync(path.join(OUT_DIR, 'results-summary.json'), JSON.stringify(rows, null, 2));
    console.log('\nFull results (including all disagreement examples) written to results-summary.json');
})();

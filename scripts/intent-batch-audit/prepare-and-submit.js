'use strict';
// One-time batch audit: re-review every classified intent-log message with Sonnet
// against the full taxonomy, to find systematic misclassification patterns.
// Not part of the live bot — run manually, results analyzed separately.

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const Anthropic = require('@anthropic-ai/sdk');

const ROOT = path.join(__dirname, '..', '..');
const DC_LOG = path.join(ROOT, 'intent', 'dc-intent-log.jsonl');
const TG_LOG = path.join(ROOT, 'intent', 'tg-intent-log.jsonl');
const TAXONOMY = fs.readFileSync(path.join(ROOT, 'intent', 'intent-taxonomy.md'), 'utf8');
const OUT_DIR = __dirname;

function loadLog(filePath, platform) {
    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
    const raw = new Map();
    const classified = new Map();
    for (const line of lines) {
        try {
            const r = JSON.parse(line);
            if (r.type === 'classified') classified.set(r.id, r);
            else raw.set(r.id, r);
        } catch {}
    }
    const joined = [];
    for (const [id, c] of classified) {
        const r = raw.get(id);
        if (!r || !r.content?.trim()) continue;
        joined.push({
            id, platform,
            content: r.content,
            channel: r.channel ?? r.channelId,
            intent: c.intent,
            isReply: !!r.isReply,
            mentionsBot: !!r.mentionsBot,
            wordCount: r.wordCount ?? null,
        });
    }
    return joined;
}

const messages = [...loadLog(DC_LOG, 'discord'), ...loadLog(TG_LOG, 'telegram')];
console.log(`Prepared ${messages.length} messages for review`);

fs.writeFileSync(path.join(OUT_DIR, 'messages.json'), JSON.stringify(messages, null, 2));

function buildReviewPrompt(m) {
    return `You are auditing a message-intent classifier for a Discord/Telegram crypto community support bot. Below is the full taxonomy the classifier uses, then one message it already classified. Judge independently whether the assigned category is correct.

${TAXONOMY}

---

MESSAGE TO AUDIT
Platform: ${m.platform}
Channel: ${m.channel}
Is a reply to another message: ${m.isReply}
@mentions the bot: ${m.mentionsBot}
Content: "${m.content}"

ASSIGNED CATEGORY: ${m.intent}

Note: you do not have the surrounding thread/reply context the live classifier had — judge based on the message's own content and speech act. If the message is genuinely ambiguous without more context, say so rather than guessing.

Respond in EXACTLY this format, nothing else:
VERDICT: CORRECT
or
VERDICT: INCORRECT | SHOULD_BE: <category> | REASON: <one concise sentence>
or
VERDICT: AMBIGUOUS | REASON: <one concise sentence on why context is needed>`;
}

const requests = messages.map(m => ({
    custom_id: `${m.platform}_${m.id}`,
    params: {
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [{ role: 'user', content: buildReviewPrompt(m) }],
    },
}));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

(async () => {
    // Batch API accepts up to 100,000 requests per batch — well under that, single batch.
    const batch = await anthropic.messages.batches.create({ requests });
    console.log('Batch created:', batch.id);
    console.log('Status:', batch.processing_status);
    fs.writeFileSync(path.join(OUT_DIR, 'batch-id.txt'), batch.id);
})();

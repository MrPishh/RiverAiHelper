'use strict';

const fs   = require('fs');
const path = require('path');

const INTENT_LOG_PATH    = path.join(__dirname, 'intent', 'dc-intent-log.jsonl');
const TG_INTENT_LOG_PATH = path.join(__dirname, 'intent', 'tg-intent-log.jsonl');

// Ensure the intent/ directory exists so log writes don't throw ENOENT
if (!fs.existsSync(path.dirname(INTENT_LOG_PATH))) {
    fs.mkdirSync(path.dirname(INTENT_LOG_PATH), { recursive: true });
}

const RESPOND_INTENTS = new Set(['help-seeking', 'troubleshooting', 'onboarding', 'factual-question']);

const ALL_INTENT_CATEGORIES = [
    'help-seeking', 'troubleshooting', 'onboarding', 'factual-question',
    'community-hype', 'safety-alert', 'scam-content', 'content-promotion', 'referral-sharing',
    'community-discussion', 'community-announcement', 'staff-ping', 'community-help',
    'general-greeting', 'community-conduct',
];

// Fixed taxonomy — extracted so it can be cached as a system prompt.
// Only the per-message variables (channel, context, content) change per call.
const INTENT_SYSTEM_PROMPT = `Classify this Discord or Telegram message into exactly one intent category. Reply with ONLY the category name — no explanation, no punctuation, nothing else.

RESPOND (bot should answer):
help-seeking — genuine question about protocol mechanics or how something works. ALSO includes frustrated complaints or venting about conversion rates, waiting periods, staking, token amounts, or how the protocol behaves — even when phrased as opinions rather than direct questions (e.g. "the conversion is so poor", "why do I get fewer tokens the longer I wait", "this system makes no sense"). If the user appears confused or disappointed about a protocol mechanic, treat it as help-seeking.
troubleshooting — user reporting a specific problem they are experiencing
onboarding — new user asking how to get started, sign up, or register
factual-question — specific question about token, staking, rates, epoch, contract address

DO NOT RESPOND (bot should stay silent):
community-hype — celebration, milestone reaction, price hype, general project positivity
safety-alert — legitimate community member posting a scam WARNING for public awareness (e.g. "⚠️ Fake accounts spotted — block and report", "Scammer" calling out a bad actor)
scam-content — active phishing or social engineering BY a scammer disguised as help: unsolicited external links, "FOR HELP GO TO X", "use this app to restore your wallet", "DM me, I'm an admin", third-party wallet tools posted as replies to users reporting problems. Distinguished from safety-alert (warning) and community-help (genuine advice): scam-content redirects users away from the channel to external sites or DMs, often within seconds of a victim's message
content-promotion — user sharing their own content (articles, threads, videos)
referral-sharing — user sharing their own referral code for others to use
community-discussion — opinion poll or strategy question directed at the community, not the bot. Does NOT include frustration about protocol mechanics — if the complaint is about how conversion, staking, or waiting works, use help-seeking instead.
community-announcement — user sharing information or news for the community
staff-ping — user trying to get human admin attention (ticket check, tagging staff, not a protocol question)
community-help — another community member giving genuine advice or explaining a protocol mechanic (references the product, asks clarifying questions — does NOT redirect to external sites or DMs)
general-greeting — greeting, thanks, acknowledgement, or reaction with no question
community-conduct — user being visibly abusive or disrespectful to other community members`;

// Factory — call with the shared anthropic client and config to get bound functions.
function createIntentModule(anthropic, { SUPPORT_CHANNEL_ID }) {

    async function classifyMessageIntent(content, message = null) {
        const channelName = message?.channelId === SUPPORT_CHANNEL_ID ? '#support' : '#general';

        let replyContext = 'Standalone message (not a reply to anything).';
        if (message?.reference?.messageId) {
            try {
                const ref = await message.channel.messages.fetch(message.reference.messageId);
                replyContext = ref.author.bot
                    ? 'Reply to the support bot.'
                    : `Reply to another community member (${ref.author.username}).`;
            } catch {
                replyContext = 'Reply to another message.';
            }
        }

        let threadContext = '';
        if (message) {
            try {
                const recent = await message.channel.messages.fetch({ limit: 3, before: message.id });
                const lines = [...recent.values()].reverse()
                    .map(m => `  ${m.author.bot ? '[Bot]' : m.author.username}: ${m.content.slice(0, 120)}`)
                    .join('\n');
                if (lines) threadContext = `\nRecent messages in channel:\n${lines}`;
            } catch {}
        }

        try {
            const resp = await anthropic.messages.create({
                model:      'claude-haiku-4-5-20251001',
                max_tokens: 15,
                system: [{ type: 'text', text: INTENT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
                messages:   [{ role: 'user', content: `Channel: ${channelName}\nReply context: ${replyContext}${threadContext}\n\nMessage:\n${content}\n\nCategory:` }],
            });
            const raw = resp.content[0].text.trim().toLowerCase().replace(/[^a-z-]/g, '');
            return ALL_INTENT_CATEGORIES.includes(raw) ? raw : 'help-seeking';
        } catch (err) {
            console.error('[Intent] Classification error:', err.message);
            return 'help-seeking'; // fail open
        }
    }

    function logMessageIntent(message, botUserId, isStaff = false) {
        try {
            const content = message.content || '';
            const record = {
                platform:      'discord',
                ts:            message.createdAt.toISOString(),
                id:            message.id,
                channelId:     message.channelId,
                channel:       message.channel?.name ?? message.channelId,
                authorId:      message.author.id,
                author:        message.author.username,
                isStaff,
                content:       content.slice(0, 600),
                wordCount:     content.trim().split(/\s+/).filter(Boolean).length,
                hasQuestion:   content.includes('?'),
                isReply:       !!(message.reference?.messageId),
                mentionsBot:   message.mentions.users.has(botUserId),
                hasAttachment: message.attachments.size > 0,
            };
            fs.appendFileSync(INTENT_LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
        } catch {
            // non-fatal
        }
    }

    function logIntentClassification(messageId, intent) {
        try {
            const record = { platform: 'discord', type: 'classified', id: messageId, intent, ts: new Date().toISOString() };
            fs.appendFileSync(INTENT_LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
        } catch {}
    }

    function logTelegramMessage(msg, isStaff = false) {
        try {
            const content = msg.text || '';
            const record = {
                platform:    'telegram',
                ts:          new Date().toISOString(),
                id:          msg.message_id,
                chatId:      msg.chat.id,
                threadId:    msg.message_thread_id ?? null,
                authorId:    msg.from.id,
                author:      msg.from.username ?? msg.from.first_name ?? 'unknown',
                isStaff,
                content:     content.slice(0, 600),
                wordCount:   content.trim().split(/\s+/).filter(Boolean).length,
                hasQuestion: content.includes('?'),
                isReply:     !!(msg.reply_to_message),
            };
            fs.appendFileSync(TG_INTENT_LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
        } catch {}
    }

    function logTelegramIntent(messageId, intent) {
        try {
            const record = { platform: 'telegram', type: 'classified', id: messageId, intent, ts: new Date().toISOString() };
            fs.appendFileSync(TG_INTENT_LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
        } catch {}
    }

    return { classifyMessageIntent, logMessageIntent, logIntentClassification, logTelegramMessage, logTelegramIntent, RESPOND_INTENTS };
}

module.exports = { createIntentModule, RESPOND_INTENTS, ALL_INTENT_CATEGORIES, INTENT_LOG_PATH, TG_INTENT_LOG_PATH };

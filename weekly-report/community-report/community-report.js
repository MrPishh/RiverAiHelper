'use strict';

const fs   = require('fs');
const path = require('path');

const { INTENT_LOG_PATH, TG_INTENT_LOG_PATH, TICKET_LOG_PATH, COLLAB_LOG_PATH } = require('../../src/intent');
const { getWeekRange, getDayRange } = require('../../src/utils');
const { trackUsage } = require('../../src/kb-sync');

const MAX_MSG_LENGTH = 280;

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

const CACHE_PATH    = path.join(__dirname, 'report-cache.json');
const CACHE_TTL_MS  = 14 * 24 * 60 * 60 * 1000; // 14 days

// ─── Cache helpers ────────────────────────────────────────────────────────────

function loadCache() {
    try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
    catch { return {}; }
}

function saveCache(cache) {
    const now = Date.now();
    for (const key of Object.keys(cache)) {
        if (now - new Date(cache[key].cachedAt).getTime() > CACHE_TTL_MS) delete cache[key];
    }
    try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8'); } catch {}
}

function cacheKey(platform, model, from, to, hasChinese) {
    const suffix = hasChinese ? '::cn' : '';
    return `${platform}::${model}::${from.toISOString()}::${to.toISOString()}${suffix}`;
}

// ─── Message readers ──────────────────────────────────────────────────────────

function readDiscordMessages(from, to, generalChannelId, supportChannelId) {
    const result = { general: [], support: [] };
    try {
        const lines = fs.readFileSync(INTENT_LOG_PATH, 'utf8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const r = JSON.parse(line);
                if (r.type === 'classified') continue;
                const ts = new Date(r.ts);
                if (ts < from || ts > to) continue;
                if (r.isStaff) continue;
                if (!r.content?.trim()) continue;
                if (r.channelId === generalChannelId) result.general.push(redactSensitive(r.content.slice(0, MAX_MSG_LENGTH)));
                if (r.channelId === supportChannelId) result.support.push(redactSensitive(r.content.slice(0, MAX_MSG_LENGTH)));
            } catch {}
        }
    } catch {}
    return result;
}

// Groups messages from a JSONL file into threads by channelId.
// Handles: dedup by ID, undefined channelId guard, sort-by-ts in formatThreads.
// legacySkipSource: skips old records written before the two-file split (r.source === value).
function readAndGroupThreads(filePath, from, to, legacySkipSource) {
    const threads = new Map();
    const seenIds = new Set();
    let lines;
    try {
        lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
    } catch { return threads; }

    for (const line of lines) {
        try {
            const r = JSON.parse(line);
            if (r.type) continue;                                              // skip any marker records
            if (legacySkipSource && r.source === legacySkipSource) continue;  // backward compat
            if (!r.channelId) continue;                                        // guard: undefined channelId
            if (seenIds.has(r.id)) continue;                                   // dedup
            const ts = new Date(r.ts);
            if (ts < from || ts > to) continue;
            if (!r.content?.trim()) continue;
            seenIds.add(r.id);
            if (!threads.has(r.channelId)) threads.set(r.channelId, []);
            threads.get(r.channelId).push({ ts, content: redactSensitive(r.content.slice(0, MAX_MSG_LENGTH)) });
        } catch {}
    }
    return threads;
}

function formatThreads(threads) {
    return Array.from(threads.values()).map(entries => {
        entries.sort((a, b) => a.ts - b.ts);
        if (entries.length === 1) return entries[0].content;
        return `[Thread, ${entries.length} messages]\n${entries.map((e, i) => `  ${i + 1}. ${e.content}`).join('\n')}`;
    });
}

function readTicketMessages(from, to) {
    // Skip legacy records written before the two-file split (old combined log had source:'collab')
    const threads = readAndGroupThreads(TICKET_LOG_PATH, from, to, 'collab');
    return formatThreads(threads);
}

// Reads collab-log.jsonl — reserved for the future Business Proposals section.
// When Business Proposals is added:
//   1. Classify threads concurrently with Promise.all (one Haiku call per thread, not per message)
//   2. Split into { support: [], collab: [] } based on classification result
//   3. Support-classified threads merge into the main Discord pool
//   4. Collab-classified threads populate the Business Proposals section
function readCollabMessages(from, to) {
    const threads = readAndGroupThreads(COLLAB_LOG_PATH, from, to, null);
    return formatThreads(threads);
}

function readTelegramMessages(from, to, excludeTopicId = null) {
    const messages = [];
    try {
        const lines = fs.readFileSync(TG_INTENT_LOG_PATH, 'utf8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const r = JSON.parse(line);
                if (r.type === 'classified') continue;
                const ts = new Date(r.ts);
                if (ts < from || ts > to) continue;
                if (r.isStaff) continue;
                if (!r.content?.trim()) continue;
                if (excludeTopicId && String(r.threadId) === String(excludeTopicId)) continue;
                messages.push(redactSensitive(r.content.slice(0, MAX_MSG_LENGTH)));
            } catch {}
        }
    } catch {}
    return messages;
}

function readChineseDiscordMessages(from, to, channelId) {
    const messages = [];
    try {
        const lines = fs.readFileSync(INTENT_LOG_PATH, 'utf8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const r = JSON.parse(line);
                if (r.type === 'classified') continue;
                const ts = new Date(r.ts);
                if (ts < from || ts > to) continue;
                if (r.isStaff) continue;
                if (!r.content?.trim()) continue;
                if (r.channelId === channelId) messages.push(redactSensitive(r.content.slice(0, MAX_MSG_LENGTH)));
            } catch {}
        }
    } catch {}
    return messages;
}

function readChineseTelegramMessages(from, to, topicId) {
    const messages = [];
    try {
        const lines = fs.readFileSync(TG_INTENT_LOG_PATH, 'utf8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const r = JSON.parse(line);
                if (r.type === 'classified') continue;
                const ts = new Date(r.ts);
                if (ts < from || ts > to) continue;
                if (r.isStaff) continue;
                if (!r.content?.trim()) continue;
                if (String(r.threadId) === String(topicId)) messages.push(redactSensitive(r.content.slice(0, MAX_MSG_LENGTH)));
            } catch {}
        }
    } catch {}
    return messages;
}

// Redact obvious private keys before they reach the API
const PRIVATE_KEY_RE = /0x[0-9a-fA-F]{64}/g;
function redactSensitive(text) {
    return text.replace(PRIVATE_KEY_RE, '[REDACTED]');
}

function fmt(msgs, label) {
    return msgs.length
        ? `## ${label}\n${msgs.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
        : `## ${label}\n(no messages this period)`;
}

function buildPrompt(sections, reportType) {
    const periodDesc  = reportType === 'daily' ? 'today' : 'the past week (Monday to Sunday)';
    const body        = sections.map(([msgs, label]) => fmt(msgs, label)).join('\n\n');
    const hasChinese  = sections.some(([, label]) => label.includes('Chinese'));
    const chineseNote = hasChinese
        ? '\n- Some sections contain Chinese-language messages. Understand and analyze them, but write the entire report in English.'
        : '';
    return `You are analysing community messages from a crypto/DeFi project over ${periodDesc}.

IMPORTANT CONTEXT:
- Every message in this dataset is from a community member. Staff and moderator messages have already been removed — do NOT attribute any message to staff, moderators, or the team.
- In DeFi/crypto communities, scammers routinely impersonate support by posting fake help links, "DM me", or copy-pasted "report to the team" messages. If you see multiple users posting identical or near-identical support-sounding messages, treat them as scam/spam activity — NOT as staff behaviour. Flag these as scam attempts in Conversation Highlights.
- Malicious links are automatically blocked by a regex filter. Scammers work around this by sharing Twitter/X links (which are allowed) where the tweet content redirects to a scam server. This is a known structural limitation — do NOT highlight Twitter/X link sharing as a moderation failure or suggest staff are not doing their job. A one-line mention under spam activity is sufficient; do not give it undue weight.${chineseNote}

${body}

Write a concise ${reportType === 'daily' ? 'daily' : 'weekly'} community report divided into exactly these three sections. Start immediately with the first section heading — do NOT add a title, date line, or any introductory text. Use bullet points only. Be specific — reference actual topics or issues mentioned. Do not pad or repeat. Never reproduce private keys, seed phrases, passwords, or any sensitive credentials — paraphrase or omit them.

**Common Problems**
(issues users repeatedly ran into)

**Frequently Asked Questions**
(questions that came up more than once or represent a clear theme)

**Conversation Highlights**
(notable exchanges, interesting discussions, or moments worth flagging for the team — include scam/spam activity if observed)`;
}

// ─── Core builder — returns report data without posting anywhere ──────────────

async function buildCommunityReport(anthropic, {
    GENERAL_CHANNEL_ID,
    SUPPORT_CHANNEL_ID,
    CHINESE_DISCORD_CHANNEL_ID = null,
    CHINESE_TELEGRAM_TOPIC_ID  = null,
    platform   = 'both',
    reportType = 'weekly',
    model      = MODEL_HAIKU,
}) {
    const { from, to }  = reportType === 'daily' ? getDayRange() : getWeekRange();
    const hasChinese    = !!(CHINESE_DISCORD_CHANNEL_ID || CHINESE_TELEGRAM_TOPIC_ID);

    // Weekly reports cover a frozen date range — serve from cache if available
    if (reportType === 'weekly') {
        const cache = loadCache();
        const key   = cacheKey(platform, model, from, to, hasChinese);
        if (cache[key]) {
            const e = cache[key];
            return {
                text:          e.text,
                dc:            e.dcGeneralCount !== undefined
                                   ? { general: new Array(e.dcGeneralCount), support: new Array(e.dcSupportCount) }
                                   : null,
                tg:            e.tgCount !== undefined ? new Array(e.tgCount) : null,
                tickets:       new Array(e.ticketCount || 0),
                dcChinese:     e.dcChineseCount !== undefined ? new Array(e.dcChineseCount) : null,
                tgChinese:     e.tgChineseCount !== undefined ? new Array(e.tgChineseCount) : null,
                from, to,
                totalMessages: e.totalMessages,
                fromCache:     true,
            };
        }
    }

    const dc = (platform === 'discord' || platform === 'both')
        ? readDiscordMessages(from, to, GENERAL_CHANNEL_ID, SUPPORT_CHANNEL_ID)
        : null;
    const tg = (platform === 'telegram' || platform === 'both')
        ? readTelegramMessages(from, to, CHINESE_TELEGRAM_TOPIC_ID)
        : null;
    const tickets  = readTicketMessages(from, to);
    const dcChinese = (platform === 'discord' || platform === 'both') && CHINESE_DISCORD_CHANNEL_ID
        ? readChineseDiscordMessages(from, to, CHINESE_DISCORD_CHANNEL_ID)
        : null;
    const tgChinese = (platform === 'telegram' || platform === 'both') && CHINESE_TELEGRAM_TOPIC_ID
        ? readChineseTelegramMessages(from, to, CHINESE_TELEGRAM_TOPIC_ID)
        : null;

    const sections = [];
    if (dc) {
        sections.push([dc.general, 'Discord — General Channel']);
        sections.push([dc.support, 'Discord — Support Channel']);
    }
    if (tickets.length > 0)           sections.push([tickets,    'Discord — Support Tickets']);
    if (tg)                           sections.push([tg,         'Telegram']);
    if (dcChinese?.length > 0)        sections.push([dcChinese,  'Discord — Chinese Channel']);
    if (tgChinese?.length > 0)        sections.push([tgChinese,  'Telegram — Chinese Topic']);

    const totalMessages =
        (dc ? dc.general.length + dc.support.length : 0) +
        tickets.length +
        (tg ? tg.length : 0) +
        (dcChinese ? dcChinese.length : 0) +
        (tgChinese ? tgChinese.length : 0);

    if (totalMessages === 0) return { text: null, dc, tg, tickets, dcChinese, tgChinese, from, to, totalMessages };

    const resp = await anthropic.messages.create({
        model,
        max_tokens: 1800,
        messages:   [{ role: 'user', content: buildPrompt(sections, reportType) }],
    });

    const text = resp.content[0].text.trim();
    trackUsage(resp.usage.input_tokens, resp.usage.output_tokens, model === MODEL_SONNET ? 'sonnet' : 'haiku');

    // Save weekly reports to cache
    if (reportType === 'weekly') {
        const cache = loadCache();
        cache[cacheKey(platform, model, from, to, hasChinese)] = {
            text,
            dcGeneralCount:  dc        ? dc.general.length : undefined,
            dcSupportCount:  dc        ? dc.support.length : undefined,
            tgCount:         tg        ? tg.length         : undefined,
            ticketCount:     tickets.length,
            dcChineseCount:  dcChinese ? dcChinese.length   : undefined,
            tgChineseCount:  tgChinese ? tgChinese.length   : undefined,
            totalMessages,
            cachedAt:        new Date().toISOString(),
        };
        saveCache(cache);
    }

    return { text, dc, tg, tickets, dcChinese, tgChinese, from, to, totalMessages };
}

// ─── Discord poster — wraps builder and posts to REPORTS_CHANNEL_ID ──────────

async function generateCommunityReport(discordClient, {
    GENERAL_CHANNEL_ID,
    SUPPORT_CHANNEL_ID,
    REPORTS_CHANNEL_ID,
    CHINESE_DISCORD_CHANNEL_ID = null,
    CHINESE_TELEGRAM_TOPIC_ID  = null,
    anthropic,
    platform   = 'both',
    reportType = 'weekly',
    model      = MODEL_HAIKU,
}) {
    const reportsChannel = await discordClient.channels.fetch(REPORTS_CHANNEL_ID);
    const platformLabel  = { discord: 'Discord', telegram: 'Telegram', both: 'Both' }[platform];
    const typeLabel      = reportType === 'daily' ? 'Daily' : 'Weekly';

    const result = await buildCommunityReport(anthropic, {
        GENERAL_CHANNEL_ID, SUPPORT_CHANNEL_ID,
        CHINESE_DISCORD_CHANNEL_ID, CHINESE_TELEGRAM_TOPIC_ID,
        platform, reportType, model,
    });

    const fromLabel = result.from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const toLabel   = result.to.toLocaleDateString('en-GB',   { day: 'numeric', month: 'short', year: 'numeric' });
    const dateRange = reportType === 'daily' ? fromLabel : `${fromLabel} to ${toLabel}`;

    if (!result.text) {
        await reportsChannel.send(`**${typeLabel} Community Report (${platformLabel})** — No user messages found for ${dateRange}.`);
        return;
    }

    const { text, dc, tg, tickets, dcChinese, tgChinese } = result;
    const countLine = [
        dc                        ? `${dc.general.length + dc.support.length} Discord` : null,
        tickets?.length > 0       ? `${tickets.length} Tickets`                        : null,
        tg                        ? `${tg.length} Telegram`                            : null,
        dcChinese?.length > 0     ? `${dcChinese.length} Chinese (Discord)`            : null,
        tgChinese?.length > 0     ? `${tgChinese.length} Chinese (Telegram)`           : null,
    ].filter(Boolean).join(' + ');
    const cacheNote = result.fromCache ? ' — cached' : '';

    await reportsChannel.send(
        `**${typeLabel} Community Report (${platformLabel})** — ${dateRange}\n` +
        `*(${countLine} messages analysed${cacheNote})*\n\n` +
        text
    );
}

module.exports = { generateCommunityReport, buildCommunityReport, MODEL_HAIKU, MODEL_SONNET };

'use strict';

const fs   = require('fs');
const path = require('path');

const { INTENT_LOG_PATH, TG_INTENT_LOG_PATH } = require('../../intent');

const MAX_MSG_LENGTH = 250;

// Returns the most recently completed Mon–Sun week.
// If today IS Sunday the range ends today; otherwise it ends on the previous Sunday.
function getWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon … 6=Sat
    const sundayEnd = new Date(now);
    sundayEnd.setDate(sundayEnd.getDate() - day);
    sundayEnd.setHours(23, 59, 59, 999);
    const mondayStart = new Date(sundayEnd);
    mondayStart.setDate(mondayStart.getDate() - 6);
    mondayStart.setHours(0, 0, 0, 0);
    return { from: mondayStart, to: sundayEnd };
}

function getDayRange() {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    return { from, to };
}

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
                if (r.channelId === generalChannelId) result.general.push(r.content.slice(0, MAX_MSG_LENGTH));
                if (r.channelId === supportChannelId) result.support.push(r.content.slice(0, MAX_MSG_LENGTH));
            } catch {}
        }
    } catch {}
    return result;
}

function readTelegramMessages(from, to) {
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
                messages.push(r.content.slice(0, MAX_MSG_LENGTH));
            } catch {}
        }
    } catch {}
    return messages;
}

function fmt(msgs, label) {
    return msgs.length
        ? `## ${label}\n${msgs.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
        : `## ${label}\n(no messages this period)`;
}

function buildPrompt(sections, reportType) {
    const periodDesc = reportType === 'daily' ? 'today' : 'the past week (Monday to Sunday)';
    const body = sections.map(([msgs, label]) => fmt(msgs, label)).join('\n\n');
    return `You are analysing community messages from a crypto/DeFi project over ${periodDesc}. User messages only — no staff, no bots.

${body}

Write a concise ${reportType === 'daily' ? 'daily' : 'weekly'} community report divided into exactly these three sections. Use bullet points only. Be specific — reference actual topics or issues mentioned. Do not pad or repeat.

**Common Problems**
(issues users repeatedly ran into)

**Frequently Asked Questions**
(questions that came up more than once or represent a clear theme)

**Conversation Highlights**
(notable exchanges, interesting discussions, or moments worth flagging for the team)`;
}

async function generateCommunityReport(discordClient, {
    GENERAL_CHANNEL_ID,
    SUPPORT_CHANNEL_ID,
    REPORTS_CHANNEL_ID,
    anthropic,
    platform   = 'both',    // 'discord' | 'telegram' | 'both'
    reportType = 'weekly',  // 'weekly' | 'daily'
}) {
    const { from, to } = reportType === 'daily' ? getDayRange() : getWeekRange();
    const reportsChannel = await discordClient.channels.fetch(REPORTS_CHANNEL_ID);

    const dc = (platform === 'discord' || platform === 'both')
        ? readDiscordMessages(from, to, GENERAL_CHANNEL_ID, SUPPORT_CHANNEL_ID)
        : null;
    const tg = (platform === 'telegram' || platform === 'both')
        ? readTelegramMessages(from, to)
        : null;

    const sections = [];
    if (dc) {
        sections.push([dc.general, 'Discord — General Channel']);
        sections.push([dc.support, 'Discord — Support Channel']);
    }
    if (tg) sections.push([tg, 'Telegram']);

    const totalMessages =
        (dc ? dc.general.length + dc.support.length : 0) +
        (tg ? tg.length : 0);

    const platformLabel = { discord: 'Discord', telegram: 'Telegram', both: 'Discord + Telegram' }[platform];
    const typeLabel     = reportType === 'daily' ? 'Daily' : 'Weekly';

    const fromLabel = from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const toLabel   = to.toLocaleDateString('en-GB',   { day: 'numeric', month: 'short', year: 'numeric' });
    const dateRange = reportType === 'daily' ? fromLabel : `${fromLabel} to ${toLabel}`;

    if (totalMessages === 0) {
        await reportsChannel.send(`**${typeLabel} Community Report (${platformLabel})** — No user messages found for ${dateRange}.`);
        return;
    }

    const resp = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1400,
        messages:   [{ role: 'user', content: buildPrompt(sections, reportType) }],
    });

    const report = resp.content[0].text.trim();

    const countLine = [
        dc ? `${dc.general.length + dc.support.length} Discord` : null,
        tg ? `${tg.length} Telegram` : null,
    ].filter(Boolean).join(' + ');

    await reportsChannel.send(
        `**${typeLabel} Community Report (${platformLabel})** — ${dateRange}\n` +
        `*(${countLine} messages analysed)*\n\n` +
        report
    );
}

module.exports = { generateCommunityReport };

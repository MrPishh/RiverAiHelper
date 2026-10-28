'use strict';
/* ─── About this file ─────────────────────────────────────────────────────────
 * One-time script (run in June 2026): backfills human messages from the Chinese
 * Discord channel since SINCE_DATE into intent/dc-intent-log.jsonl, skipping
 * message IDs already logged live. Run: node intent/backfill-chinese.js
 * Not part of the running bot.
 * ────────────────────────────────────────────────────────────────────────── */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs   = require('fs');
const path = require('path');

// ─── Settings ────────────────────────────────────────────────────────────────

// Monday of the current week (June 1, 2026) — start of backfill window
const SINCE_DATE = new Date('2026-06-01T00:00:00Z');

// Channel to backfill, and the Discord intent log the records are appended to.
const CHANNEL_ID = process.env.CHINESE_DISCORD_CHANNEL_ID;
const LOG_PATH   = path.join(__dirname, 'dc-intent-log.jsonl');

// ─── Backfill ────────────────────────────────────────────────────────────────

// Discord's epoch (2015-01-01) in milliseconds — message IDs (snowflakes) count from it.
const DISCORD_EPOCH = 1420070400000n;

// Converts a date to the smallest message ID created at that moment, for the API's `after=` paging.
function dateToSnowflake(date) {
    const ms = BigInt(date.getTime());
    return ((ms - DISCORD_EPOCH) << 22n).toString();
}

// Pages through the channel's history and appends each new human message as an intent-log record.
async function backfill() {
    if (!CHANNEL_ID) {
        console.error('CHINESE_DISCORD_CHANNEL_ID is not set in .env — aborting.');
        process.exit(1);
    }

    const fetch = (await import('node-fetch')).default;

    // Fetch channel name for the log record
    let channelName = CHANNEL_ID;
    try {
        const chRes = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}`, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
        });
        if (chRes.ok) {
            const ch = await chRes.json();
            channelName = ch.name ?? CHANNEL_ID;
        }
    } catch {}
    console.error(`Channel: #${channelName} (${CHANNEL_ID})`);

    // Page through all messages since Monday
    const all   = [];
    let after   = dateToSnowflake(SINCE_DATE);
    let page    = 0;

    while (true) {
        const url = `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=100&after=${after}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
        });

        if (!res.ok) {
            console.error(`Discord API error ${res.status}: ${await res.text()}`);
            process.exit(1);
        }

        const msgs = await res.json();
        if (!msgs.length) break;

        msgs.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
        all.push(...msgs);
        after = msgs[msgs.length - 1].id;
        page++;

        process.stderr.write(`Page ${page}: fetched ${msgs.length} (total ${all.length})\n`);

        if (msgs.length < 100) break;
        // Short pause between pages to stay well inside Discord's rate limit.
        await new Promise(r => setTimeout(r, 300));
    }

    // Drop bot messages
    const human = all.filter(m => !m.author.bot);
    console.error(`Human messages: ${human.length} of ${all.length}`);

    // Load existing message IDs to avoid duplicating live-logged records
    const existing = new Set();
    if (fs.existsSync(LOG_PATH)) {
        const lines = fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean);
        for (const line of lines) {
            try { const r = JSON.parse(line); if (r.id) existing.add(String(r.id)); } catch {}
        }
    }
    console.error(`Existing log IDs: ${existing.size}`);

    let written = 0;
    for (const m of human) {
        if (existing.has(m.id)) continue;

        const content = (m.content || '').slice(0, 600);
        const record = {
            platform:      'discord',
            ts:            m.timestamp,
            id:            m.id,
            channelId:     CHANNEL_ID,
            channel:       channelName,
            authorId:      m.author.id,
            author:        m.author.username,
            isStaff:       false,
            content,
            wordCount:     content.trim().split(/\s+/).filter(Boolean).length,
            hasQuestion:   content.includes('?'),
            isReply:       !!(m.referenced_message || m.message_reference),
            mentionsBot:   false,
            hasAttachment: m.attachments.length > 0,
        };
        fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
        written++;
    }

    console.log(`Done — wrote ${written} new records to dc-intent-log.jsonl`);
}

backfill().catch(err => { console.error(err); process.exit(1); });

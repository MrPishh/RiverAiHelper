'use strict';

const fs   = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'tg-member-log.jsonl');

function logTgMemberEvent(type, user, chatId) {
    const record = {
        ts:       new Date().toISOString(),
        type,
        userId:   user.id,
        username: user.username ?? user.first_name ?? 'unknown',
        chatId:   String(chatId),
    };
    try {
        fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
    } catch {}
}

function getTgMemberStats(from, to) {
    let joins = 0, leaves = 0;
    try {
        const lines = fs.readFileSync(LOG_PATH, 'utf8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
            try {
                const r = JSON.parse(line);
                const ts = new Date(r.ts);
                if (ts >= from && ts <= to) {
                    if (r.type === 'join')  joins++;
                    if (r.type === 'leave') leaves++;
                }
            } catch {}
        }
    } catch {}
    return { joins, leaves };
}

module.exports = { logTgMemberEvent, getTgMemberStats };

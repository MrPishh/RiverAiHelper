'use strict';

const fs   = require('fs');
const path = require('path');

const { getWeekRange, getDayRange } = require('../../../src/utils');

const LOG_PATH = path.join(__dirname, 'member-log.jsonl');

function logEvent(type, member) {
    const record = {
        ts:       new Date().toISOString(),
        type,
        userId:   member.id,
        username: member.user?.username ?? 'unknown',
        guildId:  member.guild?.id ?? 'unknown',
    };
    try {
        fs.appendFileSync(LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
    } catch {}
}

function getMemberStats(from, to) {
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

function getWeeklyStats() {
    const { from, to } = getWeekRange();
    return getMemberStats(from, to);
}

function registerMemberEvents(client) {
    client.on('guildMemberAdd',    (member) => logEvent('join',  member));
    client.on('guildMemberRemove', (member) => logEvent('leave', member));
}

module.exports = { registerMemberEvents, getWeeklyStats, getMemberStats, getWeekRange, getDayRange };

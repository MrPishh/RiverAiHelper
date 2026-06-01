'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Date/folder helpers ──────────────────────────────────────────────────────

function getMonthLabel() {
    return new Date().toLocaleString('en-US', { month: 'long' });
}

function getWeekLabel() {
    const day = new Date().getDate();
    if (day <= 7)  return 'week1';
    if (day <= 14) return 'week2';
    if (day <= 21) return 'week3';
    return 'week4';
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function appendToMonthlyWeeklyFile(type, content) {
    const month      = getMonthLabel();
    const week       = getWeekLabel();
    const suffix     = type === 'announcements' ? 'ann' : 'tweet';
    const folderName = `${month}_${suffix}`;
    const dir        = path.join(__dirname, 'knowledge-base', type, folderName);
    ensureDir(dir);

    const filepath  = path.join(dir, `${week}.md`);
    const timestamp = new Date().toISOString();
    fs.appendFileSync(filepath, `\n\n---\n*${timestamp}*\n${content}`, 'utf8');
    console.log(`[KB] Saved to knowledge-base/${type}/${folderName}/${week}.md`);
}

// ─── Discord helpers ──────────────────────────────────────────────────────────
// botUserId is passed explicitly so these functions don't close over discordClient.

function isStaff(member, staffRoleIds) {
    if (!member || staffRoleIds.length === 0) return false;
    return staffRoleIds.some(id => member.roles.cache.has(id));
}

function isBotMentioned(message, botUserId) {
    return message.mentions.users.has(botUserId);
}

function stripBotMention(content, botUserId) {
    return content
        .replace(`<@${botUserId}>`, '')
        .replace(`<@!${botUserId}>`, '')
        .trim();
}

function looksResolved(text) {
    return /\b(ok|okay|fixed|solved|works|working|sorted|got.?it|nvm|never.?mind|problem.?solved|issue.?resolved|all.?good|good.?now|it.?s (working|fixed|ok|good)|disconnected|logged.?in.?again|no.?longer|not.?an.?issue)\b/i.test(text);
}

function looksLikeQuestion(content) {
    const trimmed = content.trim();
    if (trimmed.includes('?')) return true;

    const words = trimmed.toLowerCase().split(/\s+/);
    if (words.length < 4) return false;

    const questionStarters = [
        'what', 'how', 'why', 'when', 'where', 'who', 'which',
        'can', 'could', 'would', 'should', 'will', 'is', 'are', 'does', 'do',
        'help', 'i need', 'problem', 'issue', 'error', 'broken', 'not working',
    ];
    const startsWithQ = questionStarters.some(w => trimmed.toLowerCase().startsWith(w));
    return startsWithQ || words.length >= 8;
}

function trackerKey(userId, channelId) {
    return `${userId}::${channelId}`;
}

// ─── Knowledge helpers ────────────────────────────────────────────────────────

function saveQAPair(channelName, question, answer) {
    const filepath  = path.join(__dirname, 'channel-learning', channelName, 'qa-log.md');
    ensureDir(path.dirname(filepath));
    const timestamp = new Date().toISOString();
    const entry     = `\n\n---\n**Q** *(${timestamp})*: ${question}\n\n**A**: ${answer}`;
    fs.appendFileSync(filepath, entry, 'utf8');
    console.log(`[QA-Log] Saved pair → channel-learning/${channelName}/qa-log.md`);
}

module.exports = {
    getMonthLabel,
    getWeekLabel,
    ensureDir,
    appendToMonthlyWeeklyFile,
    isStaff,
    isBotMentioned,
    stripBotMention,
    looksResolved,
    looksLikeQuestion,
    trackerKey,
    saveQAPair,
};

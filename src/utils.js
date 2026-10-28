'use strict';

/* ─── QUICK REFERENCE ────────────────────────────────────────────────────────
 * Pure helpers — no side effects, no API calls, no shared state.
 * Exports: getWeekRange, getDayRange, getMonthLabel, getWeekLabel,
 *          appendToMonthlyWeeklyFile, ensureDir, isStaff, isBotMentioned,
 *          stripBotMention, looksResolved, trackerKey, saveQAPair,
 *          normalizeDisplayName, looksLikeSpoofedName, looksLikeHelperOffer,
 *          splitMessage
 *
 * Function / Section                                           ~Line
 * ─────────────────────────────────────────────────────────────────
 * getWeekRange() / getDayRange()   date range for log queries      37
 * getMonthLabel() / getWeekLabel() folder/file name builders       57
 * ensureDir()                      mkdir -p wrapper                69
 * appendToMonthlyWeeklyFile()      write to ann/tweet week files   75
 * isStaff()                        role-based staff check          92
 * isBotMentioned()                 check if bot @mentioned         97
 * stripBotMention()                remove <@botId> from content   101
 * looksResolved()                  self-resolution pattern check  108
 * trackerKey()                     userId::channelId string       112
 * normalizeDisplayName()           leet-sub + strip for spoof     121
 * levenshtein()                    edit distance for name match   129
 * looksLikeSpoofedName()           Layer 3 spoof detector         148
 * looksLikeHelperOffer()           DM / help-offer pattern        162
 * splitMessage()                   chunk text at maxLen, newline-aware 171
 * saveQAPair()                     write to channel-learning/     187
 * ─────────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

// ─── Date/folder helpers ──────────────────────────────────────────────────────

function getWeekRange() {
    const now = new Date();
    const day = now.getDay();
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
    const dir        = path.join(ROOT_DIR, 'knowledge-base', type, folderName);
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

function trackerKey(userId, channelId) {
    return `${userId}::${channelId}`;
}

// ─── Spoof-detection helpers ──────────────────────────────────────────────────

const LEET_MAP       = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '@': 'a' };
const STRIP_WORDS_RE = /\b(official|real|support|admin|mod|helper|team|river)\b/g;

function normalizeDisplayName(name) {
    return name
        .toLowerCase()
        .replace(/[0134567@]/g, c => LEET_MAP[c] ?? c)
        .replace(STRIP_WORDS_RE, '')
        .replace(/[^a-z]/g, '');
}

function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    const dp = [];
    for (let i = 0; i <= m; i++) {
        dp[i] = [i];
        for (let j = 1; j <= n; j++) dp[i][j] = i === 0 ? j : 0;
    }
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

// Returns { matched: true, staffName: <original> } or { matched: false }
function looksLikeSpoofedName(senderDisplayName, staffNameCache) {
    const normalized = normalizeDisplayName(senderDisplayName);
    if (normalized.length < 4) return { matched: false };
    for (const [staffNorm, staffOriginal] of staffNameCache) {
        if (staffNorm.length < 4) continue;
        if (normalized === staffNorm)              return { matched: true, staffName: staffOriginal };
        if (normalized.includes(staffNorm))        return { matched: true, staffName: staffOriginal };
        if (levenshtein(normalized, staffNorm) <= 1) return { matched: true, staffName: staffOriginal };
    }
    return { matched: false };
}

const HELPER_OFFER_RE = /\b(dm\s*me|message\s*me|contact\s*me(\s+privately)?|reach\s*me|send\s*me\s*a\s*[dp]m|i\s+can\s+help|how\s+can\s+i\s+help|i('ll|'d|\s+will|\s+would)\s+help|i\s+can\s+assist|let\s+me\s+help|help\s+you(\s+out)?\s+privately|outside\s+(the\s+)?channel|in\s+(private|my\s+dms?|direct)|inbox\s*(me|us)|check\s+(your\s+)?(inbox|requests?|dms?)|sent?\s+(you\s+)?(a\s+)?(?:friend\s+)?request)\b/i;

function looksLikeHelperOffer(content) {
    return HELPER_OFFER_RE.test(content);
}


// ─── Knowledge helpers ────────────────────────────────────────────────────────

// Splits text into chunks no longer than maxLen, breaking at the last newline before the
// limit when possible (falls back to a hard cut if no newline is found).
function splitMessage(text, maxLen = 4096) {
    if (text.length <= maxLen) return [text];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = start + maxLen;
        if (end < text.length) {
            const lastNewline = text.lastIndexOf('\n', end);
            if (lastNewline > start) end = lastNewline;
        }
        chunks.push(text.slice(start, end));
        start = end;
    }
    return chunks;
}

function saveQAPair(channelName, question, answer) {
    const filepath  = path.join(ROOT_DIR, 'channel-learning', channelName, 'qa-log.md');
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
    getWeekRange,
    getDayRange,
    looksResolved,
    trackerKey,
    saveQAPair,
    normalizeDisplayName,
    looksLikeSpoofedName,
    looksLikeHelperOffer,
    splitMessage,
};

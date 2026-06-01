'use strict';

// ─── Timing constants ─────────────────────────────────────────────────────────

const STAFF_WAIT_MS              = parseInt(process.env.STAFF_WAIT_MINUTES || '3', 10) * 60 * 1000;
const REPHRASE_WINDOW_MS         = 2 * 60 * 60 * 1000;
const MAX_BOT_ANSWERS_BEFORE_TICKET = 2;
const CONV_EXPIRY_MS             = 30 * 60 * 1000;
const STAFF_ENGAGED_WINDOW_MS    = 4 * 60 * 60 * 1000;
const BOT_REPLIED_WINDOW_MS      = 5 * 60 * 1000;

// ─── Referral codes ───────────────────────────────────────────────────────────

const REFERRAL_CODES = ['JosephineOral', 'MrPishh'];

// ─── Shared state ─────────────────────────────────────────────────────────────
// All Maps and mutable scalars are exported as properties of a single object so
// every module that requires('./state') holds a reference to the same object —
// mutations are visible across modules without re-requiring.

// Wrapped in objects so mutations to scalar values propagate across modules.
// (Exporting a bare primitive snapshots its value at require-time.)
const coreFacts     = { value: '' };   // set by loadCoreFacts()
const referralCode  = { idx: 0 };     // incremented by askClaude()

// messageId → { question, userId, channelId, timer }
const pendingQuestions = new Map();

// `${userId}::${channelId}` → { answerCount, lastAnsweredAt }
const rephrasingTracker = new Map();

// messageId → { question, userId, channelName, storedAt }
const recentQuestions = new Map();

// userId::channelId → { history, botMsgId, channelId, lastActivity }
const conversationState = new Map();

// botMsgId → trackerKey (userId::channelId)
const botMsgIndex = new Map();

// botMsgId → { sources: string[], storedAt: number }
const ragSourcesMap = new Map();

// userId::channelId → timestamp
const staffEngaged = new Map();

// userId::channelId → timestamp
const botReplied = new Map();

module.exports = {
    STAFF_WAIT_MS,
    REPHRASE_WINDOW_MS,
    MAX_BOT_ANSWERS_BEFORE_TICKET,
    CONV_EXPIRY_MS,
    STAFF_ENGAGED_WINDOW_MS,
    BOT_REPLIED_WINDOW_MS,
    REFERRAL_CODES,
    coreFacts,
    referralCode,
    pendingQuestions,
    rephrasingTracker,
    recentQuestions,
    conversationState,
    botMsgIndex,
    ragSourcesMap,
    staffEngaged,
    botReplied,
};

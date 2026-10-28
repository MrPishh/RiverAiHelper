'use strict';

/* ─── QUICK REFERENCE ────────────────────────────────────────────────────────
 * All shared mutable state. Root of dependency tree — no local requires.
 * Import this in every module that needs shared Maps or timing constants.
 *
 * Contents                                                      ~Line
 * ─────────────────────────────────────────────────────────────────
 * Timing constants                 STAFF_WAIT_MS, CONV_EXPIRY_MS  28
 *   (STAFF_ENGAGED_WINDOW_MS, POST_STAFF_WAIT_MS, POST_STAFF_CONTEXT_MS,
 *    REPHRASE_WINDOW_MS, COMMUNITY_DISC_WINDOW_MS, MAX_BOT_ANSWERS_BEFORE_TICKET)
 * REFERRAL_CODES / referralCode    rotation index wrapper          40
 * coreFacts                        { value: string }               49
 * State Maps                                                       56
 *   pendingQuestions               userId::channelId → Scenario 3 batch + timer
 *   pendingMsgIndex                msgId → userId::channelId (O(1) lookup into pendingQuestions)
 *   rephrasingTracker              userId::channelId → answer count
 *   recentQuestions                userId::channelId → last question
 *   conversationState              userId::channelId → history
 *   botMsgIndex                    botMsgId → convKey (O(1) lookup)
 *   ragSourcesMap                  botMsgId → {sources, storedAt}
 *   staffEngaged                   userId::channelId → timestamp
 *   recentCommunityDiscussion      userId::channelId → prior context
 * staffNameCache / staffNameCacheTs  normalizedName → displayName   86
 * ─────────────────────────────────────────────────────────────────────────── */

// ─── Timing constants ─────────────────────────────────────────────────────────

const STAFF_WAIT_MS              = parseInt(process.env.STAFF_WAIT_MINUTES || '5', 10) * 60 * 1000;
const REPHRASE_WINDOW_MS         = 2 * 60 * 60 * 1000;
const MAX_BOT_ANSWERS_BEFORE_TICKET = 2;
const CONV_EXPIRY_MS             = 30 * 60 * 1000;
const STAFF_ENGAGED_WINDOW_MS    = 3 * 60 * 1000;   // 3 min hard block after staff replies to a user
const POST_STAFF_WAIT_MS         = 3 * 60 * 1000;   // shorter wait for same user after staffEngaged expires
const POST_STAFF_CONTEXT_MS      = 20 * 60 * 1000;  // how long POST_STAFF_WAIT applies (20 min window)
const COMMUNITY_DISC_WINDOW_MS   = 30 * 60 * 1000;

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

// userId::channelId → { messages: [{id, content, ts}], userId, channelId, timer, lastMessage, storedAt }
// A pending Scenario 3 batch. Messages from the same user in the same channel that arrive
// while a batch is already pending get folded into it (same timer/deadline) instead of
// starting a competing one — so a burst of messages produces one combined answer.
const pendingQuestions = new Map();

// messageId → trackerKey (userId::channelId) — reverse lookup so a reply to ANY individual
// message in a pending batch (not just the latest) can find and cancel the whole batch.
const pendingMsgIndex = new Map();

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

// userId::channelId → { content, messageId, storedAt }
// Tracks recent community-discussion messages for follow-up context (30-min window)
const recentCommunityDiscussion = new Map();

// normalizedName → original display name (for readable alert messages)
// Built at startup and refreshed every 24 hrs by buildStaffNameCache() in bot.js
const staffNameCache   = new Map();
const staffNameCacheTs = { value: 0 };

module.exports = {
    STAFF_WAIT_MS,
    REPHRASE_WINDOW_MS,
    MAX_BOT_ANSWERS_BEFORE_TICKET,
    CONV_EXPIRY_MS,
    STAFF_ENGAGED_WINDOW_MS,
    POST_STAFF_WAIT_MS,
    POST_STAFF_CONTEXT_MS,
    COMMUNITY_DISC_WINDOW_MS,
    REFERRAL_CODES,
    coreFacts,
    referralCode,
    pendingQuestions,
    pendingMsgIndex,
    rephrasingTracker,
    recentQuestions,
    conversationState,
    botMsgIndex,
    ragSourcesMap,
    staffEngaged,
    recentCommunityDiscussion,
    staffNameCache,
    staffNameCacheTs,
};

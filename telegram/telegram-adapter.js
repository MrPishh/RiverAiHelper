'use strict';

const { Telegraf }  = require('telegraf');
const { isEnabled } = require('../toggles');
const { logTgMemberEvent } = require('../weekly-report/member-stats/telegram/tg-member-stats');

// ─── Telegram markdown sanitiser ─────────────────────────────────────────────

function sanitizeForTelegram(text) {
    return text
        .replace(/\*\*(.*?)\*\*/gs, '$1')
        .replace(/\*(.*?)\*/gs, '$1')
        .replace(/<(https?:\/\/[^\s>]+)>/g, '$1')
        .replace(/<#\d+>/g, 'the support channel in the River Discord server')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// ─── Target message wrapper ───────────────────────────────────────────────────

function makeTgTarget(ctx, chatId, threadId, replyToMsgId) {
    return {
        reply: async (text) => {
            const sanitized = sanitizeForTelegram(text);
            const sent = await ctx.telegram.sendMessage(chatId, sanitized, {
                ...(threadId ? { message_thread_id: threadId } : {}),
                reply_to_message_id: replyToMsgId,
            });
            return { id: `tg_${sent.message_id}` };
        },
    };
}

// ─── Admin cache ──────────────────────────────────────────────────────────────
// Fetches the group's admin list and caches it for 10 minutes to avoid
// hitting the Telegram API on every message.

const ADMIN_CACHE_TTL = 10 * 60 * 1000;
let adminCache   = new Set();
let adminCacheTs = 0;

async function isAdmin(telegram, chatId, userId) {
    const now = Date.now();
    if (now - adminCacheTs > ADMIN_CACHE_TTL) {
        try {
            const admins = await telegram.getChatAdministrators(chatId);
            adminCache   = new Set(admins.map(a => a.user.id));
            adminCacheTs = now;
            console.log(`[TG] Admin cache refreshed — ${adminCache.size} admins`);
        } catch (err) {
            console.error('[TG] Could not fetch admin list:', err.message);
        }
    }
    return adminCache.has(userId);
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createTelegramAdapter({
    token,
    allowedChatId,
    allowedTopicIds,
    state,
    answerQuestion,
    searchKB,
    classifyMessageIntent,
    logTelegramMessage,
    logTelegramIntent,
    RESPOND_INTENTS,
}) {
    const bot       = new Telegraf(token);
    const chatIdStr = String(allowedChatId);
    const topicSet  = new Set(allowedTopicIds.map(String));
    let botId       = null;
    let botUsername = null;

    bot.telegram.getMe().then(me => {
        botId       = me.id;
        botUsername = me.username;
        console.log(`[TG] Bot identity: @${botUsername} (${botId})`);
    }).catch(err => console.error('[TG] getMe failed:', err.message));

    bot.on('message', async (ctx) => {
        try {
            const msg = ctx.message;
            if (!msg?.text?.trim()) return;

            if (String(msg.chat.id) !== chatIdStr) return;

            const threadId = msg.message_thread_id ?? null;
            if (!topicSet.has(String(threadId ?? ''))) return;

            if (!isEnabled('telegram')) return;

            const text      = msg.text.trim();
            const fromId    = msg.from.id;
            const userId    = `tg_${fromId}`;
            const channelId = `tg_${chatIdStr}_${threadId ?? 0}`;
            const key       = `${userId}::${channelId}`;
            const staff     = await isAdmin(ctx.telegram, chatIdStr, fromId);

            // Log every message (same as Discord intent log)
            logTelegramMessage(msg, staff);

            // ── Scenario 0 — Reply to bot's CLARIFY question ──────────────────

            const replyToId = msg.reply_to_message?.message_id;
            if (replyToId) {
                const tgMsgKey = `tg_${replyToId}`;
                const convKey  = state.botMsgIndex.get(tgMsgKey);
                const conv     = convKey ? state.conversationState.get(convKey) : null;
                if (conv && convKey.split('::')[0] === userId) {
                    const updatedHistory = [...conv.history, { role: 'user', content: text }];
                    const target = makeTgTarget(ctx, msg.chat.id, threadId, msg.message_id);
                    console.log(`[TG] Scenario 0 — CLARIFY continuation for ${userId}`);
                    await answerQuestion({ question: text, targetMessage: target, userId, channelId, existingHistory: updatedHistory });
                    return;
                }
            }

            // ── Scenario 0.5 — Reply to a regular bot answer ──────────────────

            if (replyToId && botId && msg.reply_to_message?.from?.id === botId && !staff) {
                const botAnswer = msg.reply_to_message.text || '';
                const { context: newContext, sources: newSources } = await searchKB(text);
                const history = [
                    { role: 'assistant', content: botAnswer },
                    { role: 'user', content: `Relevant context:\n${newContext}\n\nFollow-up: ${text}` },
                ];
                const target = makeTgTarget(ctx, msg.chat.id, threadId, msg.message_id);
                console.log(`[TG] Scenario 0.5 — follow-up reply from ${userId}`);
                await answerQuestion({ question: text, targetMessage: target, userId, channelId, existingHistory: history, ragSources: newSources });
                return;
            }

            // ── Scenario 1 — @mention ─────────────────────────────────────────

            const mentioned = botUsername && msg.entities?.some(e =>
                (e.type === 'mention' && text.slice(e.offset, e.offset + e.length) === `@${botUsername}`) ||
                (e.type === 'text_mention' && e.user?.id === botId)
            );
            if (mentioned) {
                const question = text.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();
                if (!question) return;
                const intent = await classifyMessageIntent(question, null);
                logTelegramIntent(msg.message_id, intent);
                console.log(`[TG] Scenario 1 — @mention from ${userId} (intent: ${intent}, staff: ${staff})`);
                if (!RESPOND_INTENTS.has(intent)) return;
                const target = makeTgTarget(ctx, msg.chat.id, threadId, msg.message_id);
                await answerQuestion({ question, targetMessage: target, userId, channelId });
                return;
            }

            // ── Scenario 3 — Unprompted message ──────────────────────────────

            // Staff replied to a user's message — cancel their pending timer and
            // mark them as staff-engaged so the bot backs off
            if (staff) {
                if (replyToId) {
                    const tgPendingKey = `tg_pending_${replyToId}`;
                    const pending = state.pendingQuestions.get(tgPendingKey);
                    if (pending) {
                        clearTimeout(pending.timer);
                        state.pendingQuestions.delete(tgPendingKey);
                        state.staffEngaged.set(`${pending.userId}::${channelId}`, Date.now());
                        console.log(`[TG] Staff replied — cancelled pending timer for msg ${replyToId}`);
                    } else {
                        // Staff replied to a non-pending message — still mark engagement
                        const repliedToFrom = msg.reply_to_message?.from;
                        if (repliedToFrom && !repliedToFrom.is_bot) {
                            const targetUserId = `tg_${repliedToFrom.id}`;
                            state.staffEngaged.set(`${targetUserId}::${channelId}`, Date.now());
                            console.log(`[TG] Staff engaged with ${targetUserId}`);
                        }
                    }
                }
                return; // Never auto-reply to staff messages
            }

            // Staff-engaged suppression — back off if staff is handling this user
            const staffTs = state.staffEngaged.get(key);
            if (staffTs && (Date.now() - staffTs) < state.STAFF_ENGAGED_WINDOW_MS) {
                console.log(`[TG] Suppressed — staff engaged with ${userId} recently`);
                return;
            }

            // Intent gate
            const intent = await classifyMessageIntent(text, null);
            logTelegramIntent(msg.message_id, intent);
            console.log(`[TG] Intent: ${intent} | user: ${userId} | topic: ${threadId}`);
            if (!RESPOND_INTENTS.has(intent)) return;

            // Staff-wait timer — queue the reply, cancel if an admin responds first
            const tgPendingKey = `tg_pending_${msg.message_id}`;
            const timer = setTimeout(async () => {
                if (!state.pendingQuestions.has(tgPendingKey)) return;
                state.pendingQuestions.delete(tgPendingKey);
                const target = makeTgTarget(ctx, msg.chat.id, threadId, msg.message_id);
                await answerQuestion({ question: text, targetMessage: target, userId, channelId });
            }, state.STAFF_WAIT_MS);

            state.pendingQuestions.set(tgPendingKey, { question: text, userId, channelId, timer, storedAt: Date.now() });
            console.log(`[TG] Queued ${tgPendingKey} — fires in ${state.STAFF_WAIT_MS / 1000}s if no admin reply`);

        } catch (err) {
            console.error('[TG] Handler error:', err.message);
        }
    });

    // ── Join / leave tracking ─────────────────────────────────────────────────
    // Requires the bot to be an admin and 'chat_member' in allowedUpdates.
    // Telegram does not deliver these events to regular members.

    const ACTIVE_STATUSES = new Set(['member', 'administrator', 'creator', 'restricted']);
    const GONE_STATUSES   = new Set(['left', 'kicked']);

    bot.on('chat_member', (ctx) => {
        try {
            const update = ctx.update.chat_member;
            if (String(update.chat.id) !== chatIdStr) return;

            const oldStatus = update.old_chat_member.status;
            const newStatus = update.new_chat_member.status;
            const user      = update.new_chat_member.user;

            if (GONE_STATUSES.has(oldStatus) && ACTIVE_STATUSES.has(newStatus)) {
                logTgMemberEvent('join', user, update.chat.id);
                console.log(`[TG] Member joined: ${user.username ?? user.id}`);
            } else if (ACTIVE_STATUSES.has(oldStatus) && GONE_STATUSES.has(newStatus)) {
                logTgMemberEvent('leave', user, update.chat.id);
                console.log(`[TG] Member left: ${user.username ?? user.id}`);
            }
        } catch (err) {
            console.error('[TG] chat_member handler error:', err.message);
        }
    });

    return {
        launch:           ()       => bot.launch({ allowedUpdates: ['message', 'chat_member'] }),
        stop:             (signal) => bot.stop(signal),
        getMemberCount:   ()       => bot.telegram.getChatMembersCount(allowedChatId),
    };
}

module.exports = { createTelegramAdapter };

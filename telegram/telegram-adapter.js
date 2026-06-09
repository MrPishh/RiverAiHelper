'use strict';

const { Telegraf }  = require('telegraf');
const { isEnabled } = require('../src/toggles');
const { logTgMemberEvent } = require('../weekly-report/member-stats/telegram/tg-member-stats');

// ─── Telegram markdown sanitiser ─────────────────────────────────────────────

const GUILD_ID = '1212686319596216350';

function sanitizeForTelegram(text) {
    return text
        .replace(/\*\*(.*?)\*\*/gs, '$1')
        .replace(/\*(.*?)\*/gs, '$1')
        .replace(/<(https?:\/\/[^\s>]+)>/g, '$1')
        .replace(/<#(\d+)>/g, (_, channelId) => `https://discord.com/channels/${GUILD_ID}/${channelId}`)
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

// ─── Message splitter ─────────────────────────────────────────────────────────

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

// ─── Factory ──────────────────────────────────────────────────────────────────

function createTelegramAdapter({
    token,
    allowedChatId,
    allowedTopicIds,
    logOnlyTopicIds = [],
    state,
    answerQuestion,
    searchKB,
    classifyMessageIntent,
    logTelegramMessage,
    logTelegramIntent,
    RESPOND_INTENTS,
    looksResolved,
    SUPPORT_CHANNEL_ID,
    buildCommunityReport,
    getMemberStats,
    getTgMemberStats,
    getWeekRange,
    getDayRange,
    getDiscordMemberCount,
}) {
    const bot            = new Telegraf(token);
    const chatIdStr      = String(allowedChatId);
    const topicSet       = new Set(allowedTopicIds.map(String));
    const logOnlyTopicSet = new Set(logOnlyTopicIds.map(String));
    let botId       = null;
    let botUsername = null;

    bot.telegram.getMe().then(me => {
        botId       = me.id;
        botUsername = me.username;
        console.log(`[TG] Bot identity: @${botUsername} (${botId})`);
    }).catch(err => console.error('[TG] getMe failed:', err.message));

    // Persistent menu button — shows "≡ Menu" in every private DM.
    // Tapping it opens the command list where staff can tap /start to open the panel.
    bot.telegram.setMyCommands(
        [{ command: 'start', description: 'Open Staff Panel' }],
        { scope: { type: 'all_private_chats' } }
    ).catch(err => console.error('[TG] setMyCommands failed:', err.message));

    bot.telegram.setChatMenuButton({
        menu_button: { type: 'commands' }
    }).catch(err => console.error('[TG] setChatMenuButton failed:', err.message));

    // ── Private DM handler ────────────────────────────────────────────────────

    async function handlePrivateDM(ctx, msg) {
        const fromId = msg.from.id;
        const admin  = await isAdmin(ctx.telegram, chatIdStr, fromId);

        if (!admin) {
            await ctx.reply('This bot is for staff use only.');
            return;
        }

        if (msg.text?.trim() === '/start') {
            await ctx.reply('Staff Panel — what would you like to do?', {
                reply_markup: { inline_keyboard: [[
                    { text: '📊 Community Report', callback_data: 'report' },
                    { text: '👥 Member Stats',     callback_data: 'stats'  },
                ]] },
            });
            return;
        }

        await ctx.reply('Send /start to open the staff panel.');
    }

    // ── Inline keyboard callback handler ─────────────────────────────────────

    bot.on('callback_query', async (ctx) => {
        try {
            const fromId = ctx.callbackQuery.from.id;
            const admin  = await isAdmin(ctx.telegram, chatIdStr, fromId);
            if (!admin) { await ctx.answerCbQuery('Staff only.'); return; }

            const data  = ctx.callbackQuery.data ?? '';
            const parts = data.split(':');
            const [action, period, platform, modelKey] = parts;

            const PERIOD_LABEL   = { week: 'Week (Mon–Sun)', day: 'Today' };
            const PLATFORM_LABEL = { both: 'Both', discord: 'Discord only', telegram: 'Telegram only' };

            // ── Step 1: choose period ─────────────────────────────────────────
            if (parts.length === 1) {
                const label = action === 'report' ? '📊 Community Report' : '👥 Member Stats';
                await ctx.editMessageText(`${label}\n\nSelect period:`, {
                    reply_markup: { inline_keyboard: [[
                        { text: 'Week (Mon–Sun)', callback_data: `${action}:week` },
                        { text: 'Today',          callback_data: `${action}:day`  },
                    ]] },
                });
                await ctx.answerCbQuery();
                return;
            }

            // ── Step 2: choose platform ───────────────────────────────────────
            if (parts.length === 2) {
                const label = action === 'report' ? '📊 Community Report' : '👥 Member Stats';
                await ctx.editMessageText(`${label} · ${PERIOD_LABEL[period]}\n\nSelect platform:`, {
                    reply_markup: { inline_keyboard: [[
                        { text: 'Both',          callback_data: `${data}:both`     },
                        { text: 'Discord only',  callback_data: `${data}:discord`  },
                        { text: 'Telegram only', callback_data: `${data}:telegram` },
                    ]] },
                });
                await ctx.answerCbQuery();
                return;
            }

            // ── Step 3 (report only): choose AI model ─────────────────────────
            if (parts.length === 3 && action === 'report') {
                await ctx.editMessageText(
                    `📊 Community Report · ${PERIOD_LABEL[period]} · ${PLATFORM_LABEL[platform]}\n\nSelect AI model:`, {
                    reply_markup: { inline_keyboard: [[
                        { text: '⚡ Haiku (fast)',    callback_data: `${data}:haiku`  },
                        { text: '🧠 Sonnet (smarter)', callback_data: `${data}:sonnet` },
                    ]] },
                });
                await ctx.answerCbQuery();
                return;
            }

            // ── Generate stats (stats:period:platform) ────────────────────────
            if (parts.length === 3 && action === 'stats') {
                await ctx.answerCbQuery('Fetching stats…');
                await ctx.editMessageText(`👥 Member Stats · ${PERIOD_LABEL[period]} · ${PLATFORM_LABEL[platform]}\n\n⏳ Fetching…`);

                try {
                    const { from, to } = period === 'day' ? getDayRange() : getWeekRange();
                    const lines = [`👥 Member Stats — ${PERIOD_LABEL[period]}`];

                    if (platform === 'discord' || platform === 'both') {
                        const { joins, leaves } = getMemberStats(from, to);
                        const total = getDiscordMemberCount();
                        if (platform === 'both') lines.push('\nDiscord');
                        lines.push(`Total members: ${total}`);
                        lines.push(`Joined: ${joins}`);
                        lines.push(`Left: ${leaves}`);
                    }

                    if (platform === 'telegram' || platform === 'both') {
                        const { joins, leaves } = getTgMemberStats(from, to);
                        const total = await ctx.telegram.getChatMembersCount(chatIdStr).catch(() => '?');
                        if (platform === 'both') lines.push('\nTelegram');
                        lines.push(`Total members: ${total}`);
                        lines.push(`Joined: ${joins}`);
                        lines.push(`Left: ${leaves}`);
                    }

                    await ctx.editMessageText(lines.join('\n'));
                } catch (err) {
                    console.error('[TG DM] Stats error:', err.message);
                    await ctx.editMessageText('❌ Failed to fetch stats. Please try again.');
                }
                return;
            }

            // ── Generate report (report:period:platform:model) ────────────────
            if (parts.length === 4 && action === 'report') {
                await ctx.answerCbQuery('Generating report…');
                await ctx.editMessageText(
                    `📊 Community Report · ${PERIOD_LABEL[period]} · ${PLATFORM_LABEL[platform]} · ${modelKey === 'sonnet' ? 'Sonnet' : 'Haiku'}\n\n⏳ Generating…`
                );

                try {
                    const reportType = period === 'day' ? 'daily' : 'weekly';
                    const result = await buildCommunityReport({ platform, reportType, model: modelKey });

                    if (!result.text) {
                        await ctx.editMessageText('No user messages found for this period.');
                        return;
                    }

                    const { text, dc, tg } = result;
                    const countLine = [
                        dc                        ? `${dc.general.length + dc.support.length} Discord` : null,
                        result.tickets?.length > 0 ? `${result.tickets.length} Tickets`               : null,
                        tg                        ? `${tg.length} Telegram`                           : null,
                        result.dcChinese?.length > 0 ? `${result.dcChinese.length} Chinese (Discord)` : null,
                        result.tgChinese?.length > 0 ? `${result.tgChinese.length} Chinese (Telegram)`: null,
                    ].filter(Boolean).join(' + ');

                    const typeLabel = period === 'week' ? 'Weekly' : 'Daily';
                    const header = `📊 ${typeLabel} Community Report (${PLATFORM_LABEL[platform]})\n(${countLine} messages analysed)\n\n`;
                    const full   = header + text;

                    await ctx.editMessageText('✅ Report ready:');
                    for (const chunk of splitMessage(full)) {
                        await ctx.reply(chunk);
                    }
                } catch (err) {
                    console.error('[TG DM] Report error:', err.message);
                    await ctx.editMessageText('❌ Failed to generate report. Please try again.');
                }
                return;
            }

            await ctx.answerCbQuery();
        } catch (err) {
            console.error('[TG DM] Callback error:', err.message);
            try { await ctx.answerCbQuery('Something went wrong.'); } catch {}
        }
    });

    // ── Group message handler ─────────────────────────────────────────────────

    bot.on('message', async (ctx) => {
        try {
            const msg = ctx.message;
            if (!msg?.text?.trim()) return;

            // Private DM — hand off to staff panel handler
            if (msg.chat.type === 'private') {
                await handlePrivateDM(ctx, msg);
                return;
            }

            if (String(msg.chat.id) !== chatIdStr) return;

            const threadId = msg.message_thread_id ?? null;

            // Log-only topics (e.g. Chinese channel) — record message but never respond
            if (logOnlyTopicSet.size > 0 && logOnlyTopicSet.has(String(threadId ?? ''))) {
                if (!isEnabled('telegram')) return;
                const logText = msg.text?.trim();
                if (!logText) return;
                const fromId = msg.from.id;
                const staff  = await isAdmin(ctx.telegram, chatIdStr, fromId);
                logTelegramMessage(msg, staff);
                return;
            }

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

            // Self-resolution — cancel pending timer if user signals they're sorted
            for (const [msgId, pending] of state.pendingQuestions) {
                if (pending.userId === userId && pending.channelId === channelId && looksResolved(text)) {
                    clearTimeout(pending.timer);
                    state.pendingQuestions.delete(msgId);
                    console.log(`[TG] Cancelled ${msgId} — user ${userId} signalled self-resolution`);
                    break;
                }
            }

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

            if (replyToId && botId && msg.reply_to_message?.from?.id === botId && !staff && text.trim().split(/\s+/).length > 1) {
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
                if (intent === 'staff-ping') {
                    const target = makeTgTarget(ctx, msg.chat.id, threadId, msg.message_id);
                    await target.reply(`For ticket or account-specific issues, please reach out to the team directly in <#${SUPPORT_CHANNEL_ID}> — I'm not able to check ticket status or escalate to staff.`);
                    return;
                }
                // Direct @mention → always answer, same as Discord Scenario 1.
                // Non-RESPOND_INTENTS still reach answerQuestion; Claude handles them gracefully.
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

            // Community step-in — classify reply before intent gate; reuse result in Scenario 3
            let cachedIntent = null;
            if (replyToId) {
                const tgRefKey = `tg_pending_${replyToId}`;
                const pendingForRef = state.pendingQuestions.get(tgRefKey);
                if (pendingForRef && pendingForRef.userId !== userId) {
                    cachedIntent = await classifyMessageIntent(text, null);
                    logTelegramIntent(msg.message_id, cachedIntent);
                    if (cachedIntent === 'community-help') {
                        clearTimeout(pendingForRef.timer);
                        state.pendingQuestions.delete(tgRefKey);
                        console.log(`[TG] Cancelled ${tgRefKey} — genuine community-help from ${userId}`);
                    } else {
                        console.log(`[TG] Kept timer for ${tgRefKey} — reply is '${cachedIntent}', not genuine help`);
                    }
                }
            }

            // Staff-engaged suppression — back off if staff is handling this user
            const staffTs = state.staffEngaged.get(key);
            if (staffTs && (Date.now() - staffTs) < state.STAFF_ENGAGED_WINDOW_MS) {
                console.log(`[TG] Suppressed — staff engaged with ${userId} recently`);
                return;
            }

            // Prior community-discussion context
            const convDiscKey = `${userId}::${channelId}`;
            let priorUserContext = null;
            const discEntry = state.recentCommunityDiscussion.get(convDiscKey);
            if (discEntry) {
                if ((Date.now() - discEntry.storedAt) < state.COMMUNITY_DISC_WINDOW_MS) {
                    priorUserContext = discEntry.content;
                } else {
                    state.recentCommunityDiscussion.delete(convDiscKey);
                }
            }

            // Intent gate
            const intent = cachedIntent ?? await classifyMessageIntent(text, null, priorUserContext);
            if (!cachedIntent) logTelegramIntent(msg.message_id, intent);
            console.log(`[TG] Intent: ${intent} | user: ${userId} | topic: ${threadId}${priorUserContext ? ' (with prior context)' : ''}`);

            if (intent === 'staff-ping') {
                const target = makeTgTarget(ctx, msg.chat.id, threadId, msg.message_id);
                await target.reply(`For ticket or account-specific issues, please reach out to the team directly in <#${SUPPORT_CHANNEL_ID}> — I'm not able to check ticket status or escalate to staff.`);
                return;
            }

            if (!RESPOND_INTENTS.has(intent)) {
                if (intent === 'community-discussion') {
                    state.recentCommunityDiscussion.set(convDiscKey, {
                        content:   text.slice(0, 200),
                        messageId: msg.message_id,
                        storedAt:  Date.now(),
                    });
                }
                console.log(`[TG] Skipped — intent '${intent}' does not warrant a response`);
                return;
            }

            if (priorUserContext) state.recentCommunityDiscussion.delete(convDiscKey);

            // staffEngaged entry exists but window expired — use shorter wait for 20 min after staff engagement
            const postStaff = staffTs && (Date.now() - staffTs) < state.POST_STAFF_CONTEXT_MS;
            const waitMs = postStaff ? state.POST_STAFF_WAIT_MS : state.STAFF_WAIT_MS;

            // Staff-wait timer — queue the reply, cancel if an admin responds first
            const tgPendingKey = `tg_pending_${msg.message_id}`;
            const timer = setTimeout(async () => {
                if (!state.pendingQuestions.has(tgPendingKey)) return;
                state.pendingQuestions.delete(tgPendingKey);
                const target = makeTgTarget(ctx, msg.chat.id, threadId, msg.message_id);
                await answerQuestion({ question: text, targetMessage: target, userId, channelId });
            }, waitMs);

            state.pendingQuestions.set(tgPendingKey, { question: text, userId, channelId, timer, storedAt: Date.now() });
            console.log(`[TG] Queued ${tgPendingKey} — fires in ${waitMs / 1000}s${postStaff ? ' (post-staff, shortened)' : ''} if no admin reply`);

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
        launch:           ()       => bot.launch({ allowedUpdates: ['message', 'chat_member', 'callback_query'] }),
        stop:             (signal) => bot.stop(signal),
        getMemberCount:   ()       => bot.telegram.getChatMembersCount(allowedChatId),
    };
}

module.exports = { createTelegramAdapter };

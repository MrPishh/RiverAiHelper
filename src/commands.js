'use strict';

/* ─── About this file ─────────────────────────────────────────────────────────
 * The Discord messageCreate handler: ticket/collab logging gate, name-spoof
 * detector (Layer 3), staff text commands (!add-blog-text, !add-doc-text), the
 * @bot explanation embed, knowledge capture, Q&A learning, and answer routing
 * (Scenarios 0, 0.5, 1, 2, 3). Also takeScamAction (delete + escalating timeout +
 * alert) used by every scenario that detects scam content.
 * Exports: registerMessageHandler
 * ────────────────────────────────────────────────────────────────────────── */

// ─── Setup ────────────────────────────────────────────────────────────────────

const fs       = require('fs');
const path     = require('path');
// Project root — knowledge-base/ paths are built from it.
const ROOT_DIR = path.join(__dirname, '..');
const { isEnabled } = require('./toggles');

// ─── Message handler factory ─────────────────────────────────────────────────

// Factory — binds discordClient, state, config, and sub-modules to the message handler.
function registerMessageHandler(discordClient, state, config, modules) {
    const {
        ANNOUNCEMENTS_CHANNEL_ID,
        TWEETS_CHANNEL_ID,
        GENERAL_CHANNEL_ID,
        SUPPORT_CHANNEL_ID,
        STAFF_EXPLANATION_CHANNEL_ID,
        BOT_ANSWER_CHANNEL_IDS,
        STAFF_ROLE_IDS,
        SUPPORT_TICKET_CATEGORY_IDS,
        COLLAB_CATEGORY_IDS,
        CHINESE_DISCORD_CHANNEL_ID,
        SCAM_LOG_CHANNEL_ID,
    } = config;

    const {
        claude:  { answerQuestion, identifyRelevantSources },
        intent:  { classifyMessageIntent, logMessageIntent, logIntentClassification, RESPOND_INTENTS, logToTicketFile, logToCollabFile },
        kbSync:  { registerBlogInIndex, registerDocInIndex },
        utils:   { isStaff, isBotMentioned, stripBotMention, looksResolved, trackerKey, getMonthLabel, ensureDir, appendToMonthlyWeeklyFile, saveQAPair, looksLikeSpoofedName, looksLikeHelperOffer },
        buildIndex,
        searchKB,
        htmlToMarkdown,
        EmbedBuilder,
        scamTracker,
    } = modules;

    // ─── Timed auto-answer ────────────────────────────────────────────────────

    // Cancels a pending Scenario 3 batch (timer + both index entries) without answering it.
    function cancelPendingBatch(key) {
        const pending = state.pendingQuestions.get(key);
        if (!pending) return null;
        clearTimeout(pending.timer);
        state.pendingQuestions.delete(key);
        for (const m of pending.messages) state.pendingMsgIndex.delete(m.id);
        return pending;
    }

    // Fires the batched answer for a pending Scenario 3 entry — merges all messages the
    // user sent while the timer was pending into one combined question/answer instead of
    // answering each separately.
    async function fireAutoAnswer(key) {
        const pending = state.pendingQuestions.get(key);
        if (!pending) return;
        state.pendingQuestions.delete(key);
        for (const m of pending.messages) state.pendingMsgIndex.delete(m.id);

        const { userId, channelId, lastMessage } = pending;
        const combined = pending.messages.map(m => m.content).filter(c => c.trim()).join('\n');
        if (!combined.trim()) {
            console.log(`[AutoAnswer] Skipped batch for ${userId} — empty content`);
            return;
        }

        const recentConv = state.conversationState.get(key);
        if (recentConv?.isAnswered && (Date.now() - recentConv.lastActivity) < state.CONV_EXPIRY_MS) {
            const { context: newContext, sources: newSources } = await searchKB(combined);
            const updatedHistory = [
                ...recentConv.history,
                { role: 'user', content: `Relevant context:\n${newContext}\n\nFollow-up: ${combined}` },
            ];
            console.log(`[AutoAnswer] Resuming prior context for ${userId} (${pending.messages.length} message(s) batched)`);
            await answerQuestion({ question: combined, targetMessage: lastMessage, userId, channelId, existingHistory: updatedHistory, ragSources: newSources });
        } else {
            console.log(`[AutoAnswer] Answering batch for ${userId} (${pending.messages.length} message(s))`);
            await answerQuestion({ question: combined, targetMessage: lastMessage, userId, channelId });
        }
    }

    // Scenario 3: queues an auto-answer after the staff-wait timer, or folds the message into
    // the user's already-pending batch.
    function scheduleAutoAnswer(message) {
        const { id: msgId, content: question, author: { id: userId }, channelId } = message;
        const key = trackerKey(userId, channelId);

        // Check staffEngaged BEFORE folding into an existing batch — staff can engage a user
        // via a path that doesn't touch that user's current pending batch (e.g. replying to an
        // older, non-pending message), so an existing batch alone doesn't prove staff hasn't
        // just engaged. Re-checking here every time keeps the hard-block authoritative.
        const staffTs = state.staffEngaged.get(key);
        if (staffTs && (Date.now() - staffTs) < state.STAFF_ENGAGED_WINDOW_MS) {
            console.log(`[AutoAnswer] Skipped ${msgId} — staff engaged with ${userId} recently`);
            return;
        }

        const existing = state.pendingQuestions.get(key);
        if (existing) {
            // Same user posted again before their prior pending message(s) were answered —
            // fold into the same batch. The original timer/deadline is left untouched, so a
            // burst of messages still produces exactly one combined answer, not a longer wait.
            existing.messages.push({ id: msgId, content: question, ts: Date.now() });
            existing.lastMessage = message;
            state.pendingMsgIndex.set(msgId, key);
            console.log(`[AutoAnswer] Merged ${msgId} into pending batch for ${userId} (${existing.messages.length} message(s) now)`);
            return;
        }

        // staffEngaged entry exists but window expired — use shorter wait for 20 min after staff engagement
        const postStaff = staffTs && (Date.now() - staffTs) < state.POST_STAFF_CONTEXT_MS;
        const waitMs = postStaff ? state.POST_STAFF_WAIT_MS : state.STAFF_WAIT_MS;

        const timer = setTimeout(() => fireAutoAnswer(key), waitMs);

        state.pendingQuestions.set(key, {
            messages:    [{ id: msgId, content: question, ts: Date.now() }],
            userId, channelId, timer,
            lastMessage: message,
            storedAt:    Date.now(),
        });
        state.pendingMsgIndex.set(msgId, key);
        console.log(`[AutoAnswer] Queued ${msgId} — fires in ${waitMs / 1000}s${postStaff ? ' (post-staff, shortened)' : ''} if no staff reply`);
    }

    // ─── Explanation embed ────────────────────────────────────────────────────

    // Staff "@bot <message link>": posts an embed to the staff channel showing the question,
    // the answer and which KB sources were used.
    async function sendExplanationEmbed({ requestMessage, linkGuildId, linkChannelId, botMessageId }) {
        if (!STAFF_EXPLANATION_CHANNEL_ID) {
            await requestMessage.reply('No explanation channel is configured.');
            return;
        }

        try {
            console.log(`[Explain] Step 1 — resolving channel ${linkChannelId}`);
            const sourceChannel = discordClient.channels.cache.get(linkChannelId)
                ?? await discordClient.channels.fetch(linkChannelId);

            if (!sourceChannel?.isTextBased()) {
                await requestMessage.reply("I can't access that channel.");
                return;
            }
            console.log(`[Explain] Step 1 — OK: #${sourceChannel.name}`);

            console.log(`[Explain] Step 2 — fetching message ${botMessageId}`);
            const botMessage = sourceChannel.messages.cache.get(botMessageId)
                ?? await sourceChannel.messages.fetch(botMessageId);

            if (botMessage.author.id !== discordClient.user.id) {
                await requestMessage.reply("That message wasn't sent by me.");
                return;
            }
            console.log(`[Explain] Step 2 — OK`);

            const answer = botMessage.content;

            console.log(`[Explain] Step 3 — fetching original question`);
            let question = '*(original message not found or not a reply)*';
            let askedBy  = null;
            if (botMessage.reference?.messageId) {
                try {
                    const original = sourceChannel.messages.cache.get(botMessage.reference.messageId)
                        ?? await sourceChannel.messages.fetch(botMessage.reference.messageId);
                    question = original.content;
                    askedBy  = original.author.id;
                } catch (e) {
                    console.warn(`[Explain] Step 3 — original message fetch failed: ${e.message}`);
                }
            }
            console.log(`[Explain] Step 3 — OK`);

            const ragEntry = state.ragSourcesMap.get(botMessage.id);
            const sources = ragEntry
                ? (ragEntry.sources.join('\n') || 'general knowledge base')
                : (identifyRelevantSources(question).join(', ') || 'general knowledge base');

            console.log(`[Explain] Step 4 — sending embed to staff channel ${STAFF_EXPLANATION_CHANNEL_ID}`);
            const staffCh = discordClient.channels.cache.get(STAFF_EXPLANATION_CHANNEL_ID)
                ?? await discordClient.channels.fetch(STAFF_EXPLANATION_CHANNEL_ID);
            if (!staffCh?.isTextBased()) return;

            // Field values are cut to 1020 characters: Discord rejects an embed field longer than 1024.
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('Bot Answer Explanation')
                .addFields(
                    { name: 'Channel',            value: `<#${linkChannelId}>`,                 inline: true },
                    { name: 'Asked By',            value: askedBy ? `<@${askedBy}>` : 'Unknown', inline: true },
                    { name: 'Answered At',         value: botMessage.createdAt.toISOString(),    inline: true },
                    { name: 'Original Question',   value: question.slice(0, 1020) },
                    { name: 'Knowledge Sources Used', value: sources.slice(0, 1020) },
                    { name: 'Answer Given',        value: answer.slice(0, 1020) },
                )
                .setFooter({ text: `Requested by ${requestMessage.author.tag}` })
                .setTimestamp();

            await staffCh.send({ embeds: [embed] });
            await requestMessage.reply(`Explanation sent to <#${STAFF_EXPLANATION_CHANNEL_ID}>.`);
        } catch (err) {
            console.error('[StaffLog] Failed to send explanation:', err.message);
            await requestMessage.reply(`Failed to fetch that message: ${err.message}`);
        }
    }

    // ─── Scam blocker ─────────────────────────────────────────────────────────
    // Deletes the message, issues a 1-hour timeout, and posts an alert embed.
    // No-ops silently when the scam-blocker toggle is OFF — detection still logs.

    const SCAM_TIMEOUT_BASE_MS = 60 * 60 * 1000; // 1 hour — base unit for escalation
    const SCAM_TIMEOUT_MAX_MS  = 28 * 24 * 60 * 60 * 1000; // 28 days — Discord hard cap

    // Timeout for the Nth infraction: N hours, capped at 28 days.
    function escalatedTimeoutMs(nextCount) {
        return Math.min(nextCount * SCAM_TIMEOUT_BASE_MS, SCAM_TIMEOUT_MAX_MS);
    }

    // Human-readable timeout length, e.g. "3h timeout" or "1d 2h timeout".
    function formatTimeoutLabel(ms) {
        const totalHours = Math.round(ms / SCAM_TIMEOUT_BASE_MS);
        if (totalHours < 24) return `${totalHours}h timeout`;
        const days  = Math.floor(totalHours / 24);
        const hours = totalHours % 24;
        return hours > 0 ? `${days}d ${hours}h timeout` : `${days}d timeout`;
    }

    // Records the infraction, deletes the message, times the member out and posts an alert embed.
    // Does nothing when the scam-blocker toggle is OFF (detection is still logged by the caller).
    async function takeScamAction(message, member, reason) {
        if (!isEnabled('scam-blocker')) return;

        // Record the infraction FIRST — recordInfraction() is a synchronous read-modify-write
        // (no await in between reading the existing count and writing the new one), so calling
        // it before any of the async work below makes the count used for escalation atomic
        // relative to other concurrent takeScamAction calls for the same user. Previously the
        // count came from a separate getRecord() call made before the awaits, leaving a window
        // where two near-simultaneous scam messages from the same user could both read the same
        // starting count and apply the same (under-escalated) timeout instead of the second one
        // stepping up. `actions` is filled in with the real outcome afterward via
        // updateLastInfractionActions() — that part isn't escalation-sensitive.
        const infractionCount = scamTracker.recordInfraction(message.author.id, {
            reason,
            content:   message.content,
            channelId: message.channelId,
            actions:   '(pending)',
            tag:       message.author.tag ?? message.author.username,
        });
        const timeoutMs = escalatedTimeoutMs(infractionCount);

        const actions = [];

        try {
            await message.delete();
            actions.push('msg deleted');
        } catch (err) {
            console.warn(`[ScamBlock] Delete failed (${message.id}): ${err.message}`);
            actions.push('delete failed');
        }

        if (member) {
            try {
                await member.timeout(timeoutMs, `Scam blocker: ${reason}`.slice(0, 512));
                actions.push(formatTimeoutLabel(timeoutMs));
            } catch (err) {
                console.warn(`[ScamBlock] Timeout failed (${member.id}): ${err.message}`);
                actions.push('timeout failed — check bot role hierarchy + Moderate Members perm');
            }
        } else {
            actions.push('member not resolved — timeout skipped');
        }

        const actionsStr = actions.join(' · ');
        scamTracker.updateInfractionActions(message.author.id, infractionCount, actionsStr);
        console.log(`[ScamBlock] ${message.author?.tag ?? message.author?.id} | ${reason} | ${actionsStr}`);

        if (!SCAM_LOG_CHANNEL_ID) return;
        try {
            const ch = discordClient.channels.cache.get(SCAM_LOG_CHANNEL_ID)
                ?? await discordClient.channels.fetch(SCAM_LOG_CHANNEL_ID);
            if (!ch?.isTextBased()) return;
            const isRepeat   = infractionCount > 1;
            const countLabel = isRepeat
                ? `⚠️ **${infractionCount} — REPEAT OFFENDER**`
                : `1 (first offence)`;
            await ch.send({ embeds: [
                new EmbedBuilder()
                    .setColor(isRepeat ? 0xFF0000 : 0xFF3333)
                    .setTitle(isRepeat ? '🚨 Scam Blocker — REPEAT OFFENDER' : '🚨 Scam Blocker')
                    .addFields(
                        { name: 'User',        value: `<@${message.author.id}> (${message.author.tag ?? message.author.username})`, inline: true },
                        { name: 'Channel',     value: `<#${message.channelId}>`, inline: true },
                        { name: 'Infractions', value: countLabel, inline: false },
                        { name: 'Detection',   value: reason, inline: false },
                        { name: 'Message',     value: (message.content || '*(empty)*').slice(0, 1020) },
                        { name: 'Actions',     value: actionsStr },
                    )
                    .setTimestamp(),
            ]});
        } catch (err) {
            console.warn(`[ScamBlock] Alert send failed: ${err.message}`);
        }
    }

    // ─── Message handler ──────────────────────────────────────────────────────

    discordClient.on('messageCreate', async (message) => {
        try {
        if (message.author.bot) return;
        if (!message.guild) return;

        const { content, channelId, author: { id: userId } } = message;
        const botUserId = discordClient.user.id;

        const member = message.member
            ?? await message.guild.members.fetch(userId).catch(() => null);
        const staff        = isStaff(member, STAFF_ROLE_IDS);
        const botMentioned = isBotMentioned(message, botUserId);

        // Ticket/collab channel — log immediately, never respond.
        // Classification happens at report time when the full thread is available.
        const ticketCatSet = SUPPORT_TICKET_CATEGORY_IDS ?? new Set();
        const collabCatSet = COLLAB_CATEGORY_IDS ?? new Set();
        const parentId = message.channel?.parentId;
        if ((ticketCatSet.size && ticketCatSet.has(parentId)) || (collabCatSet.size && collabCatSet.has(parentId))) {
            if (!staff && content.trim()) {
                if (collabCatSet.has(parentId)) logToCollabFile(message);
                else logToTicketFile(message);
            }
            return;
        }

        // Log every human message in general, support, and Chinese channel for intent analysis
        if (channelId === GENERAL_CHANNEL_ID || channelId === SUPPORT_CHANNEL_ID ||
            (CHINESE_DISCORD_CHANNEL_ID && channelId === CHINESE_DISCORD_CHANNEL_ID)) {
            logMessageIntent(message, botUserId, staff);
        }

        // Spoof detection — name impersonation + DM-offer pattern
        // spoofMatch is kept in scope so scenario routing can pass it to classifyMessageIntent
        // if the helper-offer gate below doesn't fire (name matched but message wording didn't).
        // Runs for the Chinese channel too — scam blocking must not depend on answer language.
        let spoofMatch = null;
        if (!staff && state.staffNameCache.size > 0) {
            const senderDisplay = member?.displayName ?? message.author.username;
            spoofMatch = looksLikeSpoofedName(senderDisplay, state.staffNameCache);
            if (spoofMatch.matched && looksLikeHelperOffer(content)) {
                logIntentClassification(message.id, 'scam-content');
                console.warn(`[SpoofDetect] ${userId} ("${senderDisplay}") resembles staff "${spoofMatch.staffName}"`);
                await takeScamAction(message, member, `name-spoof: "${senderDisplay}" ≈ "${spoofMatch.staffName}"`);
                return;
            }
        }

        // Chinese channel — still runs scam-content classification (below), just never answers
        // Q&A or routes into the Scenario pipeline. Previously this returned before any
        // classification ran at all, which meant scam messages in this channel were never
        // caught by anything — fixed 2026-09-01 after scam links went unblocked here.
        if (CHINESE_DISCORD_CHANNEL_ID && channelId === CHINESE_DISCORD_CHANNEL_ID) {
            if (!staff && content.trim()) {
                const zhIntent = await classifyMessageIntent(content, message, null, spoofMatch);
                logIntentClassification(message.id, zhIntent);
                if (zhIntent === 'scam-content') {
                    await takeScamAction(message, member, 'scam-content (cn channel)');
                }
            }
            return;
        }

        // Self-resolution check
        const selfKey = trackerKey(userId, channelId);
        if (looksResolved(content) && state.pendingQuestions.has(selfKey)) {
            const cancelled = cancelPendingBatch(selfKey);
            console.log(`[AutoAnswer] Cancelled batch (${cancelled.messages.length} msg) — user ${userId} signalled self-resolution`);
        }

        // Community reply — only cancel timer for genuine community-help.
        // cachedIntent stores the result so Scenario 3 reuses it instead of calling the API again.
        let cachedIntent = null;
        if (!staff && message.reference?.messageId) {
            const refKey        = state.pendingMsgIndex.get(message.reference.messageId);
            const pendingForRef = refKey ? state.pendingQuestions.get(refKey) : null;
            if (pendingForRef && pendingForRef.userId !== userId) {
                cachedIntent = await classifyMessageIntent(content, message, null, spoofMatch);
                if (cachedIntent === 'community-help') {
                    cancelPendingBatch(refKey);
                    console.log(`[AutoAnswer] Cancelled batch for ${pendingForRef.userId} — genuine community-help from ${userId}`);
                } else {
                    console.log(`[AutoAnswer] Kept timer for ${pendingForRef.userId} — reply from ${userId} is '${cachedIntent}', not genuine help`);
                }
            }
        }

        // ── !add-blog-text <url> + attachment (no slash equivalent) ───────────
        // Manual blog add for Cloudflare-protected pages that can't be scraped directly.

        if (content.trim().startsWith('!add-blog-text')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }

            const url        = content.trim().slice('!add-blog-text'.length).trim();
            const attachment = message.attachments.find(a => /\.(txt|md|html?)$/i.test(a.name ?? ''));

            if (!url.startsWith('http')) {
                await message.reply(
                    '**Usage:** `!add-blog-text <url>` + attach a file\n\n' +
                    '**Recommended:** Install the **MarkDownload** browser extension, open the article, click the icon to download a `.md` file, then attach it here.\n' +
                    'Also accepts `.html` (browser "Save page as") or `.txt` (plain text paste).'
                );
                return;
            }

            if (!attachment) {
                await message.reply(
                    'No file attached. Please attach the article as a `.md`, `.html`, or `.txt` file.\n\n' +
                    '**Easiest:** Use the **MarkDownload** browser extension to export the page as `.md`.'
                );
                return;
            }

            const status = await message.reply(`Reading \`${attachment.name}\`…`);
            try {
                const fetch = (await import('node-fetch')).default;
                const res   = await fetch(attachment.url);
                if (!res.ok) throw new Error(`Could not download attachment: HTTP ${res.status}`);
                const raw   = await res.text();
                if (raw.trim().length < 50) throw new Error('File appears to be empty or too short.');

                const finalMarkdown = /\.html?$/i.test(attachment.name)
                    ? await htmlToMarkdown(raw, url)
                    : raw.trim();

                const month      = getMonthLabel();
                const folderName = `${month}_blog`;
                const blogDir    = path.join(ROOT_DIR, 'knowledge-base', 'blogs', folderName);
                ensureDir(blogDir);

                const existing  = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));
                const nextNum   = existing.length + 1;
                const filepath  = path.join(blogDir, `article${nextNum}.md`);
                fs.writeFileSync(
                    filepath,
                    `# Blog Article ${nextNum}\nSource: ${url}\nAdded: ${new Date().toISOString()}\n\n---\n\n${finalMarkdown}`,
                    'utf8'
                );
                registerBlogInIndex(url, `article${nextNum}`, `${folderName}/article${nextNum}.md`);
                await buildIndex();
                await status.edit(
                    `✅ Article saved as \`knowledge-base/blogs/${folderName}/article${nextNum}.md\` and knowledge base updated.`
                );
            } catch (err) {
                await status.edit(`❌ ${err.message}`);
            }
            return;
        }

        // ── !add-doc-text <url> + attachment (no slash equivalent) ────────────
        // Manual doc add for Cloudflare-protected pages that can't be scraped directly.

        if (content.trim().startsWith('!add-doc-text')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }

            const url        = content.trim().slice('!add-doc-text'.length).trim();
            const attachment = message.attachments.find(a => /\.(txt|md|html?)$/i.test(a.name ?? ''));

            if (!url.startsWith('http')) {
                await message.reply(
                    '**Usage:** `!add-doc-text <url>` + attach a file\n\n' +
                    'Install **MarkDownload**, open the doc page, download as `.md`, then attach it here.\n' +
                    'Also accepts `.html` (Save page as) or `.txt`.'
                );
                return;
            }

            if (!attachment) {
                await message.reply('No file attached. Please attach the page as a `.md`, `.html`, or `.txt` file.');
                return;
            }

            const status = await message.reply(`Reading \`${attachment.name}\`…`);
            try {
                const fetch = (await import('node-fetch')).default;
                const res   = await fetch(attachment.url);
                if (!res.ok) throw new Error(`Could not download attachment: HTTP ${res.status}`);
                const raw   = await res.text();
                if (raw.trim().length < 50) throw new Error('File appears to be empty or too short.');

                const finalMarkdown = /\.html?$/i.test(attachment.name)
                    ? await htmlToMarkdown(raw, url)
                    : raw.trim();

                const docsDir  = path.join(ROOT_DIR, 'knowledge-base', 'docs');
                ensureDir(docsDir);
                const slug     = new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'index';
                const filepath = path.join(docsDir, `${slug}.md`);
                fs.writeFileSync(
                    filepath,
                    `# Doc: ${slug}\nSource: ${url}\nAdded: ${new Date().toISOString()}\n\n---\n\n${finalMarkdown}`,
                    'utf8'
                );
                registerDocInIndex(url, slug, `${slug}.md`);
                await buildIndex();
                await status.edit(`✅ Saved as \`knowledge-base/docs/${slug}.md\` and knowledge base updated.`);
            } catch (err) {
                await status.edit(`❌ ${err.message}`);
            }
            return;
        }

        // ── @Bot explain (staff only) ─────────────────────────────────────────

        const explainLinkMatch = botMentioned
            ? content.match(/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/)
            : null;

        if (explainLinkMatch) {
            if (!staff) { await message.reply('Only staff members can request explanations.'); return; }
            await sendExplanationEmbed({
                requestMessage: message,
                linkGuildId:    explainLinkMatch[1],
                linkChannelId:  explainLinkMatch[2],
                botMessageId:   explainLinkMatch[3],
            });
            return;
        }

        // ── Knowledge-capture channels ────────────────────────────────────────

        if (channelId === ANNOUNCEMENTS_CHANNEL_ID) {
            appendToMonthlyWeeklyFile('announcements', content);
            return;
        }

        if (channelId === TWEETS_CHANNEL_ID) {
            appendToMonthlyWeeklyFile('tweets', content);
            return;
        }

        // ── Q&A learning (general + support) ─────────────────────────────────

        const isLearningChannel = channelId === GENERAL_CHANNEL_ID || channelId === SUPPORT_CHANNEL_ID;

        if (isLearningChannel) {
            const channelName = channelId === GENERAL_CHANNEL_ID ? 'general' : 'support';

            if (!staff) {
                state.recentQuestions.set(message.id, {
                    question: content,
                    userId,
                    channelName,
                    storedAt: Date.now(),
                });
            } else if (message.reference?.messageId) {
                const ref = state.recentQuestions.get(message.reference.messageId);
                if (ref && ref.channelName === channelName) {
                    saveQAPair(channelName, ref.question, content);
                    state.recentQuestions.delete(message.reference.messageId);
                }
            }
        }

        // ── Auto-answer channels only beyond this point ───────────────────────
        // @mentions are allowed anywhere; channel gate only applies to unprompted auto-answers

        if (!botMentioned && !BOT_ANSWER_CHANNEL_IDS.includes(channelId)) return;
        if (!isEnabled('discord')) return;

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 0 — User replied to the bot's clarifying question
        // ─────────────────────────────────────────────────────────────────────

        if (message.reference?.messageId && state.botMsgIndex.has(message.reference.messageId)) {
            const convKey      = state.botMsgIndex.get(message.reference.messageId);
            const conv         = state.conversationState.get(convKey);
            const [convUserId] = convKey.split('::');
            if (conv && conv.channelId === channelId && userId === convUserId) {
                const updatedHistory = [...conv.history, { role: 'user', content }];
                console.log(`[Trigger] Scenario 0 — conversation continuation for ${userId}`);
                await answerQuestion({ question: content, targetMessage: message, userId, channelId, existingHistory: updatedHistory });
                return;
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 0.5 — User replies to a regular bot ANSWER without mentioning
        // ─────────────────────────────────────────────────────────────────────

        if (!botMentioned && !staff && message.reference?.messageId && content.trim().split(/\s+/).length > 1) {
            try {
                const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
                if (referencedMsg.author.id === discordClient.user.id) {
                    // Being a reply to the bot's last message doesn't mean it's addressed to the bot —
                    // in a busy channel the bot's message may just be the most recent one. Gate on intent
                    // the same way Scenario 1/3 do, so agreement/venting/side-conversation isn't answered.
                    const intent05 = await classifyMessageIntent(content, message, null, spoofMatch);
                    logIntentClassification(message.id, intent05);

                    if (intent05 === 'scam-content') {
                        console.log(`[Trigger] Scenario 0.5 — scam-content from ${userId}`);
                        await takeScamAction(message, member, 'scam-content (Scenario 0.5)');
                        return;
                    }
                    if (intent05 === 'staff-ping') {
                        console.log(`[Trigger] Scenario 0.5 — staff-ping from ${userId}, redirecting`);
                        await message.reply(`For ticket or account-specific issues, please reach out to the team directly in <#${SUPPORT_CHANNEL_ID}> — I'm not able to check ticket status or escalate to staff.`);
                        return;
                    }
                    if (!RESPOND_INTENTS.has(intent05)) {
                        console.log(`[Trigger] Scenario 0.5 — skipped, intent '${intent05}' does not warrant a response`);
                        return;
                    }

                    const botAnswer = referencedMsg.content.replace(/\nSOURCES:.*$/s, '').trim();

                    let priorQuestion = '';
                    if (referencedMsg.reference?.messageId) {
                        try {
                            const orig = await message.channel.messages.fetch(referencedMsg.reference.messageId);
                            priorQuestion = orig.content;
                        } catch {}
                    }

                    const { context: newContext, sources: newSources } = await searchKB(content);
                    const history = [
                        ...(priorQuestion ? [{ role: 'user', content: priorQuestion }] : []),
                        { role: 'assistant', content: botAnswer },
                        { role: 'user', content: `Relevant context:\n${newContext}\n\nFollow-up: ${content}` },
                    ];

                    console.log(`[Trigger] Scenario 0.5 — follow-up reply from ${userId} (intent: ${intent05})`);
                    await answerQuestion({ question: content, targetMessage: message, userId, channelId, existingHistory: history, ragSources: newSources });
                    return;
                }
            } catch (err) {
                console.error('[Trigger] Scenario 0.5 error:', err.message);
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 1 — User directly @mentions the bot
        // ─────────────────────────────────────────────────────────────────────

        if (botMentioned && !message.reference) {
            const question = stripBotMention(content, botUserId);
            if (!question) return;

            const intent1 = await classifyMessageIntent(question, message, null, spoofMatch);
            logIntentClassification(message.id, intent1);

            if (intent1 === 'scam-content') {
                console.log(`[Trigger] Scenario 1 — scam-content from ${userId}`);
                await takeScamAction(message, member, 'scam-content (@mention)');
                return;
            }

            if (intent1 === 'staff-ping') {
                console.log(`[Trigger] Scenario 1 — staff-ping from ${userId}, redirecting`);
                await message.reply(`For ticket or account-specific issues, please reach out to the team directly in <#${SUPPORT_CHANNEL_ID}> — I'm not able to check ticket status or escalate to staff.`);
                return;
            }

            console.log(`[Trigger] Scenario 1 — direct mention by ${userId} (intent: ${intent1})`);
            await answerQuestion({ question, targetMessage: message, userId, channelId });
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 2 — @mention as a reply to an existing message
        // ─────────────────────────────────────────────────────────────────────

        if (botMentioned && message.reference?.messageId) {
            const ownQuestion = stripBotMention(content, botUserId);

            try {
                const originalMessage = await message.channel.messages.fetch(message.reference.messageId);

                // Replying to the bot's own message with added text — a personal follow-up,
                // there's no "original asker" to answer on behalf of.
                if (originalMessage.author.id === discordClient.user.id) {
                    if (!ownQuestion) return;

                    const intentSelf = await classifyMessageIntent(ownQuestion, message, null, spoofMatch);
                    logIntentClassification(message.id, intentSelf);

                    if (intentSelf === 'scam-content') {
                        console.log(`[Trigger] Scenario 2 — scam-content from ${userId} (mention+reply to bot)`);
                        await takeScamAction(message, member, 'scam-content (@mention+reply to bot)');
                        return;
                    }

                    if (intentSelf === 'staff-ping') {
                        console.log(`[Trigger] Scenario 2 — staff-ping from ${userId} (mention+reply to bot), redirecting`);
                        await message.reply(`For ticket or account-specific issues, please reach out to the team directly in <#${SUPPORT_CHANNEL_ID}> — I'm not able to check ticket status or escalate to staff.`);
                        return;
                    }

                    console.log(`[Trigger] Scenario 2 — mention+reply to bot with own question by ${userId} (intent: ${intentSelf})`);
                    await answerQuestion({ question: ownQuestion, targetMessage: message, userId, channelId });
                    return;
                }

                const askedBy = originalMessage.author.id;

                // Scam/staff-ping detection always checks the ORIGINAL message — that's the
                // post actually being replied to/answered for. Using any clarifying text the
                // mentioning user added instead would both miss scam content in the original
                // post and misattribute the mentioning user's own words to the original asker.
                const intent2 = await classifyMessageIntent(originalMessage.content, originalMessage);
                logIntentClassification(originalMessage.id, intent2);

                if (intent2 === 'scam-content') {
                    console.log(`[Trigger] Scenario 2 — scam-content in original message from ${askedBy}`);
                    const scamMember = originalMessage.member
                        ?? await message.guild.members.fetch(askedBy).catch(() => null);
                    await takeScamAction(originalMessage, scamMember, 'scam-content (via @mention reply)');
                    return;
                }

                if (intent2 === 'staff-ping') {
                    console.log(`[Trigger] Scenario 2 — original is staff-ping from ${askedBy}, redirecting`);
                    await message.reply(`For ticket or account-specific issues, the team can be reached directly in <#${SUPPORT_CHANNEL_ID}>.`);
                    return;
                }

                console.log(`[Trigger] Scenario 2 — reply mention, answering original from ${askedBy}${ownQuestion ? ' (staff-clarified question)' : ''} (intent: ${intent2})`);

                // For the ANSWER itself (not the moderation check above), prefer the mentioning
                // user's own clarifying text when present — it's usually a clearer restatement
                // of a vague original message.
                const question = ownQuestion || originalMessage.content;

                const refKeyS2 = state.pendingMsgIndex.get(message.reference.messageId);
                if (refKeyS2) {
                    cancelPendingBatch(refKeyS2);
                    console.log(`[AutoAnswer] Cancelled pending batch for ${askedBy}`);
                }

                // Thread the reply under whichever message makes sense to reply to: the
                // original vague message by default, or the mentioning user's own message
                // when they added their own clarified question (they'll often ping the
                // original asker separately to point them at the answer).
                const replyTarget = ownQuestion ? message : originalMessage;
                await answerQuestion({ question, targetMessage: replyTarget, userId: askedBy, channelId });
            } catch (err) {
                console.error('[Trigger] Could not fetch original message:', err.message);
            }
            return;
        }

        // ─────────────────────────────────────────────────────────────────────
        // SCENARIO 3 — No mention
        // ─────────────────────────────────────────────────────────────────────

        if (staff) {
            if (message.reference?.messageId) {
                const refKeyS3 = state.pendingMsgIndex.get(message.reference.messageId);
                const pending  = refKeyS3 ? state.pendingQuestions.get(refKeyS3) : null;
                if (pending) {
                    cancelPendingBatch(refKeyS3);
                    console.log(`[Scenario 3] Staff replied — cancelled batch for ${pending.userId}`);
                    state.staffEngaged.set(trackerKey(pending.userId, channelId), Date.now());
                } else {
                    message.channel.messages.fetch(message.reference.messageId).then(ref => {
                        if (ref && !ref.author.bot) {
                            state.staffEngaged.set(trackerKey(ref.author.id, channelId), Date.now());
                            console.log(`[StaffEngaged] Recorded staff engagement with ${ref.author.id}`);
                        }
                    }).catch(() => {});
                }
            } else {
                // Plain staff message (no reply) — treat as engagement with anyone
                // currently pending an auto-answer in this channel, so the bot
                // doesn't answer over staff who are actively handling it inline.
                for (const [key, pending] of state.pendingQuestions) {
                    if (pending.channelId !== channelId) continue;
                    cancelPendingBatch(key);
                    state.staffEngaged.set(trackerKey(pending.userId, channelId), Date.now());
                    console.log(`[StaffEngaged] Staff active in #${channelId} — cancelled pending auto-answer for ${pending.userId}`);
                }
            }
            return;
        }

        // ── Prior community-discussion context (Option 2 follow-up detection) ──
        const convDiscKey = trackerKey(userId, channelId);
        let priorUserContext = null;
        const discEntry = state.recentCommunityDiscussion.get(convDiscKey);
        if (discEntry) {
            if ((Date.now() - discEntry.storedAt) < state.COMMUNITY_DISC_WINDOW_MS) {
                priorUserContext = discEntry.content;
            } else {
                state.recentCommunityDiscussion.delete(convDiscKey);
            }
        }

        const intent3 = cachedIntent ?? await classifyMessageIntent(content, message, priorUserContext, spoofMatch);
        logIntentClassification(message.id, intent3);
        console.log(`[Intent] ${message.id} → ${intent3}${priorUserContext ? ' (with prior context)' : ''}`);

        if (!RESPOND_INTENTS.has(intent3)) {
            if (intent3 === 'scam-content') {
                console.log(`[Scenario 3] scam-content from ${userId}`);
                await takeScamAction(message, member, 'scam-content (Scenario 3)');
            } else if (intent3 === 'community-discussion') {
                state.recentCommunityDiscussion.set(convDiscKey, {
                    content:   content.slice(0, 200),
                    messageId: message.id,
                    storedAt:  Date.now(),
                });
                console.log(`[Scenario 3] Stored community-discussion for ${userId} — follow-up window open (30 min)`);
            }
            console.log(`[Scenario 3] Skipped — intent '${intent3}' does not warrant a response`);
            return;
        }

        if (priorUserContext) state.recentCommunityDiscussion.delete(convDiscKey);

        scheduleAutoAnswer(message);
        } catch (err) {
            console.error('[messageCreate] Unhandled error:', err);
        }
    });
}

module.exports = { registerMessageHandler };

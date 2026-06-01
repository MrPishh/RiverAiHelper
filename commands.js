'use strict';

const fs   = require('fs');
const path = require('path');
const { isEnabled, toggle, getStatus } = require('./toggles');

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
        REPORTS_CHANNEL_ID,
    } = config;

    const {
        claude:  { answerQuestion, identifyRelevantSources },
        intent:  { classifyMessageIntent, logMessageIntent, logIntentClassification, RESPOND_INTENTS },
        kbSync:  { syncBlog, syncDocs, registerBlogInIndex, registerDocInIndex, loadUsageStats, PRICE_INPUT, PRICE_OUTPUT, BLOG_SITEMAP_URL },
        utils:   { isStaff, isBotMentioned, stripBotMention, looksResolved, trackerKey, getMonthLabel, ensureDir, appendToMonthlyWeeklyFile, saveQAPair },
        monitor: { checkCorrectionStaleness, scanAnnouncementsForNewFacts },
        buildIndex,
        searchKB,
        scrapeSingleArticle,
        htmlToMarkdown,
        EmbedBuilder,
        loadCoreFacts,
        getWeeklyStats,
        generateCommunityReport,
    } = modules;

    // ─── Timed auto-answer ────────────────────────────────────────────────────

    function scheduleAutoAnswer(message) {
        const { id: msgId, content: question, author: { id: userId }, channelId } = message;
        const key = trackerKey(userId, channelId);

        const staffTs = state.staffEngaged.get(key);
        if (staffTs && (Date.now() - staffTs) < state.STAFF_ENGAGED_WINDOW_MS) {
            console.log(`[AutoAnswer] Skipped ${msgId} — staff engaged with ${userId} recently`);
            return;
        }

        const timer = setTimeout(async () => {
            if (!state.pendingQuestions.has(msgId)) return;
            state.pendingQuestions.delete(msgId);
            if (!question.trim()) {
                console.log(`[AutoAnswer] Skipped ${msgId} — empty message content`);
                return;
            }
            await answerQuestion({ question, targetMessage: message, userId, channelId });
        }, state.STAFF_WAIT_MS);

        state.pendingQuestions.set(msgId, { question, userId, channelId, timer, storedAt: Date.now() });
        console.log(`[AutoAnswer] Queued ${msgId} — fires in ${state.STAFF_WAIT_MS / 1000}s if no staff reply`);
    }

    // ─── Explanation embed ────────────────────────────────────────────────────

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

        // Log every human message in general and support for intent analysis
        if (channelId === GENERAL_CHANNEL_ID || channelId === SUPPORT_CHANNEL_ID) {
            logMessageIntent(message, botUserId, staff);
        }

        // Self-resolution check
        for (const [msgId, pending] of state.pendingQuestions) {
            if (pending.userId === userId && pending.channelId === channelId && looksResolved(content)) {
                clearTimeout(pending.timer);
                state.pendingQuestions.delete(msgId);
                console.log(`[AutoAnswer] Cancelled ${msgId} — user ${userId} signalled self-resolution`);
                break;
            }
        }

        // Community reply — only cancel timer for genuine community-help.
        // cachedIntent stores the result so Scenario 3 reuses it instead of calling the API again.
        let cachedIntent = null;
        if (!staff && message.reference?.messageId) {
            const pendingForRef = state.pendingQuestions.get(message.reference.messageId);
            if (pendingForRef && pendingForRef.userId !== userId) {
                cachedIntent = await classifyMessageIntent(content, message);
                if (cachedIntent === 'community-help') {
                    clearTimeout(pendingForRef.timer);
                    state.pendingQuestions.delete(message.reference.messageId);
                    console.log(`[AutoAnswer] Cancelled ${message.reference.messageId} — genuine community-help from ${userId}`);
                } else {
                    console.log(`[AutoAnswer] Kept timer for ${message.reference.messageId} — reply from ${userId} is '${cachedIntent}', not genuine help`);
                }
            }
        }

        // ── !usage-stats ──────────────────────────────────────────────────────

        if (content.trim() === '!usage-stats') {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }
            const s    = loadUsageStats();
            const cost = ((s.inputTokens / 1_000_000) * PRICE_INPUT) +
                         ((s.outputTokens / 1_000_000) * PRICE_OUTPUT);
            const avgIn  = s.calls ? Math.round(s.inputTokens  / s.calls) : 0;
            const avgOut = s.calls ? Math.round(s.outputTokens / s.calls) : 0;
            await message.reply(
                `**Usage stats** (since ${s.since.slice(0, 10)})\n` +
                `API calls: **${s.calls}**\n` +
                `Input tokens: **${s.inputTokens.toLocaleString()}** (avg ${avgIn}/call)\n` +
                `Output tokens: **${s.outputTokens.toLocaleString()}** (avg ${avgOut}/call)\n` +
                `Estimated cost: **$${cost.toFixed(4)}**`
            );
            return;
        }

        // ── !sync-blog ────────────────────────────────────────────────────────

        if (content.trim() === '!sync-blog') {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }
            const status = await message.reply('Syncing blog posts (new + updated only)…');
            try {
                const result   = await syncBlog();
                const [_, stale] = await Promise.all([
                    buildIndex(),
                    checkCorrectionStaleness(result.processedFiles),
                ]);
                const parts = [];
                if (result.added)           parts.push(`${result.added} added`);
                if (result.updated)         parts.push(`${result.updated} updated`);
                if (result.removed)         parts.push(`${result.removed} removed from sitemap`);
                if (result.deletedFromDisk) parts.push(`${result.deletedFromDisk} removed (deleted from disk)`);
                if (result.skipped)         parts.push(`${result.skipped} skipped`);
                if (result.failed)          parts.push(`${result.failed} failed`);
                const dateNote = result.effectiveSince !== result.configuredSince
                    ? `\nConfigured since: ${result.configuredSince} | Scraping from: **${result.effectiveSince}** (floor advanced by deletions)`
                    : `\nScraping from: **${result.effectiveSince}**`;
                const historyNote = result.sinceHistory && result.sinceHistory.length > 0
                    ? `\nFloor history: ` + result.sinceHistory.map(h =>
                        `${h.from} → ${h.to} (${h.changedAt.slice(0, 10)})`
                      ).join(' | ')
                    : '';
                const staleNote = stale.length > 0
                    ? `\n⚠️ Correction may need review:\n` + stale.map(w =>
                        `  • **${w.correctionFile}** — related to newly indexed: \`${w.newFile}\``
                      ).join('\n')
                    : '';
                await status.edit(
                    `✅ Sync complete — ${parts.join(', ') || 'nothing changed'}\n` +
                    `Total: ${result.total} posts tracked.${dateNote}${historyNote}${staleNote}`
                );
            } catch (err) {
                await status.edit(`❌ Sync failed: ${err.message}`);
            }
            return;
        }

        // ── !sync-knowledge ───────────────────────────────────────────────────

        if (content.trim() === '!sync-knowledge') {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }
            const status = await message.reply('Scanning announcements and re-indexing…');
            try {
                loadCoreFacts();
                // Scan runs before buildIndex so any appended facts are picked up in the same index build
                const scanResult = await scanAnnouncementsForNewFacts();
                const result     = await buildIndex();

                let msg = `✅ Done — added: ${result.added}, updated: ${result.updated}, removed: ${result.removed}, total chunks: ${result.total}`;
                if (scanResult.scanned > 0) {
                    if (scanResult.found.length > 0) {
                        msg += `\n📋 Announcements: ${scanResult.scanned} checked, ${scanResult.found.length} new fact(s) extracted`;
                        msg += `\n→ Appended to: ${scanResult.appended.join(', ')}`;
                    } else {
                        msg += `\n📋 Announcements: ${scanResult.scanned} checked, nothing new`;
                    }
                }
                await status.edit(msg);
            } catch (err) {
                await status.edit(`❌ Indexing failed: ${err.message}`);
            }
            return;
        }

        // ── !add-blog <url> ───────────────────────────────────────────────────

        if (content.trim().startsWith('!add-blog ')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }

            const url = content.trim().slice('!add-blog '.length).trim();
            if (!url.startsWith('http')) {
                await message.reply('Please provide a valid URL.\nUsage: `!add-blog https://yourblog.com/article`');
                return;
            }

            const month      = getMonthLabel();
            const folderName = `${month}_blog`;
            const blogDir    = path.join(__dirname, 'knowledge-base', 'blogs', folderName);
            ensureDir(blogDir);

            const existing = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));
            const nextNum  = existing.length + 1;
            const filepath = path.join(blogDir, `article${nextNum}.md`);

            const status = await message.reply(`Scraping article ${nextNum} for ${month}…`);
            try {
                const articleText = await scrapeSingleArticle(url);
                fs.writeFileSync(
                    filepath,
                    `# Blog Article ${nextNum}\nSource: ${url}\nScraped: ${new Date().toISOString()}\n\n---\n\n${articleText}`,
                    'utf8'
                );
                registerBlogInIndex(url, `article${nextNum}`, `${folderName}/article${nextNum}.md`);
                await buildIndex();
                await status.edit(
                    `✅ Article saved as \`knowledge-base/blogs/${folderName}/article${nextNum}.md\` and knowledge base updated.`
                );
            } catch (err) {
                await status.edit(`❌ Failed to scrape article: ${err.message}`);
            }
            return;
        }

        // ── !add-blog-text <url> + attachment ─────────────────────────────────

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
                const blogDir    = path.join(__dirname, 'knowledge-base', 'blogs', folderName);
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

        // ── !exclude-blog <url> ───────────────────────────────────────────────

        if (content.trim().startsWith('!exclude-blog ')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }

            const url = content.trim().slice('!exclude-blog '.length).trim();
            if (!url.startsWith('http')) {
                await message.reply('Please provide a valid URL.\nUsage: `!exclude-blog https://blog.river.inc/your-post`');
                return;
            }

            const indexPath = path.join(__dirname, 'knowledge-base', 'blogs', '_index.json');
            let index = { sitemapUrl: BLOG_SITEMAP_URL, lastChecked: null, pages: [], excluded: [] };
            if (fs.existsSync(indexPath)) {
                try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
            }
            if (!index.excluded) index.excluded = [];

            if (index.excluded.includes(url)) {
                await message.reply(`That post is already excluded.`);
                return;
            }

            const pageEntry = index.pages.find(p => p.url === url);
            if (pageEntry) {
                const fp = path.join(__dirname, 'knowledge-base', 'blogs', pageEntry.file);
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
                index.pages = index.pages.filter(p => p.url !== url);
            }

            index.excluded.push(url);
            ensureDir(path.join(__dirname, 'knowledge-base', 'blogs'));
            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
            await buildIndex();

            const slug = pageEntry?.slug ?? new URL(url).pathname.replace(/^\/|\/$/g, '');
            await message.reply(
                `✅ Excluded: \`${slug}\`\n` +
                (pageEntry ? 'File deleted from KB. ' : '') +
                'This post will be skipped on future `!sync-blog` runs.'
            );
            return;
        }

        // ── !include-blog <url> ───────────────────────────────────────────────

        if (content.trim().startsWith('!include-blog ')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }

            const url = content.trim().slice('!include-blog '.length).trim();
            if (!url.startsWith('http')) {
                await message.reply('Please provide a valid URL.\nUsage: `!include-blog https://blog.river.inc/your-post`');
                return;
            }

            const indexPath = path.join(__dirname, 'knowledge-base', 'blogs', '_index.json');
            let index = { sitemapUrl: BLOG_SITEMAP_URL, lastChecked: null, pages: [], excluded: [] };
            if (fs.existsSync(indexPath)) {
                try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
            }
            if (!index.excluded) index.excluded = [];

            if (!index.excluded.includes(url)) {
                await message.reply(`That URL is not in the excluded list.`);
                return;
            }

            index.excluded = index.excluded.filter(u => u !== url);
            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');

            const slug = new URL(url).pathname.replace(/^\/|\/$/g, '');
            await message.reply(
                `✅ Removed from exclusion list: \`${slug}\`\nRun \`!sync-blog\` to re-scrape this post.`
            );
            return;
        }

        // ── !sync-docs  /  !sync-docs force ──────────────────────────────────

        if (content.trim().startsWith('!sync-docs')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }
            const force  = content.trim().includes('force');
            const status = await message.reply(
                force ? 'Force re-scraping all doc pages…' : 'Checking for new/removed doc pages…'
            );
            try {
                const result     = await syncDocs(force);
                const [_, stale] = await Promise.all([
                    buildIndex(),
                    checkCorrectionStaleness(result.processedFiles),
                ]);
                const parts = [];
                if (result.added)   parts.push(`${result.added} added`);
                if (result.updated) parts.push(`${result.updated} updated`);
                if (result.removed) parts.push(`${result.removed} removed`);
                if (result.failed)  parts.push(`${result.failed} failed`);
                const staleNote = stale.length > 0
                    ? `\n⚠️ Correction may need review:\n` + stale.map(w =>
                        `  • **${w.correctionFile}** — related to newly indexed: \`${w.newFile}\``
                      ).join('\n')
                    : '';
                await status.edit(
                    `✅ Sync complete — ${parts.join(', ') || 'nothing changed'}\n` +
                    `Total: ${result.total} pages tracked.${staleNote}`
                );
            } catch (err) {
                await status.edit(`❌ Sync failed: ${err.message}`);
            }
            return;
        }

        // ── !add-doc <url> ────────────────────────────────────────────────────

        if (content.trim().startsWith('!add-doc ')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }

            const url = content.trim().slice('!add-doc '.length).trim();
            if (!url.startsWith('http')) {
                await message.reply('Please provide a valid URL.\nUsage: `!add-doc https://docs.river.inc/some-page`');
                return;
            }

            const docsDir = path.join(__dirname, 'knowledge-base', 'docs');
            ensureDir(docsDir);

            const slug     = new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'index';
            const filepath = path.join(docsDir, `${slug}.md`);
            const status   = await message.reply(`Scraping doc page \`${slug}\`…`);
            try {
                const pageText = await scrapeSingleArticle(url);
                fs.writeFileSync(
                    filepath,
                    `# Doc: ${slug}\nSource: ${url}\nScraped: ${new Date().toISOString()}\n\n---\n\n${pageText}`,
                    'utf8'
                );
                registerDocInIndex(url, slug, `${slug}.md`);
                await buildIndex();
                await status.edit(`✅ Saved as \`knowledge-base/docs/${slug}.md\` and knowledge base updated.`);
            } catch (err) {
                await status.edit(
                    `❌ Failed to scrape: ${err.message}\n\nTry \`!add-doc-text ${url}\` with an attached \`.md\`, \`.html\`, or \`.txt\` file instead.`
                );
            }
            return;
        }

        // ── !add-doc-text <url> + attachment ──────────────────────────────────

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

                const docsDir  = path.join(__dirname, 'knowledge-base', 'docs');
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

        // ── !add-correction <slug> [text] + optional attachment ───────────────

        if (content.trim().startsWith('!add-correction ')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }

            const rest     = content.trim().slice('!add-correction '.length).trim();
            const spaceIdx = rest.indexOf(' ');
            const slug     = (spaceIdx !== -1 ? rest.slice(0, spaceIdx) : rest)
                .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

            if (!slug) {
                await message.reply(
                    '**Usage:** `!add-correction <topic-slug> <correction text>`\n' +
                    'Or: `!add-correction <topic-slug>` + attach a `.md` or `.txt` file\n\n' +
                    '**Example:** `!add-correction airdrop-conversion The current mechanism is…`'
                );
                return;
            }

            let correctionText = spaceIdx !== -1 ? rest.slice(spaceIdx + 1).trim() : '';

            const attachment = message.attachments.find(a => /\.(txt|md)$/i.test(a.name ?? ''));
            if (attachment) {
                const status = await message.reply(`Reading \`${attachment.name}\`…`);
                try {
                    const fetch = (await import('node-fetch')).default;
                    const res   = await fetch(attachment.url);
                    if (!res.ok) throw new Error(`Could not download attachment: HTTP ${res.status}`);
                    correctionText = (await res.text()).trim();
                    await status.delete().catch(() => {});
                } catch (err) {
                    await status.edit(`❌ ${err.message}`);
                    return;
                }
            }

            if (!correctionText) {
                await message.reply('No correction text provided. Include it after the slug or attach a `.md`/`.txt` file.');
                return;
            }

            const correctionsDir = path.join(__dirname, 'knowledge-base', 'corrections');
            ensureDir(correctionsDir);
            const filepath = path.join(correctionsDir, `${slug}.md`);
            const isUpdate = fs.existsSync(filepath);
            fs.writeFileSync(
                filepath,
                `# Correction: ${slug}\nAdded: ${new Date().toISOString()}\n\n---\n\n${correctionText}`,
                'utf8'
            );

            const indexStatus = await message.reply(`${isUpdate ? 'Updating' : 'Adding'} correction \`${slug}\` — rebuilding index…`);
            try {
                await buildIndex();
                await indexStatus.edit(
                    `✅ Correction ${isUpdate ? 'updated' : 'added'}: \`knowledge-base/corrections/${slug}.md\`\n` +
                    'This will now rank above conflicting docs and blog posts on related questions.'
                );
            } catch (err) {
                await indexStatus.edit(`❌ Index rebuild failed: ${err.message}`);
            }
            return;
        }

        // ── !toggle ───────────────────────────────────────────────────────────

        if (content.trim().startsWith('!toggle')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }
            const arg = content.trim().split(/\s+/)[1]?.toLowerCase();
            if (!arg || arg === 'status') {
                const { discord, telegram } = getStatus();
                await message.reply(
                    `**Bot Reply Toggles**\n` +
                    `Discord: ${discord ? '🟢 ON' : '🔴 OFF'}\n` +
                    `Telegram: ${telegram ? '🟢 ON' : '🔴 OFF'}`
                );
            } else if (arg === 'discord' || arg === 'telegram') {
                const newState = toggle(arg);
                await message.reply(`**${arg.charAt(0).toUpperCase() + arg.slice(1)} replies** turned ${newState ? '🟢 ON' : '🔴 OFF'}`);
            } else {
                await message.reply('Usage: `!toggle discord` | `!toggle telegram` | `!toggle status`');
            }
            return;
        }

        // ── !report ───────────────────────────────────────────────────────────

        if (content.trim().startsWith('!report')) {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }
            const parts      = content.trim().split(/\s+/);
            const sub        = parts[1]?.toLowerCase();
            const platformArg = parts[2]?.toLowerCase();
            if (sub !== 'weekly' && sub !== 'daily') {
                await message.reply('Usage: `!report weekly [discord|telegram]` or `!report daily [discord|telegram]`');
                return;
            }
            const reportType = sub;
            const platform   = platformArg === 'discord' ? 'discord' : platformArg === 'telegram' ? 'telegram' : 'both';
            const typeLabel  = reportType === 'daily' ? 'Daily' : 'Weekly';
            const platLabel  = { discord: 'Discord', telegram: 'Telegram', both: 'Discord + Telegram' }[platform];
            const status     = await message.reply(`Generating ${typeLabel.toLowerCase()} community report (${platLabel})…`);
            try {
                await generateCommunityReport(discordClient, platform, reportType);
                await status.edit('✅ Report posted.');
            } catch (err) {
                await status.edit(`❌ Failed to generate report: ${err.message}`);
            }
            return;
        }

        // ── !member-stats ─────────────────────────────────────────────────────

        if (content.trim() === '!member-stats') {
            if (!staff) { await message.reply('This command is restricted to staff members.'); return; }
            const { joins, leaves } = getWeeklyStats();
            const guild = message.guild;
            const total = guild ? guild.memberCount : '?';
            await message.reply(
                `**Server Member Stats**\n` +
                `Total members: **${total}**\n` +
                `Joined (Mon–Sun this week): **${joins}**\n` +
                `Left (Mon–Sun this week): **${leaves}**`
            );
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

        if (!BOT_ANSWER_CHANNEL_IDS.includes(channelId)) return;
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

                    console.log(`[Trigger] Scenario 0.5 — follow-up reply from ${userId}`);
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

            const intent1 = await classifyMessageIntent(question, message);
            logIntentClassification(message.id, intent1);

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
            try {
                const originalMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (originalMessage.author.id === discordClient.user.id) return;

                const question = originalMessage.content;
                const askedBy  = originalMessage.author.id;

                const intent2 = await classifyMessageIntent(question, originalMessage);
                logIntentClassification(originalMessage.id, intent2);

                if (intent2 === 'staff-ping') {
                    console.log(`[Trigger] Scenario 2 — original is staff-ping from ${askedBy}, redirecting`);
                    await message.reply(`For ticket or account-specific issues, the team can be reached directly in <#${SUPPORT_CHANNEL_ID}>.`);
                    return;
                }

                console.log(`[Trigger] Scenario 2 — reply mention, answering original from ${askedBy} (intent: ${intent2})`);

                const pending = state.pendingQuestions.get(message.reference.messageId);
                if (pending) {
                    clearTimeout(pending.timer);
                    state.pendingQuestions.delete(message.reference.messageId);
                    console.log(`[AutoAnswer] Cancelled pending timer for ${message.reference.messageId}`);
                }

                await answerQuestion({ question, targetMessage: originalMessage, userId: askedBy, channelId });
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
                const pending = state.pendingQuestions.get(message.reference.messageId);
                if (pending) {
                    clearTimeout(pending.timer);
                    state.pendingQuestions.delete(message.reference.messageId);
                    console.log(`[Scenario 3] Staff replied — cancelled timer for ${message.reference.messageId}`);
                    state.staffEngaged.set(trackerKey(pending.userId, channelId), Date.now());
                } else {
                    message.channel.messages.fetch(message.reference.messageId).then(ref => {
                        if (ref && !ref.author.bot) {
                            state.staffEngaged.set(trackerKey(ref.author.id, channelId), Date.now());
                            console.log(`[StaffEngaged] Recorded staff engagement with ${ref.author.id}`);
                        }
                    }).catch(() => {});
                }
            }
            return;
        }

        const intent3 = cachedIntent ?? await classifyMessageIntent(content, message);
        logIntentClassification(message.id, intent3);
        console.log(`[Intent] ${message.id} → ${intent3}`);

        if (!RESPOND_INTENTS.has(intent3)) {
            console.log(`[Scenario 3] Skipped — intent '${intent3}' does not warrant a response`);
            return;
        }

        scheduleAutoAnswer(message);
        } catch (err) {
            console.error('[messageCreate] Unhandled error:', err);
        }
    });
}

module.exports = { registerMessageHandler };

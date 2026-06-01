'use strict';

const fs   = require('fs');
const path = require('path');

const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');
const { isEnabled, toggle, getStatus } = require('./toggles');

// ─── Command definitions ──────────────────────────────────────────────────────

const COMMANDS = [
    {
        name:        'toggle',
        description: 'Turn bot auto-replies on or off for a platform',
        options: [{
            name:        'platform',
            description: 'Which platform to toggle',
            type:        ApplicationCommandOptionType.String,
            required:    true,
            choices: [
                { name: 'Discord',             value: 'discord'  },
                { name: 'Telegram',            value: 'telegram' },
                { name: 'Show current status', value: 'status'   },
            ],
        }],
    },
    {
        name:        'report',
        description: 'Generate a community report and post it to the reports channel',
        options: [
            {
                name:        'period',
                description: 'Week (Mon–Sun) or Day (today)',
                type:        ApplicationCommandOptionType.String,
                required:    true,
                choices: [
                    { name: 'Week (Mon–Sun)', value: 'week' },
                    { name: 'Day (today)',    value: 'day'  },
                ],
            },
            {
                name:        'scope',
                description: 'Which platform to include in the report',
                type:        ApplicationCommandOptionType.String,
                required:    false,
                choices: [
                    { name: 'Both Discord + Telegram', value: 'both'     },
                    { name: 'Discord only',            value: 'discord'  },
                    { name: 'Telegram only',           value: 'telegram' },
                ],
            },
        ],
    },
    {
        name:        'member-stats',
        description: 'Show server member counts and join/leave stats',
        options: [
            {
                name:        'period',
                description: 'Week (Mon–Sun) or Day (today)',
                type:        ApplicationCommandOptionType.String,
                required:    false,
                choices: [
                    { name: 'Week (Mon–Sun)', value: 'week' },
                    { name: 'Day (today)',    value: 'day'  },
                ],
            },
            {
                name:        'platform',
                description: 'Which platform to show stats for',
                type:        ApplicationCommandOptionType.String,
                required:    false,
                choices: [
                    { name: 'Both',     value: 'both'     },
                    { name: 'Discord',  value: 'discord'  },
                    { name: 'Telegram', value: 'telegram' },
                ],
            },
        ],
    },
    {
        name:        'usage-stats',
        description: 'Show Claude API call count, token usage, and estimated cost',
    },
    {
        name:        'sync-knowledge',
        description: 'Reload core facts, scan new announcements, and rebuild the full RAG index',
    },
    {
        name:        'sync-blog',
        description: 'Pull new and updated blog posts from the sitemap into the knowledge base',
    },
    {
        name:        'sync-docs',
        description: 'Pull new or removed doc pages from the sitemap into the knowledge base',
        options: [{
            name:        'force',
            description: 'Force re-scrape all doc pages (not just new/removed)',
            type:        ApplicationCommandOptionType.Boolean,
            required:    false,
        }],
    },
    {
        name:        'add-blog',
        description: 'Scrape a single blog post URL and add it to the knowledge base',
        options: [{
            name:        'url',
            description: 'Full URL of the blog post',
            type:        ApplicationCommandOptionType.String,
            required:    true,
        }],
    },
    {
        name:        'exclude-blog',
        description: 'Remove a blog post from the knowledge base and skip it on future syncs',
        options: [{
            name:        'url',
            description: 'Full URL of the blog post to exclude',
            type:        ApplicationCommandOptionType.String,
            required:    true,
        }],
    },
    {
        name:        'include-blog',
        description: 'Remove a blog post from the exclusion list so it gets re-scraped on next sync',
        options: [{
            name:        'url',
            description: 'Full URL of the blog post to re-include',
            type:        ApplicationCommandOptionType.String,
            required:    true,
        }],
    },
    {
        name:        'add-doc',
        description: 'Scrape a single doc page URL and add it to the knowledge base',
        options: [{
            name:        'url',
            description: 'Full URL of the doc page',
            type:        ApplicationCommandOptionType.String,
            required:    true,
        }],
    },
    {
        name:        'add-correction',
        description: 'Add or update a correction in the knowledge base (outranks docs and blogs in RAG)',
        options: [
            {
                name:        'slug',
                description: 'Short topic identifier, e.g. staking-rewards',
                type:        ApplicationCommandOptionType.String,
                required:    true,
            },
            {
                name:        'text',
                description: 'Correction text (or attach a .md/.txt file instead)',
                type:        ApplicationCommandOptionType.String,
                required:    false,
            },
            {
                name:        'file',
                description: 'Attach a .md or .txt file instead of typing the correction',
                type:        ApplicationCommandOptionType.Attachment,
                required:    false,
            },
        ],
    },
];

// ─── Registration ─────────────────────────────────────────────────────────────

async function registerSlashCommands(clientUser, guildId, token) {
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(
            Routes.applicationGuildCommands(clientUser.id, guildId),
            { body: COMMANDS }
        );
        console.log(`[Slash] ${COMMANDS.length} commands registered in guild ${guildId}`);
    } catch (err) {
        console.error('[Slash] Registration failed:', err.message);
    }
}

// ─── Interaction handler ──────────────────────────────────────────────────────

function createSlashHandler(discordClient, config, modules) {
    const {
        STAFF_ROLE_IDS,
        GENERAL_CHANNEL_ID,
        SUPPORT_CHANNEL_ID,
        REPORTS_CHANNEL_ID,
    } = config;

    const staffIds = Array.isArray(STAFF_ROLE_IDS)
        ? STAFF_ROLE_IDS
        : (STAFF_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

    const {
        kbSync:  { syncBlog, syncDocs, registerBlogInIndex, registerDocInIndex, loadUsageStats, PRICE_INPUT, PRICE_OUTPUT, BLOG_SITEMAP_URL },
        utils:   { getMonthLabel, ensureDir },
        monitor: { checkCorrectionStaleness, scanAnnouncementsForNewFacts },
        buildIndex,
        scrapeSingleArticle,
        htmlToMarkdown,
        loadCoreFacts,
        getWeeklyStats,
        getMemberStats,
        getWeekRange,
        getDayRange,
        getTgMemberStats,
        getTelegramMemberCount,
        generateCommunityReport,
    } = modules;

    return async function handleInteraction(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const staff = interaction.member?.roles?.cache?.some(r => staffIds.includes(r.id)) ?? false;
        if (!staff) {
            await interaction.reply({ content: 'This command is restricted to staff members.', ephemeral: true });
            return;
        }

        const cmd = interaction.commandName;

        // ── /toggle ───────────────────────────────────────────────────────────
        if (cmd === 'toggle') {
            const platform = interaction.options.getString('platform');
            if (platform === 'status') {
                const { discord, telegram } = getStatus();
                await interaction.reply(
                    `**Bot Reply Toggles**\n` +
                    `Discord: ${discord  ? '🟢 ON' : '🔴 OFF'}\n` +
                    `Telegram: ${telegram ? '🟢 ON' : '🔴 OFF'}`
                );
            } else {
                const newState = toggle(platform);
                await interaction.reply(
                    `**${platform.charAt(0).toUpperCase() + platform.slice(1)} replies** turned ${newState ? '🟢 ON' : '🔴 OFF'}`
                );
            }
            return;
        }

        // ── /report ───────────────────────────────────────────────────────────
        if (cmd === 'report') {
            const period     = interaction.options.getString('period') ?? 'week';
            const reportType = period === 'day' ? 'daily' : 'weekly';
            const platform   = interaction.options.getString('scope') ?? 'both';
            const typeLabel  = reportType === 'daily' ? 'Daily' : 'Weekly';
            const platLabel  = { discord: 'Discord', telegram: 'Telegram', both: 'Discord + Telegram' }[platform];
            await interaction.deferReply();
            try {
                await generateCommunityReport(discordClient, platform, reportType);
                await interaction.editReply(`✅ ${typeLabel} report (${platLabel}) posted to <#${REPORTS_CHANNEL_ID}>.`);
            } catch (err) {
                await interaction.editReply(`❌ Failed to generate report: ${err.message}`);
            }
            return;
        }

        // ── /member-stats ─────────────────────────────────────────────────────
        if (cmd === 'member-stats') {
            const period   = interaction.options.getString('period') ?? 'week';
            const platform = interaction.options.getString('platform') ?? 'both';
            const wantTG   = (platform === 'telegram' || platform === 'both') && getTelegramMemberCount;

            if (wantTG) await interaction.deferReply();

            const { from, to } = period === 'day' ? getDayRange() : getWeekRange();
            const periodLabel  = period === 'day'
                ? from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : `${from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${to.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

            const lines = [`**Server Member Stats** — ${periodLabel}`];

            if (platform === 'discord' || platform === 'both') {
                const { joins, leaves } = getMemberStats(from, to);
                const total = interaction.guild?.memberCount ?? '?';
                if (platform === 'both') lines.push('\n**Discord**');
                lines.push(`Total members: **${total}**`);
                lines.push(`Joined: **${joins}**`);
                lines.push(`Left: **${leaves}**`);
            }

            if (platform === 'telegram' || platform === 'both') {
                if (platform === 'both') lines.push('\n**Telegram**');
                if (getTelegramMemberCount) {
                    try {
                        const count = await getTelegramMemberCount();
                        const { joins: tgJoins, leaves: tgLeaves } = getTgMemberStats(from, to);
                        lines.push(`Total members: **${count}**`);
                        lines.push(`Joined: **${tgJoins}**`);
                        lines.push(`Left: **${tgLeaves}**`);
                    } catch {
                        lines.push(`Total members: *(unavailable)*`);
                    }
                } else {
                    lines.push('*(Telegram bot not configured)*');
                }
            }

            const msg = lines.join('\n');
            if (interaction.deferred) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply(msg);
            }
            return;
        }

        // ── /usage-stats ──────────────────────────────────────────────────────
        if (cmd === 'usage-stats') {
            const s      = loadUsageStats();
            const cost   = ((s.inputTokens / 1_000_000) * PRICE_INPUT) + ((s.outputTokens / 1_000_000) * PRICE_OUTPUT);
            const avgIn  = s.calls ? Math.round(s.inputTokens  / s.calls) : 0;
            const avgOut = s.calls ? Math.round(s.outputTokens / s.calls) : 0;
            await interaction.reply(
                `**Usage stats** (since ${s.since.slice(0, 10)})\n` +
                `API calls: **${s.calls}**\n` +
                `Input tokens: **${s.inputTokens.toLocaleString()}** (avg ${avgIn}/call)\n` +
                `Output tokens: **${s.outputTokens.toLocaleString()}** (avg ${avgOut}/call)\n` +
                `Estimated cost: **$${cost.toFixed(4)}**`
            );
            return;
        }

        // ── /sync-knowledge ───────────────────────────────────────────────────
        if (cmd === 'sync-knowledge') {
            await interaction.deferReply();
            try {
                loadCoreFacts();
                const scanResult = await scanAnnouncementsForNewFacts();
                const result     = await buildIndex();
                let msg = `✅ Done — added: ${result.added}, updated: ${result.updated}, removed: ${result.removed}, total chunks: ${result.total}`;
                if (scanResult.scanned > 0) {
                    msg += scanResult.found.length > 0
                        ? `\n📋 Announcements: ${scanResult.scanned} checked, ${scanResult.found.length} new fact(s) extracted\n→ Appended to: ${scanResult.appended.join(', ')}`
                        : `\n📋 Announcements: ${scanResult.scanned} checked, nothing new`;
                }
                await interaction.editReply(msg);
            } catch (err) {
                await interaction.editReply(`❌ Indexing failed: ${err.message}`);
            }
            return;
        }

        // ── /sync-blog ────────────────────────────────────────────────────────
        if (cmd === 'sync-blog') {
            await interaction.deferReply();
            try {
                const result     = await syncBlog();
                const [_, stale] = await Promise.all([buildIndex(), checkCorrectionStaleness(result.processedFiles)]);
                const parts = [];
                if (result.added)           parts.push(`${result.added} added`);
                if (result.updated)         parts.push(`${result.updated} updated`);
                if (result.removed)         parts.push(`${result.removed} removed from sitemap`);
                if (result.deletedFromDisk) parts.push(`${result.deletedFromDisk} removed (deleted from disk)`);
                if (result.skipped)         parts.push(`${result.skipped} skipped`);
                if (result.failed)          parts.push(`${result.failed} failed`);
                const dateNote  = result.effectiveSince !== result.configuredSince
                    ? `\nConfigured since: ${result.configuredSince} | Scraping from: **${result.effectiveSince}**`
                    : `\nScraping from: **${result.effectiveSince}**`;
                const staleNote = stale.length > 0
                    ? `\n⚠️ Correction may need review:\n` + stale.map(w => `  • **${w.correctionFile}** — related to: \`${w.newFile}\``).join('\n')
                    : '';
                await interaction.editReply(
                    `✅ Sync complete — ${parts.join(', ') || 'nothing changed'}\nTotal: ${result.total} posts tracked.${dateNote}${staleNote}`
                );
            } catch (err) {
                await interaction.editReply(`❌ Sync failed: ${err.message}`);
            }
            return;
        }

        // ── /sync-docs ────────────────────────────────────────────────────────
        if (cmd === 'sync-docs') {
            const force = interaction.options.getBoolean('force') ?? false;
            await interaction.deferReply();
            try {
                const result     = await syncDocs(force);
                const [_, stale] = await Promise.all([buildIndex(), checkCorrectionStaleness(result.processedFiles)]);
                const parts = [];
                if (result.added)   parts.push(`${result.added} added`);
                if (result.updated) parts.push(`${result.updated} updated`);
                if (result.removed) parts.push(`${result.removed} removed`);
                if (result.failed)  parts.push(`${result.failed} failed`);
                const staleNote = stale.length > 0
                    ? `\n⚠️ Correction may need review:\n` + stale.map(w => `  • **${w.correctionFile}** — related to: \`${w.newFile}\``).join('\n')
                    : '';
                await interaction.editReply(
                    `✅ Sync complete — ${parts.join(', ') || 'nothing changed'}\nTotal: ${result.total} pages tracked.${staleNote}`
                );
            } catch (err) {
                await interaction.editReply(`❌ Sync failed: ${err.message}`);
            }
            return;
        }

        // ── /add-blog ─────────────────────────────────────────────────────────
        if (cmd === 'add-blog') {
            const url = interaction.options.getString('url');
            if (!url.startsWith('http')) { await interaction.reply('Please provide a valid URL starting with http.'); return; }
            const month    = getMonthLabel();
            const blogDir  = path.join(__dirname, 'knowledge-base', 'blogs', `${month}_blog`);
            ensureDir(blogDir);
            const nextNum  = fs.readdirSync(blogDir).filter(f => f.endsWith('.md')).length + 1;
            const filepath = path.join(blogDir, `article${nextNum}.md`);
            await interaction.deferReply();
            try {
                const articleText = await scrapeSingleArticle(url);
                fs.writeFileSync(filepath, `# Blog Article ${nextNum}\nSource: ${url}\nScraped: ${new Date().toISOString()}\n\n---\n\n${articleText}`, 'utf8');
                registerBlogInIndex(url, `article${nextNum}`, `${month}_blog/article${nextNum}.md`);
                await buildIndex();
                await interaction.editReply(`✅ Saved as \`knowledge-base/blogs/${month}_blog/article${nextNum}.md\` and KB updated.`);
            } catch (err) {
                await interaction.editReply(`❌ Failed to scrape: ${err.message}`);
            }
            return;
        }

        // ── /exclude-blog ─────────────────────────────────────────────────────
        if (cmd === 'exclude-blog') {
            const url       = interaction.options.getString('url');
            const indexPath = path.join(__dirname, 'knowledge-base', 'blogs', '_index.json');
            let index = { sitemapUrl: BLOG_SITEMAP_URL, lastChecked: null, pages: [], excluded: [] };
            if (fs.existsSync(indexPath)) { try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {} }
            if (!index.excluded) index.excluded = [];
            if (index.excluded.includes(url)) { await interaction.reply('That post is already excluded.'); return; }
            const pageEntry = index.pages.find(p => p.url === url);
            if (pageEntry) {
                const fp = path.join(__dirname, 'knowledge-base', 'blogs', pageEntry.file);
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
                index.pages = index.pages.filter(p => p.url !== url);
            }
            index.excluded.push(url);
            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
            await interaction.deferReply();
            await buildIndex();
            const slug = pageEntry?.slug ?? new URL(url).pathname.replace(/^\/|\/$/g, '');
            await interaction.editReply(`✅ Excluded: \`${slug}\`\n${pageEntry ? 'File deleted from KB. ' : ''}Skipped on future \`/sync-blog\` runs.`);
            return;
        }

        // ── /include-blog ─────────────────────────────────────────────────────
        if (cmd === 'include-blog') {
            const url       = interaction.options.getString('url');
            const indexPath = path.join(__dirname, 'knowledge-base', 'blogs', '_index.json');
            let index = { sitemapUrl: BLOG_SITEMAP_URL, lastChecked: null, pages: [], excluded: [] };
            if (fs.existsSync(indexPath)) { try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {} }
            if (!index.excluded) index.excluded = [];
            if (!index.excluded.includes(url)) { await interaction.reply('That URL is not in the excluded list.'); return; }
            index.excluded = index.excluded.filter(u => u !== url);
            fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
            const slug = new URL(url).pathname.replace(/^\/|\/$/g, '');
            await interaction.reply(`✅ Removed from exclusion list: \`${slug}\`\nRun \`/sync-blog\` to re-scrape.`);
            return;
        }

        // ── /add-doc ──────────────────────────────────────────────────────────
        if (cmd === 'add-doc') {
            const url     = interaction.options.getString('url');
            const docsDir = path.join(__dirname, 'knowledge-base', 'docs');
            ensureDir(docsDir);
            const slug     = new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'index';
            const filepath = path.join(docsDir, `${slug}.md`);
            await interaction.deferReply();
            try {
                const pageText = await scrapeSingleArticle(url);
                fs.writeFileSync(filepath, `# Doc: ${slug}\nSource: ${url}\nScraped: ${new Date().toISOString()}\n\n---\n\n${pageText}`, 'utf8');
                registerDocInIndex(url, slug, `${slug}.md`);
                await buildIndex();
                await interaction.editReply(`✅ Saved as \`knowledge-base/docs/${slug}.md\` and KB updated.`);
            } catch (err) {
                await interaction.editReply(`❌ Failed to scrape: ${err.message}`);
            }
            return;
        }

        // ── /add-correction ───────────────────────────────────────────────────
        if (cmd === 'add-correction') {
            const rawSlug  = interaction.options.getString('slug');
            const slug     = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            let corrText   = interaction.options.getString('text') ?? '';
            const attachment = interaction.options.getAttachment('file');

            if (attachment) {
                await interaction.deferReply();
                try {
                    const fetch = (await import('node-fetch')).default;
                    const res   = await fetch(attachment.url);
                    if (!res.ok) throw new Error(`Could not download attachment: HTTP ${res.status}`);
                    corrText = (await res.text()).trim();
                } catch (err) {
                    await interaction.editReply(`❌ ${err.message}`);
                    return;
                }
            } else if (!corrText) {
                await interaction.reply('No correction text provided. Add text in the `text` field or attach a `.md`/`.txt` file.');
                return;
            }

            if (!attachment) await interaction.deferReply();

            const correctionsDir = path.join(__dirname, 'knowledge-base', 'corrections');
            ensureDir(correctionsDir);
            const filepath = path.join(correctionsDir, `${slug}.md`);
            const isUpdate = fs.existsSync(filepath);
            fs.writeFileSync(filepath, `# Correction: ${slug}\nAdded: ${new Date().toISOString()}\n\n---\n\n${corrText}`, 'utf8');
            try {
                await buildIndex();
                await interaction.editReply(
                    `✅ Correction ${isUpdate ? 'updated' : 'added'}: \`knowledge-base/corrections/${slug}.md\`\n` +
                    'Ranks above docs and blogs in RAG for related questions.'
                );
            } catch (err) {
                await interaction.editReply(`❌ Index rebuild failed: ${err.message}`);
            }
            return;
        }
    };
}

module.exports = { registerSlashCommands, createSlashHandler, COMMANDS };

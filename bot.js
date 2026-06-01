require('dotenv').config();

const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const Anthropic  = require('@anthropic-ai/sdk');
const cron       = require('node-cron');

const { getSourceFiles }               = require('./knowledge-loader');
const { scrapeSingleArticle, htmlToMarkdown } = require('./blog-scraper');
const { buildIndex, searchKB }         = require('./rag');

const state = require('./state');
const { createClaudeModule }           = require('./claude');
const { createIntentModule }           = require('./intent');
const { syncBlog, syncDocs, registerBlogInIndex, registerDocInIndex, loadUsageStats, trackUsage, PRICE_INPUT, PRICE_OUTPUT, BLOG_SITEMAP_URL } = require('./kb-sync');
const { isStaff, isBotMentioned, stripBotMention, looksResolved, trackerKey, getMonthLabel, ensureDir, appendToMonthlyWeeklyFile, saveQAPair } = require('./utils');
const { registerMessageHandler }       = require('./commands');
const { registerSlashCommands, createSlashHandler } = require('./slash-commands');
const { createMonitorModule }          = require('./kb-monitor');
const { registerMemberEvents, getWeeklyStats, getMemberStats, getWeekRange, getDayRange } = require('./weekly-report/member-stats/discord/discord-member-stats');
const { getTgMemberStats } = require('./weekly-report/member-stats/telegram/tg-member-stats');
const { generateCommunityReport }              = require('./weekly-report/community-report/community-report');
const { createTelegramAdapter }                = require('./telegram/telegram-adapter');

// ─── Config ───────────────────────────────────────────────────────────────────

const {
    DISCORD_TOKEN,
    ANTHROPIC_API_KEY,
    ANNOUNCEMENTS_CHANNEL_ID,
    TWEETS_CHANNEL_ID,
    GENERAL_CHANNEL_ID,
    SUPPORT_CHANNEL_ID,
    STAFF_EXPLANATION_CHANNEL_ID,
    REPORTS_CHANNEL_ID,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    TELEGRAM_TOPIC_IDS,
} = process.env;

const BOT_ANSWER_CHANNEL_IDS = (process.env.BOT_ANSWER_CHANNEL_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

const STAFF_ROLE_IDS = (process.env.STAFF_ROLE_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

// ─── Clients ──────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel],
});

// ─── Module wiring ────────────────────────────────────────────────────────────

const claudeModule  = createClaudeModule(anthropic, state, { searchKB, getSourceFiles, trackUsage });
const intentModule  = createIntentModule(anthropic, { SUPPORT_CHANNEL_ID });
const monitorModule = createMonitorModule(anthropic);

registerMessageHandler(discordClient, state, {
    ANNOUNCEMENTS_CHANNEL_ID,
    TWEETS_CHANNEL_ID,
    GENERAL_CHANNEL_ID,
    SUPPORT_CHANNEL_ID,
    STAFF_EXPLANATION_CHANNEL_ID,
    BOT_ANSWER_CHANNEL_IDS,
    STAFF_ROLE_IDS,
    REPORTS_CHANNEL_ID,
}, {
    claude:  claudeModule,
    intent:  intentModule,
    kbSync:  { syncBlog, syncDocs, registerBlogInIndex, registerDocInIndex, loadUsageStats, PRICE_INPUT, PRICE_OUTPUT, BLOG_SITEMAP_URL },
    utils:   { isStaff, isBotMentioned, stripBotMention, looksResolved, trackerKey, getMonthLabel, ensureDir, appendToMonthlyWeeklyFile, saveQAPair },
    buildIndex,
    searchKB,
    scrapeSingleArticle,
    htmlToMarkdown,
    EmbedBuilder,
    loadCoreFacts:   claudeModule.loadCoreFacts,
    monitor:         monitorModule,
    getWeeklyStats,
    generateCommunityReport: (client, platform, reportType) => generateCommunityReport(client, {
        GENERAL_CHANNEL_ID,
        SUPPORT_CHANNEL_ID,
        REPORTS_CHANNEL_ID,
        anthropic,
        platform,
        reportType,
    }),
});

// ─── Ready ────────────────────────────────────────────────────────────────────

discordClient.once('clientReady', async () => {
    console.log(`[Bot] Logged in as ${discordClient.user.tag}`);
    discordClient.user.setPresence({
        status:     'online',
        activities: [{ name: 'River Support', type: ActivityType.Watching }],
    });
    claudeModule.loadCoreFacts();
    registerMemberEvents(discordClient);
    try {
        await buildIndex();
        console.log('[Bot] Knowledge base indexed');
    } catch (err) {
        console.error('[Bot] Failed to build index on startup:', err.message);
    }

    // ── Telegram adapter (created before slash handler so getMemberCount can be passed in)
    let tgMemberCount = null;
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const topicIds  = (TELEGRAM_TOPIC_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        const tgAdapter = createTelegramAdapter({
            token:                 TELEGRAM_BOT_TOKEN,
            allowedChatId:         TELEGRAM_CHAT_ID,
            allowedTopicIds:       topicIds,
            state,
            answerQuestion:        claudeModule.answerQuestion,
            searchKB,
            classifyMessageIntent: intentModule.classifyMessageIntent,
            logTelegramMessage:    intentModule.logTelegramMessage,
            logTelegramIntent:     intentModule.logTelegramIntent,
            RESPOND_INTENTS:       intentModule.RESPOND_INTENTS,
        });
        tgAdapter.launch().catch(err => console.error('[TG] Launch error:', err.message));
        process.once('SIGTERM', () => tgAdapter.stop('SIGTERM'));
        process.once('SIGINT',  () => tgAdapter.stop('SIGINT'));
        tgMemberCount = () => tgAdapter.getMemberCount();
        console.log('[TG] Telegram bot started');
    } else {
        console.log('[TG] No TELEGRAM_BOT_TOKEN set — Telegram bot disabled');
    }

    const guildId = discordClient.guilds.cache.first()?.id;
    if (guildId) {
        await registerSlashCommands(discordClient.user, guildId, DISCORD_TOKEN);
        const slashHandler = createSlashHandler(discordClient, {
            STAFF_ROLE_IDS,
            GENERAL_CHANNEL_ID,
            SUPPORT_CHANNEL_ID,
            REPORTS_CHANNEL_ID,
        }, {
            kbSync:  { syncBlog, syncDocs, registerBlogInIndex, registerDocInIndex, loadUsageStats, PRICE_INPUT, PRICE_OUTPUT, BLOG_SITEMAP_URL },
            utils:   { getMonthLabel, ensureDir },
            monitor: monitorModule,
            buildIndex,
            scrapeSingleArticle,
            htmlToMarkdown,
            loadCoreFacts:        claudeModule.loadCoreFacts,
            getWeeklyStats,
            getMemberStats,
            getWeekRange,
            getDayRange,
            getTgMemberStats,
            getTelegramMemberCount: tgMemberCount,
            generateCommunityReport: (client, platform, reportType) => generateCommunityReport(client, {
                GENERAL_CHANNEL_ID,
                SUPPORT_CHANNEL_ID,
                REPORTS_CHANNEL_ID,
                anthropic,
                platform,
                reportType,
            }),
        });
        discordClient.on('interactionCreate', slashHandler);
    } else {
        console.warn('[Slash] No guild found — slash commands not registered');
    }

    cron.schedule('0 * * * *', () => {
        claudeModule.pruneStaleEntries();
        console.log('[Bot] Pruned stale tracker entries');
    });
});

// ─── Start ────────────────────────────────────────────────────────────────────

discordClient.login(DISCORD_TOKEN).catch(err => {
    console.error('[Bot] Login failed:', err.message);
    process.exit(1);
});

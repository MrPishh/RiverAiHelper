'use strict';

/* ─── About this file ─────────────────────────────────────────────────────────
 * Entry point — pm2 runs `node bot.js` directly. Reads settings from .env, creates
 * the Discord and Anthropic clients and wires every src/ module together. On
 * clientReady it builds the RAG index, starts the Telegram adapter, registers the
 * slash commands and schedules the cron jobs. Holds no command logic itself — that
 * lives in src/commands.js and src/slash-commands.js.
 * ────────────────────────────────────────────────────────────────────────── */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const Anthropic  = require('@anthropic-ai/sdk');
const cron       = require('node-cron');

const { getSourceFiles }               = require('./src/knowledge-loader');
const { scrapeSingleArticle, htmlToMarkdown } = require('./src/blog-scraper');
const { buildIndex, searchKB }         = require('./src/rag');

const state = require('./src/state');
const { createClaudeModule }           = require('./src/claude');
const { createIntentModule }           = require('./src/intent');
const { syncBlog, syncDocs, registerBlogInIndex, registerDocInIndex, loadUsageStats, trackUsage, PRICE_INPUT, PRICE_OUTPUT, PRICE_HAIKU_INPUT, PRICE_HAIKU_OUTPUT, BLOG_SITEMAP_URL } = require('./src/kb-sync');
const { isStaff, isBotMentioned, stripBotMention, looksResolved, trackerKey, getMonthLabel, ensureDir, appendToMonthlyWeeklyFile, saveQAPair, normalizeDisplayName, looksLikeSpoofedName, looksLikeHelperOffer } = require('./src/utils');
const scamTracker                      = require('./src/scam-tracker');
const { registerMessageHandler }       = require('./src/commands');
const { registerSlashCommands, createSlashHandler } = require('./src/slash-commands');
const { createMonitorModule }          = require('./src/kb-monitor');
const { registerMemberEvents, getWeeklyStats, getMemberStats, getWeekRange, getDayRange } = require('./weekly-report/member-stats/discord/discord-member-stats');
const { getTgMemberStats } = require('./weekly-report/member-stats/telegram/tg-member-stats');
const { generateCommunityReport, buildCommunityReport } = require('./weekly-report/community-report/community-report');
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
    CHINESE_DISCORD_CHANNEL_ID,
    CHINESE_TELEGRAM_TOPIC_ID,
    SCAM_LOG_CHANNEL_ID,
} = process.env;

// Channels where the bot may auto-answer unprompted (Scenario 3). @mentions work in any channel.
const BOT_ANSWER_CHANNEL_IDS = (process.env.BOT_ANSWER_CHANNEL_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

// Role IDs that count as staff: staff can run staff commands and are never auto-answered.
const STAFF_ROLE_IDS = (process.env.STAFF_ROLE_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

// Support-ticket category IDs — messages there are logged to intent/ticket-log.jsonl, never answered.
const SUPPORT_TICKET_CATEGORY_IDS = new Set(
    // Support ticket category IDs
    (process.env.SUPPORT_TICKET_CATEGORY_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
);

// Collab ticket category IDs – used for business‑proposal tickets (not included in reports yet)
const COLLAB_CATEGORY_IDS = new Set(
    (process.env.COLLAB_CATEGORY_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
);

// ─── Clients ──────────────────────────────────────────────────────────────────

// One Anthropic client, shared by every module that calls Claude.
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Discord gateway client. MessageContent and GuildMembers are privileged intents —
// both must stay enabled for the bot in the Discord Developer Portal.
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

// Factory modules: each binds the shared clients and config once and returns its functions.
const claudeModule  = createClaudeModule(anthropic, state, { searchKB, getSourceFiles, trackUsage });
const intentModule  = createIntentModule(anthropic, { SUPPORT_CHANNEL_ID, trackUsage });
const monitorModule = createMonitorModule(anthropic, { trackUsage });

registerMessageHandler(discordClient, state, {
    ANNOUNCEMENTS_CHANNEL_ID,
    TWEETS_CHANNEL_ID,
    GENERAL_CHANNEL_ID,
    SUPPORT_CHANNEL_ID,
    STAFF_EXPLANATION_CHANNEL_ID,
    BOT_ANSWER_CHANNEL_IDS,
    STAFF_ROLE_IDS,
    REPORTS_CHANNEL_ID,
    SUPPORT_TICKET_CATEGORY_IDS,
    COLLAB_CATEGORY_IDS,
    CHINESE_DISCORD_CHANNEL_ID,
    SCAM_LOG_CHANNEL_ID,
}, {
    claude:  claudeModule,
    intent:  intentModule,
    kbSync:  { syncBlog, syncDocs, registerBlogInIndex, registerDocInIndex, loadUsageStats, PRICE_INPUT, PRICE_OUTPUT, BLOG_SITEMAP_URL },
    utils:   { isStaff, isBotMentioned, stripBotMention, looksResolved, trackerKey, getMonthLabel, ensureDir, appendToMonthlyWeeklyFile, saveQAPair, looksLikeSpoofedName, looksLikeHelperOffer },
    buildIndex,
    searchKB,
    scrapeSingleArticle,
    htmlToMarkdown,
    EmbedBuilder,
    scamTracker,
    loadCoreFacts:   claudeModule.loadCoreFacts,
    monitor:         monitorModule,
    getWeeklyStats,
    generateCommunityReport: (client, platform, reportType, model) => generateCommunityReport(client, {
        GENERAL_CHANNEL_ID,
        SUPPORT_CHANNEL_ID,
        REPORTS_CHANNEL_ID,
        CHINESE_DISCORD_CHANNEL_ID,
        CHINESE_TELEGRAM_TOPIC_ID,
        anthropic,
        platform,
        reportType,
        model,
    }),
});

// ─── Staff name cache ─────────────────────────────────────────────────────────

// Rebuilds state.staffNameCache (normalized staff display names) for the name-spoof
// detector. Runs on clientReady and again daily from cron. Names shorter than 4
// letters after normalizing are skipped — too short to match safely.
async function buildStaffNameCache(guild, staffRoleIds) {
    if (!guild || staffRoleIds.length === 0) return;
    try {
        const members = await guild.members.fetch();
        state.staffNameCache.clear();
        let count = 0;
        for (const member of members.values()) {
            if (!staffRoleIds.some(id => member.roles.cache.has(id))) continue;
            const original   = member.displayName;
            const normalized = normalizeDisplayName(original);
            if (normalized.length >= 4) {
                state.staffNameCache.set(normalized, original);
                count++;
            }
        }
        state.staffNameCacheTs.value = Date.now();
        console.log(`[SpoofDetect] Staff name cache built — ${count} entries`);
    } catch (err) {
        console.error('[SpoofDetect] Failed to build staff name cache:', err.message);
    }
}

// ─── Gateway resilience ─────────────────────────────────────────────────────
// discord.js normally auto-reconnects on a dropped WebSocket, but a zombie
// connection (socket never closes, just stops delivering events) isn't a
// "disconnect" it can detect — the process stays "online" in PM2 while
// silently receiving nothing. Added 2026-09-01 after a ~6h silent outage
// went unnoticed (Telegram, a separate client, kept working the whole time).
// These listeners make the failure visible; the watchdog below recovers from it.

discordClient.on('error', err => console.error('[Bot] Client error:', err.message));
discordClient.on('shardError', (err, id) => console.error(`[Bot] Shard ${id} error:`, err.message));
discordClient.on('shardDisconnect', (event, id) => console.warn(`[Bot] Shard ${id} disconnected (code ${event.code})`));
discordClient.on('shardReconnecting', id => console.warn(`[Bot] Shard ${id} reconnecting...`));
discordClient.on('shardResume', (id, replayed) => console.log(`[Bot] Shard ${id} resumed (${replayed} events replayed)`));

// Time of the last Discord gateway event of any kind — the watchdog below compares against it.
let lastGatewayActivity = Date.now();
discordClient.on('raw', () => { lastGatewayActivity = Date.now(); });

const GATEWAY_SILENCE_LIMIT_MS = 30 * 60 * 1000; // 30 min with zero gateway events = assume dead
setInterval(() => {
    const silentFor = Date.now() - lastGatewayActivity;
    if (silentFor > GATEWAY_SILENCE_LIMIT_MS) {
        console.error(`[Bot] No Discord gateway activity for ${Math.round(silentFor / 60000)} min — exiting so PM2 restarts the process`);
        process.exit(1);
    }
}, 5 * 60 * 1000);

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

    const guild = discordClient.guilds.cache.first();
    await buildStaffNameCache(guild, STAFF_ROLE_IDS).catch(err =>
        console.error('[SpoofDetect] Initial cache build failed:', err.message)
    );

    // ── Telegram adapter (created before slash handler so getMemberCount can be passed in)
    let tgMemberCount = null;
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const topicIds  = (TELEGRAM_TOPIC_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
        const tgAdapter = createTelegramAdapter({
            token:                 TELEGRAM_BOT_TOKEN,
            allowedChatId:         TELEGRAM_CHAT_ID,
            allowedTopicIds:       topicIds,
            logOnlyTopicIds:       CHINESE_TELEGRAM_TOPIC_ID ? [CHINESE_TELEGRAM_TOPIC_ID] : [],
            state,
            answerQuestion:        claudeModule.answerQuestion,
            searchKB,
            classifyMessageIntent: intentModule.classifyMessageIntent,
            checkWatchedFUD:       intentModule.checkWatchedFUD,
            logTelegramMessage:    intentModule.logTelegramMessage,
            logTelegramIntent:     intentModule.logTelegramIntent,
            RESPOND_INTENTS:       intentModule.RESPOND_INTENTS,
            looksResolved,
            SUPPORT_CHANNEL_ID,
            buildCommunityReport: (opts) => buildCommunityReport(anthropic, {
                GENERAL_CHANNEL_ID,
                SUPPORT_CHANNEL_ID,
                CHINESE_DISCORD_CHANNEL_ID,
                CHINESE_TELEGRAM_TOPIC_ID,
                ...opts,
            }),
            getMemberStats,
            getTgMemberStats,
            getWeekRange,
            getDayRange,
            getDiscordMemberCount: () => discordClient.guilds.cache.first()?.memberCount ?? '?',
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
            ANNOUNCEMENTS_CHANNEL_ID,
            TWEETS_CHANNEL_ID,
            GENERAL_CHANNEL_ID,
            SUPPORT_CHANNEL_ID,
            STAFF_EXPLANATION_CHANNEL_ID,
            REPORTS_CHANNEL_ID,
            SUPPORT_TICKET_CATEGORY_IDS,
            COLLAB_CATEGORY_IDS,
            CHINESE_DISCORD_CHANNEL_ID,
            SCAM_LOG_CHANNEL_ID,
        }, {
            kbSync:  { syncBlog, syncDocs, registerBlogInIndex, registerDocInIndex, loadUsageStats, PRICE_INPUT, PRICE_OUTPUT, PRICE_HAIKU_INPUT, PRICE_HAIKU_OUTPUT, BLOG_SITEMAP_URL },
            utils:   { getMonthLabel, ensureDir },
            monitor: monitorModule,
            buildIndex,
            scrapeSingleArticle,
            htmlToMarkdown,
            scamTracker,
            loadCoreFacts:        claudeModule.loadCoreFacts,
            getWeeklyStats,
            getMemberStats,
            getWeekRange,
            getDayRange,
            getTgMemberStats,
            getTelegramMemberCount: tgMemberCount,
            generateCommunityReport: (client, platform, reportType, model, force) => generateCommunityReport(client, {
                GENERAL_CHANNEL_ID,
                SUPPORT_CHANNEL_ID,
                REPORTS_CHANNEL_ID,
                CHINESE_DISCORD_CHANNEL_ID,
                CHINESE_TELEGRAM_TOPIC_ID,
                anthropic,
                platform,
                reportType,
                model,
                force,
            }),
        });
        discordClient.on('interactionCreate', slashHandler);
    } else {
        console.warn('[Slash] No guild found — slash commands not registered');
    }

    // Hourly: drop expired conversation, timer and tracker entries so the state Maps stay small.
    cron.schedule('0 * * * *', () => {
        claudeModule.pruneStaleEntries();
        console.log('[Bot] Pruned stale tracker entries');
    });

    // Daily at midnight: refresh the staff name cache (staff roles or display names may have changed).
    cron.schedule('0 0 */1 * *', async () => {
        const g = discordClient.guilds.cache.first();
        await buildStaffNameCache(g, STAFF_ROLE_IDS).catch(err =>
            console.error('[SpoofDetect] Cache refresh failed:', err.message)
        );
    });
});

// ─── Start ────────────────────────────────────────────────────────────────────

discordClient.login(DISCORD_TOKEN).catch(err => {
    console.error('[Bot] Login failed:', err.message);
    process.exit(1);
});

'use strict';

const fs   = require('fs');
const path = require('path');
const { getLivePrices, isPricingQuestion } = require('./price-fetcher');

// ─── Scam concern detection ───────────────────────────────────────────────────

const SCAM_CONCERN_BLOCK = [
    'SCAM SAFETY: If a user asks whether support they received is real, whether a DM or external site is from River,',
    'or whether a link/app is legitimate, ALWAYS include the following message — do not paraphrase or shorten it:',
    '',
    "If you're receiving help or support from someone outside this server, please be cautious — this is likely a scam.",
    '',
    'A few important things to keep in mind:',
    '• River admins and support staff will never DM you first or ask for your private keys, seed phrase, or login credentials',
    '• You will never be asked to enter your seed phrase on any third-party website',
    '• You will never be asked to connect your wallet to any site other than the official website: <https://riverai.inc>',
    '• Anyone offering help in the general channel or community chat could be a scammer — public channels are not a safe place to receive support',
    "• Always verify who you're speaking to and only use official links",
    '',
    'Official River support is only available through the River Discord server. If you need help, open a support ticket here: <#1212718437164388392>',
    '',
    'Do not proceed with anything until a staff member has confirmed it through the official ticket system.',
    '— end of scam safety message —',
].join('\n');

const SCAM_SOFT_SIGNALS  = /\b(scam|real|legit|legitimate|official|verify|trust|safe|fake|phish|fraud|suspicious|dm|direct message|seed|private key|wallet|recover)\b/i;
const TICKET_CHANNEL_ID  = '1212718437164388392';

function detectScamConcernSync(question) {
    const q = question.toLowerCase();
    return [
        /\bis this (a |an )?(scam|real|legit|legitimate|official|from river|fake)\b/,
        /\b(got|received|getting) (a |an )?(dm|message|pm|direct message)\b[\s\S]{0,80}\b(real|legit|safe|trust|scam|official)\b/,
        /\b(this|the) (link|site|url|website|app|platform)\b[\s\S]{0,60}\b(real|legit|safe|official|legitimate)\b/,
        /\b(asking|asked) (me )?for (my )?(seed( phrase)?|private key|recovery phrase|mnemonic)\b/,
        /\bsomeone (claiming|saying|told me|says|said) (they('re| are)|he'?s|she'?s) (an? )?(admin|staff|support|from river|river (team|support))\b/,
        /\b(how (do i|can i) )?(know|verify|tell|check|confirm) (if |whether )?(this|they|it|it'?s) (is |are )?(real|legit|legitimate|official|safe|from river)\b/,
        /\b(help|support) (outside|in dms?|privately|off.?server|through (dm|telegram|whatsapp))\b/,
        /\b(told|asking|asked|telling) (me |you )?(to )?(dm|inbox|message|pm|contact) (them|him|her)\b/,
        /\b(someone|a user|an account|a person)\b[\s\S]{0,80}\b(offering|offered|saying they can|says they can) help\b/,
        /\bseed phrase\b/,
        /\bprivate key\b/,
    ].some(p => p.test(q));
}

// Factory — binds anthropic client and state to all exported functions.
function createClaudeModule(anthropic, state, { searchKB, getSourceFiles, trackUsage }) {

    async function detectScamConcernLLM(question) {
        try {
            const resp = await anthropic.messages.create({
                model:      'claude-haiku-4-5-20251001',
                max_tokens: 5,
                messages:   [{ role: 'user', content: `Is this message asking whether a DM, external site, link, or person contacting them is a scam or legitimate? Answer only YES or NO.\n\nMessage: ${question.slice(0, 400)}` }],
            });
            trackUsage(resp.usage.input_tokens, resp.usage.output_tokens, 'haiku');
            return resp.content[0].text.trim().toUpperCase().startsWith('Y');
        } catch {
            return true; // fail-safe: include scam block if uncertain
        }
    }

    async function isScamConcern(question) {
        if (detectScamConcernSync(question)) return true;
        if (SCAM_SOFT_SIGNALS.test(question)) return await detectScamConcernLLM(question);
        return false;
    }

    // ─── System prompt ────────────────────────────────────────────────────────

    function getSystemPrompt(includeScamBlock = false, isFollowUp = false) {
        const factsBlock = state.coreFacts.value
            ? `CORE PROJECT FACTS (always true — use these to correct misconceptions):\n${state.coreFacts.value}\n`
            : '';

        return [
            'You are a helpful Discord support bot for River Protocol.',
            '',
            'FORMAT RULES (every response, no exceptions):',
            '1. No --- dividers — use **bold headers**.',
            '2. Wrap URLs in angle brackets: <https://example.com>. For Discord channel/ticket links use <#CHANNEL_ID> format (e.g. <#1212718437164388392>) — never a full URL.',
            '3. Never echo the question back.',
            '4. Concise and friendly. Discord renders markdown.',
            '5. EXTERNAL LINKS: Never share any URL that does not appear in the context provided to you (knowledge base chunks or the LIVE PRICES block). Do not reference third-party tools, checkers, or external websites from your own training knowledge — even if they are real and relevant. If no provided-context link exists for something, omit the link entirely.',
            '',
            factsBlock,
            'SOURCE PRIORITY: corrections > blogs/announcements > docs. Docs may be outdated — defer to corrections and blog posts. If sources conflict, state which you used.',
            '',
            'CONVERSION: Only Conversion 3.0 is active. Default to 3.0 for all conversion questions. Reference 1.0/2.0 only if explicitly asked. If ambiguous, ask: "Are you asking about Conversion 3.0 or an earlier version?" Never apply old 1.0/2.0 figures to current questions.',
            '',
            'RELEVANCE: Only include information that DIRECTLY answers the question. Do not volunteer related requirements, troubleshooting steps, or sub-topics the user did not ask about. No announcements, events, or loosely related content.',
            '',
            'SCOPE: Stop once you have answered the question. Do not append follow-up content after the answer is complete — no scoring explanations, troubleshooting steps, dashboard links, or "also worth knowing" additions unless the user asked for them. Only include extra information if omitting it would make the answer factually wrong or misleading.',
            '',
            'RESPONSE TYPE: Start every response with one of these tags on its own line:',
            'ANSWER:   — direct answer available',
            'CLARIFY:  — too vague; ask ONE clarifying question',
            'ESCALATE: — information unavailable; direct to support',
            '',
            'CLARIFY: Use only when a single question would meaningfully improve your answer.',
            '',
            'ESCALATE: One sentence on what you could not find, then direct to the ticket channel. No lengthy explanation.',
            `<#${TICKET_CHANNEL_ID}>`,
            '',
            'PARTIAL KNOWLEDGE: Answer what you can, then add one line: "For [specific thing], please ask the team: <link>". No separate section.',
            '',
            ...(isFollowUp ? [
                'CONVERSATIONAL BREVITY: This is a follow-up turn in an ongoing exchange, not a fresh question — keep it to 2-4 sentences. ' +
                'Do not re-explain a mechanism you already covered earlier in this conversation; refer back briefly instead ("as explained above") rather than repeating it. ' +
                'If the user is just agreeing, venting, or making an observation rather than raising a new specific claim, a short acknowledgement is enough — do not restate the full mechanic.',
                '',
            ] : []),
            ...(includeScamBlock ? [SCAM_CONCERN_BLOCK, ''] : []),
            'End ANSWER and ESCALATE responses (not CLARIFY) with: SOURCES: <comma-separated knowledge-base sections most relevant to your answer>',
            '',
            'TONE: Acknowledge frustration briefly, then explain the mechanism in a way that gives a logical, non-panic answer. Genuine positives are forward-looking mechanics and incentives (e.g. longer staking = better conversion ratio, more tokens, more voting power) — never backward-looking performance stats like "it was up 50× before" or "it rose 40% at launch". Those comparisons make current dips feel worse, not better. Neutral and factual — never dismissive.',
        ].filter(Boolean).join('\n');
    }

    // ─── Reply chunking ────────────────────────────────────────────────────────
    // Discord hard-caps a single message at 2000 chars. Detailed answers (e.g. full
    // tokenomics/vesting breakdowns) can exceed that — split on paragraph/line
    // boundaries rather than sending one oversized reply that Discord rejects outright.

    function splitForReply(text, limit = 1900) {
        if (text.length <= limit) return [text];

        const paragraphs = text.split(/\n\n+/);
        const chunks = [];
        let current = '';

        for (const para of paragraphs) {
            const candidate = current ? `${current}\n\n${para}` : para;
            if (candidate.length <= limit) {
                current = candidate;
                continue;
            }
            if (current) chunks.push(current);
            if (para.length <= limit) {
                current = para;
                continue;
            }
            // Single paragraph itself exceeds the limit — hard-split on line breaks.
            let remaining = para;
            while (remaining.length > limit) {
                let cut = remaining.lastIndexOf('\n', limit);
                if (cut <= 0) cut = limit;
                chunks.push(remaining.slice(0, cut));
                remaining = remaining.slice(cut).trimStart();
            }
            current = remaining;
        }
        if (current) chunks.push(current);
        return chunks;
    }

    // ─── Response sanitiser ───────────────────────────────────────────────────

    function sanitizeResponse(text) {
        let result = text.replace(/^\s*-{3,}\s*$/gm, '');
        result = result.replace(
            /(?<![<(\[])(https?:\/\/[^\s<>()\[\]'"]+)/g,
            (match) => `<${match}>`
        );
        result = result.replace(/\n{3,}/g, '\n\n').trim();
        return result;
    }

    // ─── Source keyword matcher (used by explanation embed only) ─────────────

    function identifyRelevantSources(question) {
        const qWords = new Set(question.toLowerCase().split(/\W+/).filter(w => w.length > 3));
        return getSourceFiles()
            .map(s => ({
                name:  s.name,
                score: s.content.toLowerCase().split(/\W+/).filter(w => qWords.has(w)).length,
            }))
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(s => s.name);
    }

    // ─── Claude API call ──────────────────────────────────────────────────────

    // Mark the last message with cache_control so the next turn can reuse the
    // entire prior conversation prefix (system + KB context + history) from cache.
    function withCacheOnLastMessage(messages) {
        if (!messages.length) return messages;
        return messages.map((msg, idx) => {
            if (idx !== messages.length - 1) return msg;
            if (typeof msg.content === 'string') {
                return { ...msg, content: [{ type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } }] };
            }
            if (Array.isArray(msg.content) && msg.content.length > 0) {
                const content = msg.content.map((block, bIdx, arr) =>
                    bIdx === arr.length - 1 ? { ...block, cache_control: { type: 'ephemeral' } } : block
                );
                return { ...msg, content };
            }
            return msg;
        });
    }

    async function askClaude(history, includeScamBlock = false) {
        const isFollowUp = history.length > 1;
        const response = await anthropic.messages.create({
            model:      'claude-sonnet-4-6',
            max_tokens: 1024,
            // Two independent cache breakpoints: the system block is identical across every
            // call with the same includeScamBlock/isFollowUp combination (cached across many
            // different users' conversations), while withCacheOnLastMessage caches the growing
            // per-conversation prefix (system + KB context + history) for same-thread follow-ups.
            system: [{ type: 'text', text: getSystemPrompt(includeScamBlock, isFollowUp), cache_control: { type: 'ephemeral' } }],
            messages:   withCacheOnLastMessage(history),
        });

        const { cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite } = response.usage;
        if (cacheRead)  console.log(`[Cache] Hit   — ${cacheRead} tokens from cache`);
        if (cacheWrite) console.log(`[Cache] Write — ${cacheWrite} tokens written to cache`);
        trackUsage(response.usage.input_tokens, response.usage.output_tokens);

        const full     = response.content[0].text.trim();
        const tagMatch = full.match(/^(ANSWER|CLARIFY|ESCALATE):\s*/);
        const type     = tagMatch ? tagMatch[1] : 'ANSWER';
        const body     = tagMatch ? full.slice(tagMatch[0].length).trim() : full;

        const srcIdx = body.lastIndexOf('\nSOURCES:');
        if (srcIdx !== -1) {
            return {
                type,
                answer:  sanitizeResponse(body.slice(0, srcIdx).trim()),
                sources: body.slice(srcIdx + 1).replace(/^SOURCES:\s*/i, '').trim(),
            };
        }
        return {
            type,
            answer:  sanitizeResponse(body),
            sources: type !== 'CLARIFY'
                ? (identifyRelevantSources(history[0]?.content ?? '').join(', ') || 'general knowledge base')
                : '',
        };
    }

    // ─── Chunk re-ranker ──────────────────────────────────────────────────────
    // Single Haiku call rates all retrieved chunks for relevance to the question.
    // Drops chunks scoring below 3/5, always keeping at least MIN_KEEP.

    async function rerankChunks(question, chunks) {
        if (chunks.length <= 2) return chunks;

        const chunkList = chunks
            .map((c, i) => `[${i + 1}] (${path.basename(c.file)})\n${c.text.slice(0, 350)}`)
            .join('\n\n');

        try {
            const resp = await anthropic.messages.create({
                model:      'claude-haiku-4-5-20251001',
                max_tokens: 40,
                messages: [{
                    role: 'user',
                    content:
                        `Question: ${question.slice(0, 300)}\n\n` +
                        `Rate each chunk's relevance: 1=unrelated 2=vague 3=partial 4=relevant 5=directly answers.\n` +
                        `Reply ONLY in this format: "1:N 2:N 3:N ..." — one score per chunk.\n\n` +
                        chunkList,
                }],
            });

            trackUsage(resp.usage.input_tokens, resp.usage.output_tokens, 'haiku');
            const scores = {};
            for (const m of resp.content[0].text.trim().matchAll(/(\d+):(\d)/g)) {
                scores[parseInt(m[1]) - 1] = parseInt(m[2]);
            }

            const MIN_SCORE = 3;
            const MIN_KEEP  = 3;
            const scored    = chunks.map((c, i) => ({ ...c, rerankScore: scores[i] ?? 3 }));
            const passing   = scored.filter(c => c.rerankScore >= MIN_SCORE)
                                    .sort((a, b) => b.rerankScore - a.rerankScore);

            return passing.length >= MIN_KEEP ? passing : scored.slice(0, MIN_KEEP);
        } catch (err) {
            console.error('[Rerank] Failed:', err.message);
            return chunks;
        }
    }

    async function buildInitialHistory(question) {
        state.referralCode.idx++;
        const referralCode = state.REFERRAL_CODES[state.referralCode.idx % state.REFERRAL_CODES.length];

        const kbSearch = searchKB(question);
        const pricePromise = isPricingQuestion(question) ? getLivePrices() : Promise.resolve(null);

        const [{ rawChunks }, prices] = await Promise.all([kbSearch, pricePromise]);
        const reranked     = await rerankChunks(question, rawChunks);
        const finalContext = reranked.map(c => `### ${c.file}\n\n${c.text}`).join('\n\n---\n\n');
        const finalSources = [...new Set(reranked.map(c => c.file))];

        let priceBlock = '';
        if (prices && (prices.riverPts !== null || prices.river !== null)) {
            const lines = [
                'LIVE PRICES (real-time data — use these figures to answer the question directly with the actual current value):',
                'Do NOT deflect to links as the main answer. Give the calculated number, note it fluctuates, and only share a source link if the user specifically asks where to check.',
            ];
            if (prices.riverPts !== null) {
                const per1k = (prices.riverPts * 1000).toFixed(3);
                const per1m = Math.round(prices.riverPts * 1_000_000).toLocaleString();
                const ptsLink = Math.random() < 0.7
                    ? '<https://coinmarketcap.com/currencies/riverpts/>'
                    : '<https://web3.okx.com/token/bsc/0xfc6be825925b7a83d131e33b46efef9084f0e014>';
                lines.push(`River Pts (RIVERPTS): $${prices.riverPts.toFixed(6)} per token | 1,000 pts ≈ $${per1k} | 1M pts ≈ $${per1m}`);
                lines.push(`Source (share only if asked): ${ptsLink}`);
            }
            if (prices.river !== null) {
                const riverLink = Math.random() < 0.7
                    ? '<https://coinmarketcap.com/currencies/river/>'
                    : '<https://web3.okx.com/token/bsc/0xda7ad9dea9397cffddae2f8a052b82f1484252b3>';
                lines.push(`$RIVER token: $${prices.river.toFixed(4)} per token`);
                lines.push(`Source (share only if asked): ${riverLink}`);
            }
            priceBlock = lines.join('\n') + '\n\n';
        }

        const history = [{ role: 'user', content: `ASSIGNED REFERRAL CODE: If this conversation requires giving a user a registration referral code, use exactly: ${referralCode}\n\n${priceBlock}Relevant context:\n${finalContext}\n\nQuestion: ${question}` }];
        return { history, sources: finalSources };
    }

    // ─── Conversation state helpers ───────────────────────────────────────────

    function setConversation(key, convState) {
        const existing = state.conversationState.get(key);
        if (existing && existing.botMsgId) state.botMsgIndex.delete(existing.botMsgId);
        state.conversationState.set(key, convState);
        if (convState.botMsgId) state.botMsgIndex.set(convState.botMsgId, key);
    }

    function deleteConversation(key) {
        const existing = state.conversationState.get(key);
        if (existing && existing.botMsgId) state.botMsgIndex.delete(existing.botMsgId);
        state.conversationState.delete(key);
    }

    // ─── Core answer function ─────────────────────────────────────────────────

    async function answerQuestion({ question, targetMessage, userId, channelId, existingHistory = null, ragSources = null }) {
        const key          = `${userId}::${channelId}`;
        const tracker      = state.rephrasingTracker.get(key);
        const withinWindow = tracker && (Date.now() - tracker.lastAnsweredAt) < state.REPHRASE_WINDOW_MS;

        if (withinWindow && tracker.answerCount >= state.MAX_BOT_ANSWERS_BEFORE_TICKET) {
            state.rephrasingTracker.delete(key);
            deleteConversation(key);
            await targetMessage.reply(
                "I've tried my best but haven't been able to fully resolve your question. " +
                "Please open a support ticket so a staff member can help you directly — <#1212718437164388392>"
            );
            return;
        }

        let questionText = question;
        if (!questionText && existingHistory) {
            const lastUser = [...existingHistory].reverse().find(t => t.role === 'user');
            if (lastUser) questionText = lastUser.content;
        }
        questionText = questionText || '';

        try {
            let history, sources, scamFlag;
            if (existingHistory) {
                history  = existingHistory;
                sources  = ragSources || [];
                // Also check the original question (first user turn) — a scam-flagged opening question
                // should keep the scam block on follow-up turns even if the follow-up itself is benign.
                const firstUser = existingHistory.find(t => t.role === 'user');
                // Extract the actual question from "Relevant context:...\n\nQuestion: ..." or "...\n\nFollow-up: ..."
                // to avoid matching scam keywords that appear in the KB context chunks.
                const originalQuestion = firstUser
                    ? (firstUser.content.match(/\n\n(?:Question|Follow-up):\s*([\s\S]+)$/i)?.[1]?.trim() ?? firstUser.content)
                    : '';
                const checks = [isScamConcern(questionText)];
                if (originalQuestion && originalQuestion !== questionText) checks.push(isScamConcern(originalQuestion));
                scamFlag = (await Promise.all(checks)).some(Boolean);
            } else {
                const [histResult, flag] = await Promise.all([
                    buildInitialHistory(question),
                    isScamConcern(questionText),
                ]);
                ({ history, sources } = histResult);
                scamFlag = flag;
            }

            const { type, answer } = await askClaude(history, scamFlag);
            const isDiscord = !channelId.startsWith('tg_');
            const footer    = (isDiscord && (type === 'ANSWER' || type === 'CLARIFY'))
                ? '\n-# To follow up: reply to this message or @RiverAiBot — no wait.'
                : '';
            let botReply;
            for (const chunk of splitForReply(answer + footer)) {
                botReply = await targetMessage.reply(chunk);
            }
            state.ragSourcesMap.set(botReply.id, { sources, storedAt: Date.now() });

            if (type === 'CLARIFY') {
                setConversation(key, {
                    history:      [...history, { role: 'assistant', content: answer }],
                    botMsgId:     botReply.id,
                    channelId,
                    lastActivity: Date.now(),
                });
                console.log(`[Answer] [CLARIFY] Asked follow-up to ${userId} in #${channelId}`);
            } else {
                if (type === 'ANSWER') {
                    // Keep history so follow-ups without reply/tag still get context (expires via CONV_EXPIRY_MS)
                    setConversation(key, {
                        history:      [...history, { role: 'assistant', content: answer }],
                        botMsgId:     botReply.id,
                        channelId,
                        lastActivity: Date.now(),
                        isAnswered:   true,
                    });
                } else {
                    deleteConversation(key);
                }
                const existing = state.rephrasingTracker.get(key);
                state.rephrasingTracker.set(key, {
                    answerCount:    (existing ? existing.answerCount : 0) + 1,
                    lastAnsweredAt: Date.now(),
                });
                console.log(`[Answer] [${type}] Replied to ${userId} in #${channelId}`);
            }
        } catch (err) {
            console.error('[Answer] Failed:', err.message);
            try {
                await targetMessage.reply(
                    'Sorry, I ran into an error answering your question. Please try again or open a support ticket — <#1212718437164388392>'
                );
            } catch { /* ignore */ }
        }
    }

    // ─── Prune stale state entries (runs hourly) ──────────────────────────────

    function pruneStaleEntries() {
        const now      = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;
        for (const [key, val] of state.rephrasingTracker) {
            if (now - val.lastAnsweredAt > state.REPHRASE_WINDOW_MS) state.rephrasingTracker.delete(key);
        }
        for (const [key, val] of state.recentQuestions) {
            if (now - val.storedAt > ONE_HOUR) state.recentQuestions.delete(key);
        }
        for (const [key, val] of state.conversationState) {
            if (now - val.lastActivity > state.CONV_EXPIRY_MS) {
                state.botMsgIndex.delete(val.botMsgId);
                state.conversationState.delete(key);
            }
        }
        for (const [key, val] of state.ragSourcesMap) {
            if (now - val.storedAt > state.CONV_EXPIRY_MS) state.ragSourcesMap.delete(key);
        }
        for (const [key, ts] of state.staffEngaged) {
            if (now - ts > state.STAFF_ENGAGED_WINDOW_MS) state.staffEngaged.delete(key);
        }
        for (const [key, val] of state.pendingQuestions) {
            if (now - val.storedAt > state.STAFF_WAIT_MS + 10 * 60 * 1000) {
                clearTimeout(val.timer);
                state.pendingQuestions.delete(key);
                for (const m of val.messages) state.pendingMsgIndex.delete(m.id);
            }
        }
        for (const [key, val] of state.recentCommunityDiscussion) {
            if (now - val.storedAt > state.COMMUNITY_DISC_WINDOW_MS) state.recentCommunityDiscussion.delete(key);
        }
    }

    // ─── Core facts loader ────────────────────────────────────────────────────

    function loadCoreFacts() {
        const p = path.join(__dirname, '..', 'knowledge-base', 'core-facts.md');
        if (fs.existsSync(p)) {
            state.coreFacts.value = fs.readFileSync(p, 'utf8').trim();
            console.log('[Bot] Core facts loaded');
        }
    }

    return {
        isScamConcern,
        getSystemPrompt,
        askClaude,
        buildInitialHistory,
        answerQuestion,
        setConversation,
        deleteConversation,
        identifyRelevantSources,
        pruneStaleEntries,
        loadCoreFacts,
    };
}

module.exports = { createClaudeModule };

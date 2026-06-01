'use strict';

const fs   = require('fs');
const path = require('path');

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
    '• You will never be asked to connect your wallet to any site other than the official website: <https://river.inc>',
    '• Anyone offering help in the general channel or community chat could be a scammer — public channels are not a safe place to receive support',
    "• Always verify who you're speaking to and only use official links",
    '',
    'Official River support is only available through tickets in this server. If you need help, open one here: <#1212718437164388392>',
    '',
    'Do not proceed with anything until a staff member has confirmed it through the official ticket system.',
    '— end of scam safety message —',
].join('\n');

const SCAM_SOFT_SIGNALS = /\b(scam|real|legit|legitimate|official|verify|trust|safe|fake|phish|fraud|suspicious|dm|direct message|seed|private key|wallet|recover)\b/i;

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

    function getSystemPrompt(includeScamBlock = false) {
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
            '',
            factsBlock,
            'SOURCE PRIORITY: corrections > blogs/announcements > docs. Docs may be outdated — defer to corrections and blog posts. If sources conflict, state which you used.',
            '',
            'CONVERSION: Only Conversion 3.0 is active. Default to 3.0 for all conversion questions. Reference 1.0/2.0 only if explicitly asked. If ambiguous, ask: "Are you asking about Conversion 3.0 or an earlier version?" Never apply old 1.0/2.0 figures to current questions.',
            '',
            'RELEVANCE: Only include information that DIRECTLY answers the question. No announcements, events, or loosely related content.',
            '',
            'RESPONSE TYPE: Start every response with one of these tags on its own line:',
            'ANSWER:   — direct answer available',
            'CLARIFY:  — too vague; ask ONE clarifying question',
            'ESCALATE: — information unavailable; direct to support',
            '',
            'CLARIFY: Use only when a single question would meaningfully improve your answer.',
            '',
            'ESCALATE: One sentence on what you could not find, then direct to the ticket channel. No lengthy explanation.',
            '<#1212718437164388392>',
            '',
            'PARTIAL KNOWLEDGE: Answer what you can, then add one line: "For [specific thing], please ask the team: <link>". No separate section.',
            '',
            ...(includeScamBlock ? [SCAM_CONCERN_BLOCK, ''] : []),
            'TONE: Acknowledge frustration briefly, then highlight genuine positives (longer staking = more tokens + voting power + River Pts). Neutral and factual — never dismissive.',
        ].filter(Boolean).join('\n');
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

    async function askClaude(history, includeScamBlock = false) {
        state.referralCode.idx++;
        const dynamicPart = `ASSIGNED REFERRAL CODE: If this conversation requires giving a user a registration referral code, use exactly: ${state.REFERRAL_CODES[state.referralCode.idx % state.REFERRAL_CODES.length]}\n\nEnd ANSWER and ESCALATE responses (not CLARIFY) with:\nSOURCES: <comma-separated knowledge-base sections most relevant to your answer>`;

        const response = await anthropic.messages.create({
            model:      'claude-sonnet-4-6',
            max_tokens: 1024,
            system: [
                { type: 'text', text: getSystemPrompt(includeScamBlock), cache_control: { type: 'ephemeral' } },
                { type: 'text', text: dynamicPart },
            ],
            messages: history,
        });

        if (response.usage.cache_read_input_tokens) {
            console.log(`[Cache] Hit — ${response.usage.cache_read_input_tokens} tokens served from cache`);
        }
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
        const { sources, rawChunks } = await searchKB(question);
        const reranked     = await rerankChunks(question, rawChunks);
        const finalContext = reranked.map(c => `### ${c.file}\n\n${c.text}`).join('\n\n---\n\n');
        const finalSources = [...new Set(reranked.map(c => c.file))];
        const history      = [{ role: 'user', content: `Relevant context:\n${finalContext}\n\nQuestion: ${question}` }];
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
                "Please open a support ticket so a staff member can help you directly: <#1212718437164388392>"
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
            const botReply = await targetMessage.reply(answer);
            state.ragSourcesMap.set(botReply.id, { sources, storedAt: Date.now() });
            state.botReplied.set(key, Date.now());

            if (type === 'CLARIFY') {
                setConversation(key, {
                    history:      [...history, { role: 'assistant', content: answer }],
                    botMsgId:     botReply.id,
                    channelId,
                    lastActivity: Date.now(),
                });
                console.log(`[Answer] [CLARIFY] Asked follow-up to ${userId} in #${channelId}`);
            } else {
                deleteConversation(key);
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
                    'Sorry, I ran into an error answering your question. Please try again or open a support ticket: <#1212718437164388392>'
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
        for (const [key, ts] of state.botReplied) {
            if (now - ts > state.BOT_REPLIED_WINDOW_MS) state.botReplied.delete(key);
        }
        for (const [key, val] of state.pendingQuestions) {
            if (now - val.storedAt > state.STAFF_WAIT_MS + 10 * 60 * 1000) {
                clearTimeout(val.timer);
                state.pendingQuestions.delete(key);
            }
        }
    }

    // ─── Core facts loader ────────────────────────────────────────────────────

    function loadCoreFacts() {
        const p = path.join(__dirname, 'knowledge-base', 'core-facts.md');
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

module.exports = { createClaudeModule, SCAM_CONCERN_BLOCK };

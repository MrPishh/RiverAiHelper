# Message Intent Taxonomy

Built from real message samples observed in #general and #support.
Last updated: 2026-09-01

---

## How this is used

Each incoming message is classified into one intent category. The category determines the default bot behaviour. Context rules (see bottom) can override the category decision regardless of intent.

---

## Categories

### Respond — bot should answer

| Category | Description | Example |
|---|---|---|
| `help-seeking` | User has a genuine question about the protocol — mechanics, how something works, what something means. Also includes "anyone received X?" / "did anyone get X?" about rewards or airdrops — the "anyone" framing is a social softener; the asker typically didn't receive theirs. Also includes frustrated venting about protocol mechanics. Does NOT include a matter-of-fact statement explaining why something is happening, with no confusion or question of the speaker's own — that's `community-help` or `community-discussion` even though it uses the same staking/price vocabulary. | "How does Conversion 3.0 work?" / "Why are my River Pts not accruing?" / "anyone received the Pizza day reward?" |
| `troubleshooting` | User reporting a specific problem they are experiencing with the product | "I staked 12 months and no points after 2 weeks" |
| `onboarding` | New user asking how to get started, sign up, or register for the platform itself — not general "how does X mechanic work" questions once already using the product | "How do I join River4FUN?" / "What referral code do I use?" / "Referral code please" / "anyone have a referral code?" |
| `factual-question` | Specific question about token, staking, conversion rate, epoch, contract address etc. | "What is the ideal rate for S5?" / "Where is the RIVER token address?" |

---

### Do not respond — bot should stay silent

| Category | Description | Example |
|---|---|---|
| `community-hype` | Celebration, milestone reaction, price hype, general positivity about the project. Includes stated hopes, wishes, or predictions about future price/token amounts with no confusion or complaint attached. | "River going global! $RIVER community is everywhere 🌍" / "hoping for 4 dollars only" |
| `safety-alert` | Scam warning, impersonation alert, security notice posted FOR community awareness by a legitimate member | "⚠️ Fake River support accounts spotted on X — block and report" / "Scammer" (calling out a bad actor) |
| `scam-content` | Active phishing, fake support offers, wallet drainer links, or social engineering posted BY a scammer disguised as help. Requires an actual action from the sender — a link, DM offer, or redirect. A bare accusation with no link/offer attached (e.g. a lone "Scammer", "scam!", "fake") is not enough on its own — that's `safety-alert`. Includes the targeted form (reply/redirect aimed at a visible victim) AND the untargeted broadcast form (standalone announcement inviting the whole channel to contact "the team"/"support" via an external link, no victim message needed) | "FOR HELP GO TO X — [external link]" / "Use this app to restore your wallet 👇" / "Accept my friend request, I'll help you" / "DM me, I'm an admin" / "I can help you, just DM me" / "How can we help? Message me directly" (soft redirect with no admin claim — especially from accounts with display names resembling staff) / "For support DM us on Twitter: @[handle]" / "Contact River support here: [telegram link]" / "Reach us at [whatsapp/external link] for faster help" / unsolicited third-party links posted as replies to users reporting problems / "Share Your Questions/Issues to the team: [link] 👋" (unprompted broadcast, no victim in thread) |
| `content-promotion` | User sharing their own content, project, or service — threads, articles, videos, unsolicited business/freelance offers, exchange listing pitches | "Just dropped a thread on why $RIVER is still the play 🌊 Drop a like!" / "Does anyone need a bot developer? DM me" / "We'd like to list your project on WEEX Exchange" |
| `referral-sharing` | User sharing their own referral code for others to use. Does NOT include a user asking for/requesting a code from others — that's `onboarding`, not this | "My code: animeshlogs — app.river.inc/fun?ref=animeshlogs" |
| `community-discussion` | Opinion poll or strategy question directed at the community, not at the bot. Does NOT include "anyone received X?" messages about personal reward receipt — those are `help-seeking`. | "DAC 3.0 — best time to convert, early season or end? Drop your strategy 👇" |
| `community-announcement` | User sharing information for the community — event coverage, project updates | "Thanks for the info! River events across HK, Paris, Dubai, Seoul..." |
| `staff-ping` | User trying to get a human's attention for a ticket or prior issue, not asking a protocol question | "Pls help check my ticket 4255-psquare0845_17165 @RiverAiBot" |
| `community-help` | Another community member has stepped in to try to help the original person, or is making a matter-of-fact explanation of a mechanic with no addressee named | "Got any error message?" / "The staking system works in epochs..." / "That's due to S1 staking, price recovers once it's done" |
| `general-greeting` | Greetings, thanks, acknowledgements with no question | "Good morning" / "Thanks!" / "Got it 👍" |
| `community-conduct` | User being visibly abusive or disrespectful TO other real community members in the channel — not venting at a scammer or a deleted message | Unprompted personal attacks or harassment directed at identifiable users |

---

## Context rules (override category)

These apply regardless of what category a message falls into.

| Rule | Condition | Bot behaviour |
|---|---|---|
| Staff engaged | Staff has already replied in the thread | Do not respond unless directly @mentioned |
| Already handled | The original question has already received a bot answer in this thread | Do not pile on with a second response |
| Community stepped in | A non-staff community member has replied to the original message | Do not respond — intent and whether to intervene depends on what they said and whether it helps or harms. Default: stay out. |
| Thread noise | Multiple people have replied and the conversation is active | Do not add to the noise. If the question still needs answering, it belongs in a ticket. |

---

## Edge cases and notes

**`safety-alert` vs `scam-content` — who is posting matters**
Both involve scam-related content but the sender and intent are opposite. `safety-alert` is a legitimate community member doing a public service — warning others about a threat. `scam-content` is the threat itself — a bad actor posting phishing links or fake support offers, usually disguised as community help. The key signals for `scam-content`: unsolicited external links posted within seconds of a user reporting a problem; "DM me"; "I'm an admin"; offers to restore wallets or sync dashboards via third-party apps; pressure to act quickly or privately. When in doubt between the two, check whether the sender appears to be warning the community or targeting an individual user.

**Telegram vs Discord mention mechanics — bare mentions are not equally risky**
Discord mentions (`<@id>`) are ID-based and resolved through the UI — a bare mention with no other text is common and benign (pinging someone for attention, handing a user off to another member: "wait for admin to guide you `<@id>` `<@id>`"). Telegram mentions are typed `@username` text, and Telegram requires every bot account's username to end in "bot" — so a message that is nothing but `@SomeExchangeBot` is a recognizable Telegram-specific spam pattern (bare mentions of exchange-branded ad bots), with no Discord equivalent; a bare Discord `<@id>` mention should never be treated as a scam signal on its own. Real finding (2026-08-18 batch audit): several Telegram messages consisting only of a bare exchange-bot handle were misclassified as `general-greeting`/`staff-ping` instead of `scam-content`. Note: Telegram does not auto-moderate (delete/timeout) first-time posters based on intent classification the way Discord does — `scam-content` on Telegram governs the bot's reply-gating and log/report accuracy, not automated moderation actions; deletion there only ever applies to users an admin has already placed on the watchlist via `/tgwatch`.

**Unsolicited "how can I help you?" — context-dependent, not automatic**
An unprompted offer of help from a non-staff account is often (roughly 80% in reviewed samples) a scammer's opening line when posing as staff — but can also be a community member genuinely offering assistance in odd phrasing. Treat as a signal that needs reply/thread context, not an automatic `scam-content` classification on the phrase alone: check whether it was directed at someone who just reported a problem before concluding scam.

**Bare accusation words are `safety-alert`, not `scam-content`**
A standalone call-out with no link, DM offer, or redirect attached — "Scammer", "Scam!", "Fake account" — is a community member flagging a threat, not the threat itself. `scam-content` requires the sender to be *doing* something (posting a link, offering DM help, redirecting off-platform); accusing someone of being a scammer is the opposite behavior. Real miss (2026-08-18 batch audit): a standalone "Scammer" message was classified `scam-content`, triggering deletion + timeout of what was very likely a member warning the community — despite this exact pattern already being a documented `safety-alert` example above.

**`content-promotion` vs `scam-content` — generic pitch vs targeted redirect**
Unsolicited business/service offers (freelance dev pitches, exchange listing solicitations) broadcast generally to the channel are `content-promotion` — self-promotion of a service, not an attack. The same "DM me" phrasing becomes `scam-content` when posted in reply to (or within seconds of) someone reporting a problem — the existing DM-redirect/external-platform rule takes priority regardless of how polite the offer sounds. Real finding (2026-08-18 batch audit): these pitches didn't map to any category — some got pushed into `scam-content`, others `community-discussion`, with visible reviewer uncertainty in the responses.

**`referral-sharing` requires the sender's own code — requests are `onboarding`**
The distinguishing signal is whether a code appears *in the message* (sharing) or is being *requested* (asking). "My code: X" / "use my ref: X" → `referral-sharing`. "Referral code please" / "anyone have a code?" / "I need a discord ref code" → `onboarding`, since it's a new user asking how to get started. Real finding (2026-08-18 batch audit): 10 of 12 sampled `referral-sharing` messages were actually requests, not shares — all silently dropped as "do not respond" when they should have gotten an onboarding-style answer.

**`onboarding` vs `help-seeking`/`factual-question` — signup vs mechanics**
`onboarding` is narrowly about getting started: joining, signing up, registering, referral codes. Questions about how an existing mechanic works — staking, points, conversion — belong to `help-seeking` or `factual-question` even if asked by a new-sounding user. Real finding (2026-08-18 batch audit): "How do i stake?" and "How to get points?" were classified `onboarding` but should be `factual-question`/`help-seeking`; "New here" with no question attached should be `general-greeting`, not `onboarding`, since no request is being made.

**`scam-content` vs `community-help` — disguise detection**
Scammers deliberately mimic `community-help` surface patterns ("I can help", "use this", "try this app"). The distinction: genuine community help references the protocol, asks clarifying questions, or explains a mechanic. Scam content redirects the user away from the channel — to external apps, DMs, X.com links, or third-party sites — especially when the user has just reported a problem. Thread context matters: if multiple accounts post external links within seconds of a victim's message, that velocity alone is a strong `scam-content` signal.

**`scam-content` doesn't require a visible victim — broadcast-style redirects count too**
Most scam-content examples are a reply/redirect aimed at someone who just posted a problem, but a scammer can also post an unprompted standalone announcement to the whole channel inviting people to send questions/issues to "the team" via an external link — no victim message needed in the thread at all. Real miss (2026-09-01): "Share Your Questions/Issues to the team: [x.com link] 👋" went unclassified as scam-content — the tier-1 regex only recognized "report/contact/reach the team" immediately adjacent to those words, so "Share ... to the team" (different verb, extra words in between) slipped through to the general classifier, which likely read it as `community-announcement` since there was no visible victim to redirect. Fixed the regex (`src/intent.js`) to accept more verbs and a gap between verb and "team"/"support"/"us", and broadened this category's description so the general classifier also treats the untargeted broadcast form as scam-content on its own, without needing help-seeker context in the thread.

**External platform redirects for "support" are always `scam-content`**
River's official support channel is Discord tickets only. No legitimate staff or community member will redirect users to Twitter/X DMs, Telegram, WhatsApp, or any external platform for support. Any message that directs a user to seek help outside this Discord — regardless of how official the handle looks, how politely it is phrased, or whether it claims to be River staff — should be classified as `scam-content`. The handle or link doesn't need to look fake; the redirect itself is the signal. Example patterns: "DM us on Twitter for faster support", "our support team is on Telegram", "contact @[any handle] for help", posting any external link in reply to someone reporting a problem.

**Display name spoofing + soft DM offer**
A known attack pattern: scammer sets their display name to closely resemble a staff member's (e.g. "R1verSupport" vs "RiverSupport", one character substituted or added), then posts a soft offer like "How can I help you?" or "I can assist, just DM me" — no admin claim, no link, nothing obviously suspicious in the text alone. Classification signal: any non-staff message that offers personal assistance and redirects to DMs is `scam-content`, regardless of how polite or vague the phrasing is. No legitimate community member redirects users to DMs for River support.

**Community member giving wrong information**
Default is still to stay out. The risk of a bot correction: if the community member is building fake trust (potential scammer), the bot engaging with them gives their presence more legitimacy. If they are genuinely trying to help, the bot correcting them publicly undermines them. Staff should handle factual corrections in public threads.

**Abusive messages directed at scammers vs community members**
Context determines the category. "You want your mom to get laid?" replying to a scammer's deleted message is venting at a bad actor — not community abuse. The same message directed at a real community member unprovoked is `community-conduct`. Check what the message is replying to before classifying. When `community-conduct` is confirmed, the bot can step in briefly to ask the person to keep the space respectful — but should not escalate or lecture.

**@mention does not always mean "answer this"**
A user @mentioning the bot while asking for a ticket check or human admin is not a protocol question. The @mention is a reach for any attention. Intent still needs to be classified — the trigger mechanism does not determine the response.

**Community-discussion vs help-seeking**
Both can contain "?" and protocol terminology. The distinction: help-seeking is the user asking for information they personally need. Community-discussion is the user inviting the community to share opinions or strategies. Phrasing signals: "Drop your strategy below", "what do you think", "anyone else" → community-discussion.

Exception: "anyone received X?", "did anyone get X?", "has anyone got X?" about rewards, airdrops, or points → **help-seeking**. The "anyone" is a social softener — the asker is checking if others got it because they didn't. These are not genuine community polls.

**Explaining vs asking — the deciding signal is whose confusion it is**
Help-seeking's staking/price venting clause is broad on purpose, but it only covers the speaker's *own* confusion, frustration, or question. A statement that explains why something is happening, with no complaint or question attached, is `community-help` (or `community-discussion` if not aimed at anyone) even though it shares the same vocabulary. Real false positive (2026-07-30, Telegram): "Thats due to S1 staking" / "When all S1 staking will be done we can see the price and project go back" was classified as help-seeking and triggered an unwanted auto-reply — the speaker was informing, not asking. Check for the speaker's own confusion/question before matching on topic keywords.

**Price/reward hopes vs help-seeking venting**
Help-seeking's staking/price venting clause is also broad on purpose, but it only covers the speaker's own confusion, frustration, or complaint. A stated hope, wish, or prediction about a future price or token amount — with no confusion, complaint, or question attached — is `community-hype`, not `help-seeking`. Real false positive (2026-07-30, Telegram): "Il hoping for 4 dollars only" was classified as help-seeking and triggered an unwanted auto-reply explaining the conversion mechanism — the speaker was expressing a wish, not asking anything. Same underlying pattern as the "explaining vs asking" edge case above: broad topic vocabulary (price, staking, tokens) can match multiple categories, so check for the speaker's own confusion/complaint/question before defaulting to help-seeking.

**Unclear/vague questions**
If intent cannot be determined but the message looks like it could be help-seeking, classify as help-seeking and let the CLARIFY response type handle it. The bot asking one clarifying question is lower risk than staying silent on a genuine issue.

---

## Status

- [x] Classification logic implemented in `src/intent.js` (2026-05-12) — Haiku classifier with channel, reply-to, and recent thread context
- [x] `scam-content` category added (2026-05-12) — prevents scammer replies from suppressing pending bot timers
- [x] Module moved from `bot.js` into `src/intent.js` (2026-06-01) as part of src/ reorganisation
- [x] `scam-content` taxonomy expanded (2026-06-06) — added soft DM redirect examples, display name spoofing note, external-platform-redirect rule
- [x] Scammer-side tier-1 hard sync added to `src/intent.js` (2026-06-06) — bio/profile redirects + t.me/wa.me links short-circuit Haiku
- [x] Scammer-side soft sync + Haiku layer added to `src/intent.js` (2026-06-13) — context-dependent patterns (dm me, check my dashboard, etc.) trigger a focused Haiku YES/NO scam check instead of immediate classification. Regex narrows the field; Haiku reasons over reply context and recent thread. Replaces the previous hard-classify approach for ambiguous patterns that also appear in legitimate help-seeking messages.
- [x] Batch audit (2026-08-18, Sonnet reviewer, 2032 classified messages) — found and fixed 4 taxonomy gaps: `scam-content` requiring an actual action vs bare accusation words, `content-promotion` broadened to cover unsolicited service/business pitches, `referral-sharing` narrowed to exclude requests (was catching "referral code please" as a share), `onboarding` narrowed to signup/registration only (was over-catching general mechanics questions)
- [x] Batch audit follow-up (2026-08-18) — full scan of all 2032 disagreements confirmed no category is missing (every reviewer-suggested label maps to an existing category), but surfaced ~100+ messages across nearly every category where the correct answer was `scam-content` — mostly bare Telegram exchange-bot-handle mentions and unsolicited "how can I help you?" openers slipping through undetected. Added both as `SCAM_SOFT_PATTERNS` in `src/intent.js` (routes to Haiku reasoning check, not auto-classification) plus edge-case notes below. Scoped to classification/reply-gating accuracy only — no moderation/timeout logic touched, per explicit instruction that Telegram does not (and should not) auto-moderate first-time posters
- [x] `scam-content` broadcast-form gap fixed (2026-09-01) — an unprompted "Share Your Questions/Issues to the team: [link]" scam post went unblocked in #general because the tier-1 regex only recognized "report/contact/reach the team" adjacent phrasing. Widened the regex (more verbs, tolerant gap) and broadened the category description so the general Haiku classifier also treats untargeted broadcast-style redirects as scam-content without requiring a visible victim in the thread.
- [ ] Per-category enable/disable controls not yet implemented
- [ ] This taxonomy is based on initial samples — refine after reviewing `dc-intent-log.jsonl` / `tg-intent-log.jsonl` data

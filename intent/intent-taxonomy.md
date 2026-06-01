# Message Intent Taxonomy

Built from real message samples observed in #general and #support.
Last updated: 2026-05-12

---

## How this is used

Each incoming message is classified into one intent category. The category determines the default bot behaviour. Context rules (see bottom) can override the category decision regardless of intent.

---

## Categories

### Respond — bot should answer

| Category | Description | Example |
|---|---|---|
| `help-seeking` | User has a genuine question about the protocol — mechanics, how something works, what something means | "How does Conversion 3.0 work?" / "Why are my River Pts not accruing?" |
| `troubleshooting` | User reporting a specific problem they are experiencing with the product | "I staked 12 months and no points after 2 weeks" |
| `onboarding` | New user asking how to get started, sign up, or register | "How do I join River4FUN?" / "What referral code do I use?" |
| `factual-question` | Specific question about token, staking, conversion rate, epoch, contract address etc. | "What is the ideal rate for S5?" / "Where is the RIVER token address?" |

---

### Do not respond — bot should stay silent

| Category | Description | Example |
|---|---|---|
| `community-hype` | Celebration, milestone reaction, price hype, general positivity about the project | "River going global! $RIVER community is everywhere 🌍" |
| `safety-alert` | Scam warning, impersonation alert, security notice posted FOR community awareness by a legitimate member | "⚠️ Fake River support accounts spotted on X — block and report" / "Scammer" (calling out a bad actor) |
| `scam-content` | Active phishing, fake support offers, wallet drainer links, or social engineering posted BY a scammer disguised as help | "FOR HELP GO TO X — [external link]" / "Use this app to restore your wallet 👇" / "Accept my friend request, I'll help you" / "DM me, I'm an admin" / unsolicited third-party links posted as replies to users reporting problems |
| `content-promotion` | User sharing their own content — threads, articles, videos | "Just dropped a thread on why $RIVER is still the play 🌊 Drop a like!" |
| `referral-sharing` | User sharing their own referral code for others to use | "My code: animeshlogs — app.river.inc/fun?ref=animeshlogs" |
| `community-discussion` | Opinion poll or strategy question directed at the community, not at the bot | "DAC 3.0 — best time to convert, early season or end? Drop your strategy 👇" |
| `community-announcement` | User sharing information for the community — event coverage, project updates | "Thanks for the info! River events across HK, Paris, Dubai, Seoul..." |
| `staff-ping` | User trying to get a human's attention for a ticket or prior issue, not asking a protocol question | "Pls help check my ticket 4255-psquare0845_17165 @RiverAiBot" |
| `community-help` | Another community member has stepped in to try to help the original person | "Got any error message?" / "The staking system works in epochs..." |
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

**`scam-content` vs `community-help` — disguise detection**
Scammers deliberately mimic `community-help` surface patterns ("I can help", "use this", "try this app"). The distinction: genuine community help references the protocol, asks clarifying questions, or explains a mechanic. Scam content redirects the user away from the channel — to external apps, DMs, X.com links, or third-party sites — especially when the user has just reported a problem. Thread context matters: if multiple accounts post external links within seconds of a victim's message, that velocity alone is a strong `scam-content` signal.

**Community member giving wrong information**
Default is still to stay out. The risk of a bot correction: if the community member is building fake trust (potential scammer), the bot engaging with them gives their presence more legitimacy. If they are genuinely trying to help, the bot correcting them publicly undermines them. Staff should handle factual corrections in public threads.

**Abusive messages directed at scammers vs community members**
Context determines the category. "You want your mom to get laid?" replying to a scammer's deleted message is venting at a bad actor — not community abuse. The same message directed at a real community member unprovoked is `community-conduct`. Check what the message is replying to before classifying. When `community-conduct` is confirmed, the bot can step in briefly to ask the person to keep the space respectful — but should not escalate or lecture.

**@mention does not always mean "answer this"**
A user @mentioning the bot while asking for a ticket check or human admin is not a protocol question. The @mention is a reach for any attention. Intent still needs to be classified — the trigger mechanism does not determine the response.

**Community-discussion vs help-seeking**
Both can contain "?" and protocol terminology. The distinction: help-seeking is the user asking for information they personally need. Community-discussion is the user inviting the community to share opinions or strategies. Phrasing signals: "Drop your strategy below", "what do you think", "anyone else" → community-discussion.

**Unclear/vague questions**
If intent cannot be determined but the message looks like it could be help-seeking, classify as help-seeking and let the CLARIFY response type handle it. The bot asking one clarifying question is lower risk than staying silent on a genuine issue.

---

## Status

- [x] Classification logic implemented in bot.js (2026-05-12) — Haiku classifier with channel, reply-to, and recent thread context
- [x] `scam-content` category added (2026-05-12) — prevents scammer replies from suppressing pending bot timers
- [ ] Per-category enable/disable controls not yet implemented
- [ ] This taxonomy is based on initial samples — refine after more intent-log.jsonl data is reviewed

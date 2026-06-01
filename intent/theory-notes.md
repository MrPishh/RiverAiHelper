# Theoretical Concepts — Intent & Context Classification

Reference notes on frameworks discussed for making the intent + context system more robust.
None of these are implemented yet. Consult when the intent-log data shows a recurring failure pattern.

---

## Speech Act Theory (Austin, Searle)

**The core idea:** Utterances are *acts*, not just information. Every message performs an action — asking, asserting, directing, declaring. The surface form (punctuation, word count, question starters) does not reliably indicate the act being performed.

**Why it matters here:** This is why `looksLikeQuestion()` failed. "You should clear browser cache" is a *directive act* — the speaker is directing someone to do something. "How do I clear my browser cache?" is a *request act*. Same words, same topic, completely different act. Intent classification is essentially speech act classification.

**Where it's already applied:** The intent taxonomy categories map directly to speech act types. `help-seeking` and `troubleshooting` are request acts. `community-help` is a directive act. `community-hype` is an expressive act. The taxonomy is sound — this theory validates the approach.

**When to revisit:** If the classifier consistently mislabels a category, frame the category description in speech act terms (what is the speaker *doing*, not what are they *saying*) to improve the Haiku prompt.

---

## Signal Detection Theory (SDT)

**The core idea:** Any classifier makes two types of error — false positives (responding when it shouldn't) and false negatives (staying silent when it should). These have different costs. SDT provides a principled framework for setting the decision threshold based on the relative cost of each error type.

**Why it matters here:** A false positive (bot responds to community-hype) is more damaging than a false negative (user has to rephrase a question). These costs are not equal. The current fail-open default (unknown intent → treat as `help-seeking`) is an implicit SDT decision — false negatives are considered more costly than false positives.

**What's already implemented:** The fail-open default. When `classifyMessageIntent` fails (API error), it returns `help-seeking` and the bot responds. This is the correct asymmetric default.

**When to revisit:** When intent-log data shows a specific category is consistently generating false positives or false negatives, SDT gives you the language to decide *which direction* to adjust. If `community-discussion` keeps triggering responses it shouldn't, the threshold for that category should shift toward silence. Different categories can have different cost profiles — `troubleshooting` has a very high false-negative cost; `community-hype` has a very high false-positive cost.

---

## Bayesian Inference

**The core idea:** Classification improves when you start with prior probabilities — background knowledge about how likely each category is — before reading the message content. The prior is updated by what the message says (likelihood) to produce a posterior probability. More context → better priors → more accurate classification.

**Why it matters here:** The same message means different things in different contexts. A message in #support is more likely `troubleshooting` than `community-hype`. A message sent 10 minutes after a major announcement is more likely `community-hype` or `factual-question`. A first-time poster is more likely `onboarding`. Haiku currently classifies without these priors.

**What's already implemented:** Channel name and recent thread context are now passed to the classifier. This is informal Bayesian reasoning — giving Haiku the signals it needs to adjust its classification without building a formal model.

**When to revisit:** Once intent-log.jsonl has several weeks of data, the distribution of categories by channel, time-of-day, and user history can be computed. These distributions become formal priors. If `community-hype` spikes on announcement days, the classifier could be primed with a higher prior for that category on those days. User history is the most powerful prior — a user who has asked 5 questions this session has a high prior for `help-seeking` on their next message.

---

## Control Theory (Feedback Loops)

**The core idea:** A system is self-regulating when its own output feeds back to adjust future behaviour. Control theory describes these feedback mechanisms — how quickly the system responds, how long corrections persist, and how to avoid oscillation (over-correcting back and forth).

**Key terms relevant here:**
- *Deadband* — the range where no action is taken (the TTL windows on state maps)
- *Hysteresis* — the system doesn't snap back immediately after a state change (4-hour `staffEngaged` window prevents rapid switching)
- *Integral control* — accumulating signals over time rather than reacting to each one independently

**What's already implemented:** `staffEngaged` (4hr TTL), `botReplied` (5min TTL), self-resolution cancellation, and community-stepped-in cancellation are all feedback mechanisms. The bot's own output (a reply) feeds back to suppress future outputs for the same user.

**When to revisit:** If the bot is oscillating — responding, suppressing, responding — in a pattern that feels wrong, control theory gives you the vocabulary to diagnose it. The TTL values are the control parameters. Integral control would help if the system needs to consider cumulative behaviour: a user who has been answered 5 times this hour should be treated differently than a first-time asker, regardless of the `botReplied` window.

---

## Queuing Theory

**The core idea:** Messages are a queue. The bot is a lower-priority server. Staff are higher-priority servers. When a higher-priority server is available, the lower-priority server should defer. The queue depth and drain rate determine how long to wait before the lower-priority server picks up.

**Why it matters here:** `STAFF_WAIT_MINUTES` (currently 3) is the queue drain time — how long the bot waits to see if the higher-priority server (staff) will handle the item. If staff activity in a channel is high, a longer wait is warranted. If staff rarely engage, a shorter wait is appropriate.

**What's already implemented:** The 3-minute fixed wait via `scheduleAutoAnswer`. The priority structure (staff reply → cancel bot timer) is already correct.

**When to revisit:** If the fixed 3-minute window is too blunt — too long in channels with active staff, too short in channels where staff are rarely present — queuing theory justifies adaptive wait times based on recent staff response rates in that channel. Could be computed from the intent-log or from tracking how often `staffEngaged` is set per channel.

---

## Decision Theory

**The core idea:** For each possible classification outcome, map out the expected cost of each possible action (respond / stay silent / redirect). Make the action that minimises expected cost. Different categories have different cost profiles.

**A simple payoff frame:**

| | Should respond | Should not respond |
|---|---|---|
| Bot responds | Good | Cost A (noise, undermines staff/community) |
| Bot silent | Cost B (user left without help) | Good |

Cost A and Cost B are not equal, and they vary by category:
- `troubleshooting`: Cost B is very high — a user reporting a real problem deserves a response
- `community-hype`: Cost A is very high — bot jumping into celebration is jarring and off-brand
- `community-help`: Cost A is high — bot correcting a community helper undermines them and may legitimise a scammer

**What's already implemented:** The taxonomy's respond/do-not-respond split is an informal decision theory payoff matrix. The fail-open default encodes the asymmetry.

**When to revisit:** When intent-log data shows which categories have the highest misclassification rate, use the payoff frame to decide whether to adjust the classifier toward more false positives or more false negatives for that specific category. Could also justify per-category overrides — e.g., `community-help` defaults to silence even if classification confidence is low, because Cost A is high.

---

## Status

- [ ] None of these are formally implemented
- [ ] Revisit after reviewing intent-log.jsonl data (suggest: after 2–4 weeks of traffic)
- [ ] SDT and Decision Theory are most actionable for threshold tuning
- [ ] Bayesian priors (user history) are most impactful for long-term accuracy improvement

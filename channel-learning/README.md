# channel-learning/

Q&A pairs the bot learns from staff replies in Discord channels. They are indexed with the knowledge base, so future similar questions benefit from real staff answers.

## Files

```
channel-learning/
  general/
    qa-log.md    ← Q&A pairs learned from staff replies in #general
  support/
    qa-log.md    ← Q&A pairs learned from staff replies in #support
```

**Only this README is in git.** The `qa-log.md` files contain community members' questions and stay on the bot's machine — never commit or upload them.

## How it works

When a staff member replies to a user's question in #general or #support, the bot appends the question and the staff reply to that channel's `qa-log.md` (`saveQAPair` in `src/utils.js`). Only replies to real questions are saved — messages the classifier marks as one of the four answerable intents (since 2026-10-29); replies to greetings, hype or chat are not learned. Learning needs Discord replies switched on (`/toggle`), because that is when messages are classified. `buildIndex()` indexes these files alongside the knowledge base.

## Notes

- The files are appended by the bot — do not edit them by hand, except to remove a bad pair.
- Quality depends on the staff replies: a vague or wrong reply is learned too. To remove a bad pair, edit `qa-log.md` and run `/sync type:Knowledge` to rebuild the index.

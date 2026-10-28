'use strict';

/* ─── QUICK REFERENCE ────────────────────────────────────────────────────────
 * Persistent scammer infraction store → data/scammer-list.json.
 * Keyed by Discord user ID — survives username and display name changes.
 * Exports: recordInfraction, updateInfractionActions, getRecord, getAllRecords, clearUser, trimInfractions
 *
 * Function / Section                                           ~Line
 * ─────────────────────────────────────────────────────────────────
 * load() / save()                  JSON file I/O                  24
 * recordInfraction()               write new infraction record    35
 * updateInfractionActions()        patch in actions after the fact 58
 * getRecord() / getAllRecords()     read infraction history        66
 * clearUser()                      remove ALL records for a user   75
 * trimInfractions()                remove N most-recent records    85
 * ─────────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');

const ROOT_DIR   = path.join(__dirname, '..');
const STORE_PATH = path.join(ROOT_DIR, 'data', 'scammer-list.json');

function load() {
    try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
    catch { return {}; }
}

function save(store) {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

// Records one infraction for a user. Returns the user's new total infraction count.
function recordInfraction(userId, { reason, content, channelId, actions, tag }) {
    const store = load();
    const now   = new Date().toISOString();
    if (!store[userId]) {
        store[userId] = { userId, tag, infractions: [], firstSeen: now };
    }
    store[userId].lastSeen = now;
    if (tag) store[userId].tag = tag;
    store[userId].infractions.push({
        ts: now,
        reason,
        content:   (content || '').slice(0, 500),
        channelId: channelId ?? null,
        actions,
    });
    save(store);
    return store[userId].infractions.length;
}

// Updates the `actions` field of a specific infraction after the fact (e.g. once delete/timeout
// results are known). `infractionCount` is the value recordInfraction() returned when this
// infraction was created — used as a 1-based index so concurrent calls for the same user each
// target their own record instead of both racing to patch whichever is currently last.
function updateInfractionActions(userId, infractionCount, actionsStr) {
    const store       = load();
    const infractions = store[userId]?.infractions;
    const entry        = infractions?.[infractionCount - 1];
    if (!entry) return;
    entry.actions = actionsStr;
    save(store);
}

function getRecord(userId) {
    return load()[userId] ?? null;
}

function getAllRecords() {
    return load();
}

// Removes a user from the list entirely. Returns true if the user existed.
function clearUser(userId) {
    const store = load();
    if (!store[userId]) return false;
    delete store[userId];
    save(store);
    return true;
}

// Removes the last `removeCount` infractions. If removeCount >= total, clears the user entirely.
// Returns { removed, remaining } — removed = how many were actually deleted.
function trimInfractions(userId, removeCount) {
    const store = load();
    if (!store[userId]) return { removed: 0, remaining: 0 };
    const total   = store[userId].infractions.length;
    const keep    = Math.max(0, total - removeCount);
    const removed = total - keep;
    if (keep === 0) {
        delete store[userId];
    } else {
        store[userId].infractions = store[userId].infractions.slice(0, keep);
    }
    save(store);
    return { removed, remaining: keep };
}

module.exports = { recordInfraction, updateInfractionActions, getRecord, getAllRecords, clearUser, trimInfractions };

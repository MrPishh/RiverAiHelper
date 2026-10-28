'use strict';

/* ─── About this file ─────────────────────────────────────────────────────────
 * Feature toggles (Discord replies, Telegram replies, Scam Blocker), persisted to
 * data/toggles.json so they survive restarts. Changed with /toggle.
 * Exports: isEnabled, toggle, getStatus
 * ────────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');

// Where the toggle state is stored.
const ROOT_DIR     = path.join(__dirname, '..');
const TOGGLES_PATH = path.join(ROOT_DIR, 'data', 'toggles.json');

// Defaults until a toggle is first changed — the scam blocker starts OFF.
const DEFAULTS = { discord: true, telegram: true, 'scam-blocker': false };

// Current toggle state (defaults filled in).
function load() {
    try {
        return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(TOGGLES_PATH, 'utf8')) };
    } catch {
        return { ...DEFAULTS };
    }
}

// Writes the toggle state.
function save(state) {
    fs.mkdirSync(path.dirname(TOGGLES_PATH), { recursive: true });
    fs.writeFileSync(TOGGLES_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// True unless the toggle has been switched off. Reads the file each time, so changes apply at once.
function isEnabled(platform) {
    return load()[platform] !== false;
}

// Flips one toggle and returns its new value.
function toggle(platform) {
    const state = load();
    state[platform] = !state[platform];
    save(state);
    return state[platform];
}

// All toggles, for /toggle platform:status.
function getStatus() {
    return load();
}

module.exports = { isEnabled, toggle, getStatus };

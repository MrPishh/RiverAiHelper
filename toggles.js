'use strict';

const fs   = require('fs');
const path = require('path');

const TOGGLES_PATH = path.join(__dirname, 'toggles.json');

const DEFAULTS = { discord: true, telegram: true };

function load() {
    try {
        return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(TOGGLES_PATH, 'utf8')) };
    } catch {
        return { ...DEFAULTS };
    }
}

function save(state) {
    fs.writeFileSync(TOGGLES_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function isEnabled(platform) {
    return load()[platform] !== false;
}

function toggle(platform) {
    const state = load();
    state[platform] = !state[platform];
    save(state);
    return state[platform];
}

function getStatus() {
    return load();
}

module.exports = { isEnabled, toggle, getStatus };

#!/usr/bin/env node
'use strict';

const fs = require('fs');

function readHookInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

module.exports = { readHookInput, emit };

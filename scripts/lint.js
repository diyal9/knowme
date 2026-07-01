#!/usr/bin/env node
/**
 * Minimal lint gate — checks src/ for obvious issues.
 * Replace with eslint when project grows.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
let errors = 0;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(name)) check(p);
  }
}

function check(file) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('debugger;')) {
    console.error(`ERROR: debugger statement in ${file}`);
    errors++;
  }
  if (/eval\s*\(/.test(content)) {
    console.error(`ERROR: eval() in ${file}`);
    errors++;
  }
}

walk(SRC);

if (errors > 0) {
  console.error(`\nlint failed: ${errors} error(s)`);
  process.exit(1);
}
console.log('lint ok');

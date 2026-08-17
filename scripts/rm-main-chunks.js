'use strict'
const fs = require('fs')
const path = require('path')

function rmTree(dir) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) rmTree(p)
    else fs.unlinkSync(p)
  }
  fs.rmdirSync(dir)
}

rmTree(path.join('src/main/chunks'))
rmTree(path.join('src/main/modules'))
console.log('removed chunks and modules copies')

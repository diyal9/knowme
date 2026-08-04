'use strict'

const { Notice, Plugin } = require('obsidian')

module.exports = class KnowMeBridgePlugin extends Plugin {
  async onload() {
    this.registerObsidianProtocolHandler('knowme', async (params = {}) => {
      if (params.action !== 'graph') return
      const opened = this.app.commands.executeCommandById('graph:open')
      if (!opened) new Notice('无法打开全局图谱，请从命令面板打开“图谱视图”。')
    })
  }
}

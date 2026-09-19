require('../scripts/register-ts')

// Isolated qualification runs must not be invalidated by the Windows GPU
// crash/relaunch path. Keep this strictly test-seam scoped; production starts
// with the normal Electron GPU policy.
if (process.env.KNOWME_TEST_SEAM === '1') {
  const { app } = require('electron')
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
  app.commandLine.appendSwitch('in-process-gpu')
  app.commandLine.appendSwitch('use-angle', 'swiftshader')
  app.commandLine.appendSwitch('use-gl', 'swiftshader')
}

require('./main/index')

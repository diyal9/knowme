'use strict'

/**
 * 品牌图标与托盘图路径。不负责 BrowserWindow 生命周期。
 */

/** 挂载图标路径与读取函数；须在 shell.create 之前调用。 */
function create(ctx) {
  ctx.ICON_DIR = ctx.path.join(__dirname, '..', 'assets')
  ctx.ICON_PNG = ctx.path.join(ctx.ICON_DIR, 'icon.png')
  ctx.TRAY_ICON_PNG = ctx.path.join(ctx.ICON_DIR, 'tray-icon.png')
  ctx.ICON_ICO = ctx.path.join(ctx.ICON_DIR, 'icon.ico')
  ctx.appIconImage = null
  ctx.jumpIconPath = process.execPath
  ctx.winIcoPath = null

  ctx.getAppIconImage = function getAppIconImage() {
    if (!ctx.appIconImage || ctx.appIconImage.isEmpty()) {
      if (process.platform === 'win32' && ctx.winIcoPath && ctx.fs.existsSync(ctx.winIcoPath)) {
        ctx.appIconImage = ctx.nativeImage.createFromPath(ctx.winIcoPath)
      }
      if (!ctx.appIconImage || ctx.appIconImage.isEmpty()) {
        ctx.appIconImage = ctx.nativeImage.createFromPath(ctx.ICON_PNG)
      }
      if (!ctx.appIconImage || ctx.appIconImage.isEmpty()) {
        ctx.appIconImage = ctx.nativeImage.createFromPath(process.execPath)
      }
    }
    return ctx.appIconImage
  }

  ctx.getWindowIconOption = function getWindowIconOption() {
    if (process.platform === 'win32' && ctx.winIcoPath && ctx.fs.existsSync(ctx.winIcoPath)) {
      return ctx.winIcoPath
    }
    return ctx.getAppIconImage()
  }

  ctx.ensureBrandIcons = function ensureBrandIcons() {
    try {
      if (!ctx.fs.existsSync(ctx.ICON_PNG))
        throw new Error(`Missing brand icon: ${ctx.ICON_PNG}`)
      const userData = ctx.app.getPath('userData')
      if (process.platform === 'win32') {
        if (!ctx.fs.existsSync(ctx.ICON_ICO))
          throw new Error(`Missing Windows brand icon: ${ctx.ICON_ICO}`)
        const ico = ctx.materializeWindowsIcon(ctx.ICON_ICO, userData)
        ctx.winIcoPath = ico
        ctx.appIconImage = null
        ctx.jumpIconPath = ico
      }
      else {
        ctx.jumpIconPath = ctx.ICON_PNG
      }
    }
    catch {
      ctx.jumpIconPath = ctx.fs.existsSync(ctx.ICON_PNG) ? ctx.ICON_PNG : process.execPath
    }
  }

  ctx.makeTrayIcon = () => {
    let icon = null
    if (process.platform === 'win32' && ctx.fs.existsSync(ctx.TRAY_ICON_PNG)) {
      try {
        // 32 physical pixels presented as 16 DIP: stays sharp at 125%/150% scaling.
        icon = ctx.nativeImage.createFromBuffer(ctx.fs.readFileSync(ctx.TRAY_ICON_PNG), { scaleFactor: 2 })
      }
      catch { /* fall through to path loading */ }
    }
    if (!icon || icon.isEmpty())
      icon = ctx.nativeImage.createFromPath(ctx.TRAY_ICON_PNG)
    if (!icon.isEmpty()) {
      if (process.platform === 'win32')
        return icon
      return icon.resize({ width: 32, height: 32, quality: 'best' })
    }
    if (process.platform === 'win32') {
      const ico = ctx.nativeImage.createFromPath(ctx.ICON_ICO)
      if (!ico.isEmpty())
        return ico.resize({ width: 16, height: 16, quality: 'best' })
    }
    const appIcon = ctx.getAppIconImage()
    if (appIcon && !appIcon.isEmpty()) {
      if (process.platform === 'win32')
        return appIcon.resize({ width: 16, height: 16, quality: 'best' })
      return appIcon.resize({ width: 32, height: 32, quality: 'best' })
    }
    if (process.platform === 'win32' && process.execPath) {
      const fallback = ctx.nativeImage.createFromPath(process.execPath)
      if (!fallback.isEmpty())
        return fallback.resize({ width: 16, height: 16, quality: 'best' })
    }
    return ctx.nativeImage.createEmpty()
  }
}

module.exports = { create }

'use strict'

/**
 * 主进程组合根：创建 ctx，按序 create，再按域绑定 IPC。
 * 禁止模块级单例、vm concat、part-*、attach 入口。
 */

const ctx = Object.create(null)
require('./boot').create(ctx)
require('./agent-runtime').create(ctx)
require('./icons').create(ctx)
require('./shell').create(ctx)
require('./knowledge').create(ctx)
require('./workbench').create(ctx)
require('./process-guards').create(ctx)
require('./ipc-deps').bindCoreIpc(ctx)

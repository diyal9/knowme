'use strict'

/**
 * 主框加载失败策略。GPU 软件路径切换合成器时常发 ERR_ABORTED，
 * 不得立刻换成 data: 错误页，否则会拒绝真正的渲染产物加载。
 */

/** Chromium net: 导航被中止，通常不是真实失败。 */
const ERR_ABORTED = -3
/** Chromium net: 泛失败，软件 GPU 切路径时偶发。 */
const ERR_FAILED = -2

/**
 * 忽略子框与 ERR_ABORTED，避免 GPU fallback 把主页换成错误 HTML。
 * @param {{ code?: number, isMainFrame?: boolean }} opts
 */
function shouldIgnoreRendererLoadFail(opts = {}) {
  if (!opts.isMainFrame) return true
  return Number(opts.code) === ERR_ABORTED
}

/**
 * GPU 软件路径下首次 ERR_FAILED 允许重试一次 loadRendererEntry。
 * @param {{ code?: number, gpuFallbackActive?: boolean, retryCount?: number }} opts
 */
function shouldRetryRendererLoadFail(opts = {}) {
  if (!opts.gpuFallbackActive) return false
  if (Number(opts.retryCount) >= 1) return false
  const code = Number(opts.code)
  return code === ERR_FAILED || code === ERR_ABORTED
}

module.exports = {
  ERR_ABORTED,
  ERR_FAILED,
  shouldIgnoreRendererLoadFail,
  shouldRetryRendererLoadFail,
}

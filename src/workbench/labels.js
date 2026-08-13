'use strict'

/**
 * Workbench 展示标签（浏览器脚本）。
 * 挂到 window.WorkbenchLabels，供 workbench.js 委托。
 */
;(function (root) {
  function consoleSourceLabel(source) {
    return {
      daemon: '管线服务',
      'local-team': 'Local Team',
      'legacy-local': '兼容本地',
      automation: '自动化',
    }[String(source || '')] || '本机'
  }

  function executionBackendLabel(item) {
    const backends = Array.isArray(item && item.executionBackends) ? item.executionBackends : []
    if (backends.includes('daemon') || (item && item.executionSource === 'daemon')) return '管线服务'
    if (backends.includes('local-team') || (item && item.executionSource === 'local-team')) return '本机专家团队'
    if (backends.includes('legacy-local') || (item && item.executionSource === 'legacy-local')) return '兼容本地'
    return '本机执行'
  }

  function workflowSourceLabel(source) {
    return {
      official: '官方专业管线',
      team: '团队专业管线',
      forked: '我的派生流程',
      personal: '我的工作流',
    }[String(source || '')] || '可组合流程'
  }

  root.WorkbenchLabels = {
    consoleSourceLabel: consoleSourceLabel,
    executionBackendLabel: executionBackendLabel,
    workflowSourceLabel: workflowSourceLabel,
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      consoleSourceLabel: consoleSourceLabel,
      executionBackendLabel: executionBackendLabel,
      workflowSourceLabel: workflowSourceLabel,
    }
  }
})(typeof window !== 'undefined' ? window : globalThis)

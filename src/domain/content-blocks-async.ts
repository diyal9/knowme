/**
 * 异步 Markdown 块解析：超阈值走 Worker；Worker 不可用时推迟到下一宏任务。
 * 短文本仍同步。不在调用栈上解析长文。
 */
import { parseContentBlocks, type ContentBlock } from './content-blocks'

/** 超过此字符数才进 Worker，避免短消息调度开销 */
export const CONTENT_BLOCKS_WORKER_THRESHOLD = 1800

type Pending = {
  resolve: (blocks: ContentBlock[]) => void
  reject: (error: Error) => void
}

let worker: Worker | null | undefined
let seq = 0
const pending = new Map<number, Pending>()

function ensureWorker(): Worker | null {
  if (worker !== undefined) return worker
  worker = null
  if (typeof Worker === 'undefined') return worker
  try {
    const instance = new Worker(new URL('./content-blocks.worker.ts', import.meta.url), { type: 'module' })
    instance.onmessage = (event: MessageEvent<{ id: number; blocks?: ContentBlock[]; error?: string }>) => {
      const { id, blocks, error } = event.data
      const job = pending.get(id)
      if (!job) return
      pending.delete(id)
      if (error) job.reject(new Error(error))
      else job.resolve(blocks || [])
    }
    instance.onerror = () => {
      worker = null
      for (const [, job] of pending) job.reject(new Error('content-blocks worker failed'))
      pending.clear()
    }
    worker = instance
  } catch {
    worker = null
  }
  return worker
}

/** 流式期间预拉 Worker，避免终态才 new Worker。 */
export function warmContentBlocksWorker(): void {
  ensureWorker()
}

function parseOnMainThreadDeferred(text: string): Promise<ContentBlock[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(parseContentBlocks(text)), 0)
  })
}

/** 解析正文为 ContentBlock[]；长文异步，短文同步。 */
export function parseContentBlocksAsync(src: string): Promise<ContentBlock[]> {
  const text = String(src || '')
  if (text.length < CONTENT_BLOCKS_WORKER_THRESHOLD) {
    return Promise.resolve(parseContentBlocks(text))
  }
  const instance = ensureWorker()
  if (!instance) return parseOnMainThreadDeferred(text)
  return new Promise<ContentBlock[]>((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    try {
      instance.postMessage({ id, src: text })
    } catch (err) {
      pending.delete(id)
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  }).catch(() => parseOnMainThreadDeferred(text))
}

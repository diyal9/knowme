/**
 * Markdown 块解析 Worker：长正文离主线程，避免历史气泡 lazy 解析卡顿。
 * 短文本仍由 content-blocks-async 走同步路径。
 */
import { parseContentBlocks, type ContentBlock } from './content-blocks'

type WorkerRequest = { id: number; src: string }
type WorkerResponse = { id: number; blocks?: ContentBlock[]; error?: string }

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, src } = event.data
  try {
    const blocks = parseContentBlocks(String(src || ''))
    const payload: WorkerResponse = { id, blocks }
    self.postMessage(payload)
  } catch (err) {
    const payload: WorkerResponse = { id, error: String(err) }
    self.postMessage(payload)
  }
}

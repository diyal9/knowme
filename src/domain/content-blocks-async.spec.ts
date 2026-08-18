import { describe, expect, it } from 'vitest'
import { parseContentBlocks } from './content-blocks'
import { CONTENT_BLOCKS_WORKER_THRESHOLD, parseContentBlocksAsync } from './content-blocks-async'

describe('content-blocks-async', () => {
  it('parses short text synchronously', async () => {
    const short = 'hello **world**'
    const blocks = await parseContentBlocksAsync(short)
    expect(blocks).toEqual(parseContentBlocks(short))
  })

  it('does not parse long text on the calling stack', async () => {
    const long = `# Title\n\n${'paragraph line.\n'.repeat(CONTENT_BLOCKS_WORKER_THRESHOLD)}`
    let settled = false
    const pending = parseContentBlocksAsync(long).then((blocks) => {
      settled = true
      return blocks
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    const blocks = await pending
    expect(blocks[0]?.type).toBe('heading')
    expect(blocks.length).toBeGreaterThan(1)
  })
})

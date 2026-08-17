import { useAppStore } from '../../app/store'

export function useWorkbenchSend() {
  const setWorkbenchComposer = useAppStore((s) => s.setWorkbenchComposer)
  const sendWorkbenchMessage = useAppStore((s) => s.sendWorkbenchMessage)
  return (prompt: string) => {
    setWorkbenchComposer(prompt)
    queueMicrotask(() => sendWorkbenchMessage())
  }
}

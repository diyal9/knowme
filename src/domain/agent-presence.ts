const PRESENCE_STORAGE_KEY = 'knowme.agent.presence.enabled.v1'

export function readAgentPresenceEnabled(storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null): boolean {
  try {
    return storage?.getItem(PRESENCE_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeAgentPresenceEnabled(enabled: boolean, storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null): boolean {
  try {
    storage?.setItem(PRESENCE_STORAGE_KEY, enabled ? '1' : '0')
    return enabled
  } catch {
    return enabled
  }
}

export function toggleAgentPresenceEnabled(storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null): boolean {
  return writeAgentPresenceEnabled(!readAgentPresenceEnabled(storage), storage)
}

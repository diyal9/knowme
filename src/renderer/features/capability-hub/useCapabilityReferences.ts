import { useEffect, useState } from 'react'
import type { CapabilityItem } from '../../../shared/api'
import { useAppStore } from '../../app/store'

/** A filtered expert list cannot resolve its cross-kind dependencies. Keep reference data separate. */
export function useCapabilityReferences(): CapabilityItem[] {
  const hubItems = useAppStore(state => state.hubItems)
  const [references, setReferences] = useState<CapabilityItem[]>([])
  useEffect(() => {
    let active = true
    void Promise.allSettled([
      window.api?.capabilityList?.({ kind: 'skill' }),
      window.api?.capabilityList?.({ kind: 'connector' }),
    ]).then(results => {
      if (!active) return
      setReferences(results.flatMap(result => result.status === 'fulfilled' ? result.value?.items || [] : []))
    })
    return () => { active = false }
  }, [hubItems])
  return [...new Map([...references, ...hubItems].map(item => [`${item.kind}:${item.id}`, item])).values()]
}

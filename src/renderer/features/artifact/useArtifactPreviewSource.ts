import { useEffect, useState } from 'react'

function isDirectPreviewSource(source: string): boolean {
  // Both HTTP and HTTPS are valid provider media URLs. Local desktop
  // previews still go through the preload resolver; only browser-safe
  // remote/data/blob sources bypass it.
  return /^(?:https?:\/\/|data:image\/|blob:)/i.test(source)
}

/** Resolves ordered remote/data/local image candidates through one renderer contract. */
export function useArtifactPreviewSource(source?: string | readonly string[]) {
  const candidates = [...new Set((Array.isArray(source) ? source : [source])
    .map((item) => String(item || '').trim()).filter(Boolean))]
  const candidatesKey = candidates.join('\u0000')
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [resolvedCandidatesKey, setResolvedCandidatesKey] = useState(candidatesKey)
  const [resolvedSource, setResolvedSource] = useState(candidates[0] && isDirectPreviewSource(candidates[0]) ? candidates[0] : '')
  const [loading, setLoading] = useState(Boolean(candidates.length && !isDirectPreviewSource(candidates[0])))
  const [error, setError] = useState('')

  // A new artifact/version starts from its canonical source again. Without
  // resetting the fallback cursor, a previous CDN failure can make a later
  // artifact skip its first (fresh) provider URL and resolve an unrelated
  // fallback path instead.
  useEffect(() => {
    if (resolvedCandidatesKey === candidatesKey) return
    setResolvedCandidatesKey(candidatesKey)
    setCandidateIndex(0)
  }, [candidatesKey, resolvedCandidatesKey])

  useEffect(() => {
    let active = true
    setError('')
    if (!candidates.length) {
      setResolvedSource('')
      setLoading(false)
      return () => { active = false }
    }
    if (resolvedCandidatesKey !== candidatesKey) {
      const first = candidates[0]
      setResolvedSource(first && isDirectPreviewSource(first) ? first : '')
      setLoading(Boolean(first && !isDirectPreviewSource(first)))
      return () => { active = false }
    }
    const index = Math.min(candidateIndex, candidates.length - 1)
    if (index !== candidateIndex) {
      setCandidateIndex(index)
      return () => { active = false }
    }
    const candidate = candidates[index]
    if (isDirectPreviewSource(candidate)) {
      setResolvedSource(candidate)
      setLoading(false)
      return () => { active = false }
    }
    setResolvedSource('')
    setLoading(true)
    const resolve = window.api?.artifactPreviewResolve
    if (typeof resolve !== 'function') {
      setLoading(false)
      setError('当前环境无法读取本地图片')
      return () => { active = false }
    }
    void resolve(candidate).then((result) => {
      if (!active) return
      if (result?.ok && result.source) {
        setResolvedSource(String(result.source))
        setLoading(false)
        setError('')
        return
      }
      if (index < candidates.length - 1) {
        setCandidateIndex(index + 1)
        return
      }
      setResolvedSource('')
      setLoading(false)
      setError('图片预览不可用')
    }).catch(() => {
      if (!active) return
      if (index < candidates.length - 1) {
        setCandidateIndex(index + 1)
        return
      }
      setResolvedSource('')
      setLoading(false)
      setError('图片预览不可用')
    })
    return () => { active = false }
  }, [candidateIndex, candidatesKey, resolvedCandidatesKey])

  const hasFallback = candidateIndex < candidates.length - 1
  const onSourceError = () => {
    if (!hasFallback) return false
    setCandidateIndex((current) => current + 1)
    setResolvedSource('')
    setLoading(true)
    setError('')
    return true
  }

  return { source: resolvedSource, loading, error, hasFallback, onSourceError }
}

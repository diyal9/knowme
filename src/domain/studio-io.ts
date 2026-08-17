export type StudioIoType = 'text' | 'number' | 'boolean' | 'enum' | 'url' | 'json'

export type StudioIoEntry = {
  id: string
  label: string
  type: StudioIoType
  required?: boolean
  example?: string
  options?: string[]
  description?: string
}

export function defaultStudioIoRows(ioType: 'input' | 'output'): StudioIoEntry[] {
  if (ioType === 'output') {
    return [{ id: 'output-1', label: '', type: 'text', required: false, example: '', options: [] }]
  }
  return [{ id: 'input-1', label: '', type: 'text', required: true, example: '', options: [] }]
}

export function normalizeStudioIoList(raw: unknown, ioType: 'input' | 'output'): StudioIoEntry[] {
  const list = Array.isArray(raw) && raw.length ? raw : defaultStudioIoRows(ioType)
  return list.slice(0, 16).map((item, index) => {
    const source: Record<string, unknown> = item && typeof item === 'object'
      ? item as Record<string, unknown>
      : { label: item }
    const label = String(source.label || source.name || '').trim()
    const rawType = String(source.type || 'text')
    const type: StudioIoType = ['text', 'number', 'boolean', 'enum', 'url', 'json'].includes(rawType)
      ? rawType as StudioIoType
      : 'text'
    const options = Array.isArray(source.options)
      ? source.options.map((entry: unknown) => String(entry || '').trim()).filter(Boolean).slice(0, 20)
      : []
    return {
      id: String(source.id || `${ioType}-${index + 1}`),
      label,
      type,
      required: ioType === 'input' ? source.required !== false : source.required === true,
      example: String(source.example || ''),
      options,
      description: String(source.description || ''),
    }
  })
}

export function addStudioIoRow(list: StudioIoEntry[], ioType: 'input' | 'output'): StudioIoEntry[] {
  const nextIndex = list.length + 1
  const next: StudioIoEntry = {
    id: `${ioType}-${nextIndex}`,
    label: '',
    type: 'text',
    required: ioType === 'input',
    example: '',
    options: [],
  }
  return [...list, next].slice(0, 16)
}

export function removeStudioIoRow(list: StudioIoEntry[], index: number, ioType: 'input' | 'output'): StudioIoEntry[] {
  if (list.length <= 1) return defaultStudioIoRows(ioType)
  return list.filter((_, rowIndex) => rowIndex !== index)
}

export function patchStudioIoRow(
  list: StudioIoEntry[],
  index: number,
  patch: Partial<StudioIoEntry>,
): StudioIoEntry[] {
  return list.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
}

export function serializeStudioIoOptions(options: string[] | undefined): string {
  return (options || []).join('，')
}

export function parseStudioIoOptions(raw: string): string[] {
  return raw
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20)
}

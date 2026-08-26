import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ShelfCardModel } from '../../../domain/shelf'
import { Icon } from '../../app/Icon'

export interface WorkflowLaunchPayload {
  goal: string
  inputs: Record<string, string>
}

interface WorkflowLaunchField {
  id: string
  label: string
  required: boolean
  placeholder: string
  description: string
  initialValue: string
  hidden: boolean
  advanced: boolean
  control: 'text' | 'file' | 'directory'
  extensions: string[]
}

const GOAL_IDS = new Set(['goal', 'brief', 'intent', 'objective', 'task'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function workflowFields(
  workflowPackage: Record<string, unknown> | null,
  card: ShelfCardModel,
): { fields: WorkflowLaunchField[]; goalId: string } {
  const rows = Array.isArray(workflowPackage?.inputs) ? workflowPackage.inputs : []
  const parsed = rows.map((raw, index): WorkflowLaunchField => {
    const item = asRecord(raw)
    const id = String(item.id || item.name || `input-${index + 1}`).trim() || `input-${index + 1}`
    const label = String(item.label || item.title || item.name || `输入 ${index + 1}`).trim()
    return {
      id,
      label,
      required: item.required === true,
      placeholder: String(item.placeholder || `请填写${label}`).trim(),
      description: String(item.description || item.hint || '').trim(),
      initialValue: String(item.defaultValue || item.default || '').trim(),
      hidden: item.hidden === true,
      advanced: item.advanced === true,
      control: item.control === 'file' || item.control === 'directory' ? item.control : 'text',
      extensions: Array.isArray(item.extensions) ? item.extensions.map(String).filter(Boolean) : [],
    }
  })

  const declaredGoal = parsed.find((field) => GOAL_IDS.has(field.id.toLowerCase()))
  if (declaredGoal) return { fields: parsed, goalId: declaredGoal.id }

  return {
    fields: [
      {
        id: 'goal',
        label: '本次运行目标',
        required: true,
        placeholder: '说明这次要完成什么，以及你希望如何验收',
        description: '',
        initialValue: '',
        hidden: false,
        advanced: false,
        control: 'text',
        extensions: [],
      },
      ...parsed,
    ],
    goalId: 'goal',
  }
}

function outputLabels(workflowPackage: Record<string, unknown> | null, card: ShelfCardModel) {
  const rows = Array.isArray(workflowPackage?.outputs) ? workflowPackage.outputs : []
  const labels = rows.map((raw) => {
    const item = asRecord(raw)
    return String(item.label || item.title || item.name || '').trim()
  }).filter(Boolean)
  return labels.length ? labels : [card.outcomeLabel]
}

export function WorkflowLaunchDrawer({
  card,
  workflowPackage,
  onClose,
  onSubmit,
}: {
  card: ShelfCardModel
  workflowPackage: Record<string, unknown> | null
  onClose: () => void
  onSubmit: (payload: WorkflowLaunchPayload) => Promise<boolean> | boolean
}) {
  const schema = useMemo(() => workflowFields(workflowPackage, card), [workflowPackage, card])
  const outputs = useMemo(() => outputLabels(workflowPackage, card), [workflowPackage, card])
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(
    schema.fields.map((field) => [field.id, field.initialValue]),
  ))
  const [submitting, setSubmitting] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const primaryFields = schema.fields.filter((field) => !field.hidden && !field.advanced)
  const advancedFields = schema.fields.filter((field) => !field.hidden && field.advanced)

  useEffect(() => {
    firstFieldRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, submitting])

  const missingRequired = schema.fields.some((field) => field.required && !String(values[field.id] || '').trim())
  const canSubmit = !missingRequired && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    const inputs = Object.fromEntries(
      schema.fields
        .map((field) => [field.id, String(values[field.id] || '').trim()] as const)
        .filter(([, value]) => value),
    )
    try {
      const launched = await onSubmit({
        goal: String(inputs[schema.goalId] || '').trim(),
        inputs,
      })
      if (!launched) setSubmitting(false)
    } catch {
      setSubmitting(false)
    }
  }

  async function pickPath(field: WorkflowLaunchField) {
    const directory = field.control === 'directory'
    const result = await window.api?.workbenchPickFiles?.({
      title: directory ? `选择${field.label}` : `选择${field.label}`,
      multi: false,
      directory,
      filters: directory || !field.extensions.length
        ? undefined
        : [{ name: field.label, extensions: field.extensions }],
    })
    const selected = result?.ok === false || result?.canceled ? '' : String(result?.files?.[0]?.path || '')
    if (selected) setValues((current) => ({ ...current, [field.id]: selected }))
  }

  function renderField(field: WorkflowLaunchField, focus = false) {
    const fieldId = `workflowLaunchField-${field.id}`
    const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && canSubmit) {
        event.preventDefault()
        void submit()
      }
    }
    return (
      <div key={field.id} className={`wb-studio-field wb-workflow-launch-field${field.id === schema.goalId ? ' wb-task-goal-field' : ''}`}>
        <label htmlFor={fieldId}>{field.label} {field.required ? <em>必填</em> : <small>可选</small>}</label>
        {field.control === 'file' || field.control === 'directory' ? (
          <div className="wb-workflow-launch-path-control">
            <input
              id={fieldId}
              ref={focus ? (node) => { firstFieldRef.current = node } : undefined}
              type="text"
              maxLength={8000}
              placeholder={field.placeholder}
              value={values[field.id] || ''}
              onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
              onKeyDown={onKeyDown}
            />
            <button type="button" onClick={() => void pickPath(field)}>选择</button>
          </div>
        ) : (
          <textarea
            id={fieldId}
            ref={focus ? (node) => { firstFieldRef.current = node } : undefined}
            rows={field.id === schema.goalId ? 3 : 2}
            maxLength={8000}
            placeholder={field.placeholder}
            value={values[field.id] || ''}
            onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
            onKeyDown={onKeyDown}
          />
        )}
        {field.description ? <small className="wb-workflow-launch-field-hint">{field.description}</small> : null}
      </div>
    )
  }

  return (
    <div
      className="wb-modal-mask is-task-composer is-workflow-launch-drawer"
      data-testid="workflow-launch-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workflowLaunchTitle"
      onClick={(event) => { if (event.target === event.currentTarget && !submitting) onClose() }}
    >
      <div className="wb-modal wb-task-composer-modal wb-workflow-launch-drawer">
        <div className="wb-modal-head">
          <div className="wb-task-composer-heading">
            <strong id="workflowLaunchTitle" className="wb-modal-title">启动工作流</strong>
          </div>
          <button type="button" className="wb-modal-close" aria-label="关闭" onClick={onClose} disabled={submitting}>×</button>
        </div>

        <div className="wb-modal-body">
          <section className="wb-workflow-launch-summary" aria-label="所选工作流">
            <span className="wb-task-section-label">所选工作流</span>
            <div>
              <span className="wb-workflow-launch-mark"><Icon name={card.markIcon} /></span>
              <span>
                <strong>{card.name}</strong>
                <small>{card.description || `${card.stepCount} 个节点将按既定顺序执行`}</small>
              </span>
            </div>
          </section>

          <section className="wb-workflow-launch-fields" aria-label="本次运行输入">
            {primaryFields.map((field, index) => renderField(field, index === 0))}
          </section>

          {advancedFields.length ? (
            <details className="wb-workflow-launch-advanced">
              <summary>高级设置 <span>{advancedFields.length} 项</span></summary>
              <div className="wb-workflow-launch-fields">{advancedFields.map((field) => renderField(field))}</div>
            </details>
          ) : null}

          <section className="wb-task-output-preview" aria-label="本次工作流产出">
            <header><span>将交付</span><small>{outputs.length} 项</small></header>
            <div>{outputs.map((label) => <strong key={label}><i aria-hidden="true">✓</i>{label}</strong>)}</div>
          </section>
        </div>

        <div className="wb-modal-actions wb-task-composer-actions">
          <span>{missingRequired ? '填写所有必填输入后即可启动' : '启动后可在运行记录中查看进度与交付'}</span>
          <button type="button" className="wb-modal-btn primary" disabled={!canSubmit} onClick={() => void submit()} title="Ctrl/⌘ + Enter">
            {submitting ? '正在启动…' : '启动工作流'}
          </button>
        </div>
      </div>
    </div>
  )
}

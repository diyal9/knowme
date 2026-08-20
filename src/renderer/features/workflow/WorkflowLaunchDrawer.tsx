import { useEffect, useMemo, useRef, useState } from 'react'
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
}

const GOAL_IDS = new Set(['goal', 'brief', 'intent', 'objective', 'task'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function workflowFields(workflowPackage: Record<string, unknown> | null, card: ShelfCardModel) {
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
  const firstFieldRef = useRef<HTMLTextAreaElement>(null)

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
            {schema.fields.map((field, index) => (
              <label key={field.id} className={`wb-studio-field${field.id === schema.goalId ? ' wb-task-goal-field' : ''}`}>
                <span>{field.label} {field.required ? <em>必填</em> : <small>可选</small>}</span>
                <textarea
                  ref={index === 0 ? firstFieldRef : undefined}
                  rows={field.id === schema.goalId ? 3 : 2}
                  maxLength={8000}
                  placeholder={field.placeholder}
                  value={values[field.id] || ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && canSubmit) {
                      event.preventDefault()
                      void submit()
                    }
                  }}
                />
                {field.description ? <small className="wb-workflow-launch-field-hint">{field.description}</small> : null}
              </label>
            ))}
          </section>

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

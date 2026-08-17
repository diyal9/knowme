import {
  addStudioIoRow,
  normalizeStudioIoList,
  parseStudioIoOptions,
  patchStudioIoRow,
  removeStudioIoRow,
  serializeStudioIoOptions,
  type StudioIoEntry,
  type StudioIoType,
} from '../../../domain/studio-io'
import type { StudioDraft } from '../../../domain/studio'
import { useAppStore } from '../../app/store'

type Props = {
  draft: StudioDraft
  /** 开始节点只编入参，结束节点只编出参；默认两者都显示（兼容旧用法） */
  mode?: 'inputs' | 'outputs' | 'all'
}

function IoGroup({
  title,
  ioType,
  rows,
  onChange,
}: {
  title: string
  ioType: 'input' | 'output'
  rows: StudioIoEntry[]
  onChange: (next: StudioIoEntry[]) => void
}) {
  return (
    <div className="wb-studio-io-group" data-testid={`studio-io-${ioType}`}>
      <div className="wb-studio-io-head">
        <span>{title}</span>
        <button
          type="button"
          className="wb-flow-library-action"
          data-studio-io-add={ioType}
          onClick={() => onChange(addStudioIoRow(rows, ioType))}
        >
          {ioType === 'input' ? '添加入参' : '添加出参'}
        </button>
      </div>
      <div className="wb-studio-io-list">
        {rows.map((row, index) => {
          const isEnum = row.type === 'enum'
          return (
            <div key={`${ioType}-${row.id}-${index}`} className="wb-studio-io-row" data-studio-io-row={ioType}>
              <label className="wb-studio-io-field wb-studio-io-field--name">
                <span>字段名</span>
                <input
                  data-studio-io={`${ioType}:label`}
                  value={row.label}
                  maxLength={160}
                  placeholder="如：需求文档链接"
                  onChange={(e) => onChange(patchStudioIoRow(rows, index, { label: e.target.value }))}
                />
              </label>
              <div className="wb-studio-io-row-meta">
                <label className="wb-studio-io-field">
                  <span>类型</span>
                  <select
                    data-studio-io={`${ioType}:type`}
                    value={row.type}
                    onChange={(e) => onChange(patchStudioIoRow(rows, index, { type: e.target.value as StudioIoType }))}
                  >
                    <option value="text">文本</option>
                    <option value="number">数字</option>
                    <option value="boolean">是/否</option>
                    <option value="enum">枚举</option>
                    <option value="url">链接</option>
                    <option value="json">JSON</option>
                  </select>
                </label>
                <label className="wb-studio-io-required">
                  <input
                    type="checkbox"
                    data-studio-io={`${ioType}:required`}
                    checked={Boolean(row.required)}
                    onChange={(e) => onChange(patchStudioIoRow(rows, index, { required: e.target.checked }))}
                  />
                  <span>必填</span>
                </label>
                <button
                  type="button"
                  className="wb-studio-node-action danger"
                  data-studio-io-remove={ioType}
                  aria-label="移除此项"
                  title="移除此项"
                  onClick={() => onChange(removeStudioIoRow(rows, index, ioType))}
                >
                  ×
                </button>
              </div>
              <label className="wb-studio-io-field">
                <span>示例值</span>
                <input
                  data-studio-io={`${ioType}:example`}
                  value={row.example || ''}
                  maxLength={240}
                  placeholder="可选"
                  onChange={(e) => onChange(patchStudioIoRow(rows, index, { example: e.target.value }))}
                />
              </label>
              <label className={`wb-studio-io-field wb-studio-io-field--options${isEnum ? '' : ''}`} hidden={!isEnum}>
                <span>枚举项</span>
                <input
                  data-studio-io={`${ioType}:options`}
                  value={serializeStudioIoOptions(row.options)}
                  maxLength={240}
                  placeholder="用逗号分隔，如：A，B，C"
                  onChange={(e) => onChange(patchStudioIoRow(rows, index, { options: parseStudioIoOptions(e.target.value) }))}
                />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function StudioIoFields({ draft, mode = 'all' }: Props) {
  const updateStudioDraftIo = useAppStore((s) => s.updateStudioDraftIo)
  const inputs = normalizeStudioIoList(draft.inputs, 'input')
  const outputs = normalizeStudioIoList(draft.outputs, 'output')
  const showInputs = mode === 'all' || mode === 'inputs'
  const showOutputs = mode === 'all' || mode === 'outputs'

  return (
    <>
      {showInputs ? (
        <IoGroup
          title="入参结构"
          ioType="input"
          rows={inputs}
          onChange={(next) => updateStudioDraftIo('inputs', next.filter((item) => item.label.trim()))}
        />
      ) : null}
      {showOutputs ? (
        <IoGroup
          title="出参结构"
          ioType="output"
          rows={outputs}
          onChange={(next) => updateStudioDraftIo('outputs', next.filter((item) => item.label.trim()))}
        />
      ) : null}
    </>
  )
}

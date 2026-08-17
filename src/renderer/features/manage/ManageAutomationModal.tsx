import type { WorkbenchAutomationJob } from '../../../shared/api'
import { useAppStore } from '../../app/store'
import { ManageAutomationForm } from './ManageAutomationForm'

type Props = {
  job: WorkbenchAutomationJob | null
  onClose: () => void
}

export function ManageAutomationModal({ job, onClose }: Props) {
  const saveAutomation = useAppStore((s) => s.saveAutomation)
  const creating = !job?.id

  return (
    <div className="wb-auto-modal-mask" data-testid="automation-modal" role="presentation">
      <div className="wb-auto-modal" role="dialog" aria-modal="true" aria-labelledby="wbAutomationModalTitle">
        <div className="wb-auto-modal-head">
          <div className="wb-auto-modal-title" id="wbAutomationModalTitle">
            {creating ? '添加自动化' : '编辑自动化'}
          </div>
          <button type="button" className="wb-icon-btn" title="关闭" aria-label="关闭" onClick={onClose}>×</button>
        </div>
        <ManageAutomationForm
          job={job}
          onClose={onClose}
          onSave={(payload, id) => saveAutomation(payload, id)}
        />
      </div>
    </div>
  )
}

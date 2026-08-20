import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BackButton } from '../../app/BackButton'

export function WorkbenchDetailHeaderAction({
  label,
  onBack,
}: {
  label: string
  onBack: () => void
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const candidate = document.getElementById('wbHeadDetailActions')
    const workbench = candidate?.closest<HTMLElement>('.workbench')
    if (!candidate || !workbench || workbench.hidden) return

    const search = document.getElementById('wbShelfSearch') as HTMLInputElement | null
    const searchWasHidden = search?.hidden === true
    if (search) search.hidden = true
    setTarget(candidate)

    return () => {
      if (search) search.hidden = searchWasHidden
    }
  }, [])

  const button = (
    <BackButton
      label={label}
      className={target ? 'wb-detail-header-back' : 'wb-detail-back'}
      onClick={onBack}
    />
  )

  return target ? createPortal(button, target) : button
}

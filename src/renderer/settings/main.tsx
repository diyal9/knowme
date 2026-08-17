import { createRoot } from 'react-dom/client'
import '../app/tokens.css'
import '../app/knowme-icons'
import { SettingsSurface } from '../features/settings/SettingsSurface'

const el = document.getElementById('root')
if (el) createRoot(el).render(<SettingsSurface />)

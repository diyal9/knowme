import { createRoot } from 'react-dom/client'
import '../app/tokens.css'
import '../app/ui-system.css'
import { LogViewerSurface } from '../features/log-viewer/LogViewerSurface'

const el = document.getElementById('root')
if (el) createRoot(el).render(<LogViewerSurface />)

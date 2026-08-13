import { createRoot } from 'react-dom/client'
import { WorkspaceApp } from './WorkspaceApp'
import './workspace-boot.css'

const el = document.getElementById('root')
if (!el) throw new Error('Missing #root')

// Legacy script mount must run once (no StrictMode double-invoke).
createRoot(el).render(<WorkspaceApp />)

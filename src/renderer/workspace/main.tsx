import { createRoot } from 'react-dom/client'
import { WorkspaceApp } from './WorkspaceApp'

const el = document.getElementById('root')
if (!el) throw new Error('Missing #root')
createRoot(el).render(<WorkspaceApp />)

import { createRoot } from 'react-dom/client'
import '../app/tokens.css'
import { MemorySurface } from '../features/memory/MemorySurface'

const el = document.getElementById('root')
if (el) createRoot(el).render(<MemorySurface />)

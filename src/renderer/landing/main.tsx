import { createRoot } from 'react-dom/client'
import { MarketingLanding } from './MarketingLanding'
import './landing.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root')
createRoot(root).render(<MarketingLanding />)

import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../app/tokens.css'
import '../app/ui-system.css'
import { ExpertImagePreview, ExpertImagePreviewDialog } from '../features/expert/ExpertImagePreview'
import '../features/expert/expert-workbench.css'

const images = [[900, 900], [400, 1600], [1600, 400]].map(([width, height], index) => ({
  id: `image-${index}`, title: `测试图片 ${index + 1}`,
  source: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#edf4f1"/><rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="#28786b" stroke-width="16"/><circle cx="${width / 2}" cy="${height / 2}" r="100" fill="#28786b"/></svg>`)}`,
}))

function ImagePreviewFixture() {
  const [active, setActive] = useState<number | null>(null)
  return <main style={{ padding: 24, maxWidth: 700, transform: 'translateZ(0)' }}>
    <p>正常的专家对话仍然展示。</p>
    <ExpertImagePreview images={images} onOpen={setActive} />
    <p>待验收，请在对话中告诉我修改意见。</p>
    {active !== null ? <ExpertImagePreviewDialog images={images} initialIndex={active} onClose={() => setActive(null)} /> : null}
  </main>
}

createRoot(document.getElementById('root')!).render(<ImagePreviewFixture />)

import { mountLegacyHtmlPage } from '../shared/mountLegacyHtmlPage'
mountLegacyHtmlPage('memory.html').catch((e) => { document.body.textContent = String(e) })

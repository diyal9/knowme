import { mountLegacyHtmlPage } from '../shared/mountLegacyHtmlPage'
mountLegacyHtmlPage('log-viewer.html').catch((e) => { document.body.textContent = String(e) })

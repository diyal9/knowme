import { mountLegacyHtmlPage } from '../shared/mountLegacyHtmlPage'
mountLegacyHtmlPage('list.html').catch((e) => { document.body.textContent = String(e) })

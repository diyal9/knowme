import { mountLegacyHtmlPage } from '../shared/mountLegacyHtmlPage'
mountLegacyHtmlPage('note.html').catch((e) => { document.body.textContent = String(e) })

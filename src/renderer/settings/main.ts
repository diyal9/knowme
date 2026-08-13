import { mountLegacyHtmlPage } from '../shared/mountLegacyHtmlPage'

/** Secondary window: settings — legacy parity host. */
export async function bootSettings() {
  await mountLegacyHtmlPage('settings.html')
}

bootSettings().catch((err) => {
  document.body.textContent = String(err)
})

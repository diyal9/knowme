/** Dev Vite middleware vs packaged sibling `../legacy/` (from dist/renderer/<entry>/). */
export function legacyAssetBase(): string {
  return import.meta.env.DEV ? '/@legacy/' : '../legacy/'
}

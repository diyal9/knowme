'use strict'

const { spawnSync: defaultSpawnSync } = require('node:child_process')

const LOAD_SECURITY_ASSEMBLY = [
  '$assemblyPath = Join-Path $env:WINDIR \'Microsoft.NET\\Framework64\\v4.0.30319\\System.Security.dll\';',
  'if (!(Test-Path $assemblyPath)) { $assemblyPath = Join-Path $env:WINDIR \'Microsoft.NET\\Framework\\v4.0.30319\\System.Security.dll\' };',
  'Add-Type -Path $assemblyPath;',
].join('')

const ENCRYPT_SCRIPT = [
  LOAD_SECURITY_ASSEMBLY,
  '$plain=[Console]::In.ReadToEnd();',
  '$bytes=[Text.Encoding]::UTF8.GetBytes($plain);',
  '$cipher=[System.Security.Cryptography.ProtectedData]::Protect($bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);',
  '[Console]::Out.Write([Convert]::ToBase64String($cipher));',
].join('')

const DECRYPT_SCRIPT = [
  LOAD_SECURITY_ASSEMBLY,
  '$cipher=[Convert]::FromBase64String([Console]::In.ReadToEnd());',
  '$bytes=[System.Security.Cryptography.ProtectedData]::Unprotect($cipher,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);',
  '[Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes));',
].join('')

function runPowerShell(script, input, options = {}) {
  if ((options.platform || process.platform) !== 'win32') return null
  const spawnSync = options.spawnSync || defaultSpawnSync
  try {
    const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      input: String(input || ''),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    })
    if (result?.status !== 0 || result?.error) return null
    return String(result.stdout || '').trim()
  } catch {
    return null
  }
}

function encryptWithDpapi(plain, options = {}) {
  if (!plain) return null
  const cipher = runPowerShell(ENCRYPT_SCRIPT, plain, options)
  return cipher ? `dpapi:${cipher}` : null
}

function decryptWithDpapi(value, options = {}) {
  const encoded = String(value || '')
  if (!encoded.startsWith('dpapi:')) return ''
  return runPowerShell(DECRYPT_SCRIPT, encoded.slice(6), options) || ''
}

module.exports = { encryptWithDpapi, decryptWithDpapi }

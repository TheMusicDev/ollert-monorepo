/**
 * Minimal `.env` loader — no `dotenv` dependency needed for a handful of
 * flat KEY=VALUE lines. Loaded once from `playwright.config.ts`, before
 * anything reads `process.env`; global-setup and every spec run in the
 * same Node process, so they see the same env either way.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(here, '..', '..', '.env')

export function loadDotenv(): void {
  if (!existsSync(envPath)) return

  for (const rawLine of readFileSync(envPath, 'utf-8').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

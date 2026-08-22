import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** e2e/.auth — gitignored scratch dir for artifacts global-setup hands to specs. */
export const AUTH_DIR = path.join(here, '..', '..', '.auth')
export const TEST_USERS_FILE = path.join(AUTH_DIR, 'test-users.json')

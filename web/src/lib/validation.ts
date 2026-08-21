/** Deliberately permissive — real validation happens server-side (Supabase). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

/** Supabase's default minimum password length; matches its own validation. */
export const MIN_PASSWORD_LENGTH = 6

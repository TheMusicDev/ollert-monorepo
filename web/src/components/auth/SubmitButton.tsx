import type { ReactNode } from 'react'

interface SubmitButtonProps {
  pending: boolean
  pendingLabel: string
  children: ReactNode
}

/** Primary submit button shared by the auth forms — blue-600, matches the
 * app shell's primary accent (see Navbar's user-menu trigger). */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-blue-500"
    >
      {pending ? pendingLabel : children}
    </button>
  )
}

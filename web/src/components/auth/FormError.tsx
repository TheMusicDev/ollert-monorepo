/** Top-of-form error banner for submit-time failures (invalid credentials,
 * network errors, Supabase rejections, etc). */
export function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
    >
      {message}
    </div>
  )
}

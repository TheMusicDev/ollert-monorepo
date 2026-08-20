import { Switch } from '@base-ui-components/react/switch'

import { useTheme } from '@/lib/theme'

export function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
      <span className="sr-only sm:not-sr-only">Dark mode</span>
      <Switch.Root
        checked={theme === 'dark'}
        onCheckedChange={toggleTheme}
        className="relative flex h-5 w-9 shrink-0 items-center rounded-full bg-gray-300 p-0.5 transition-colors data-[checked]:bg-blue-600 dark:bg-gray-600"
      >
        <Switch.Thumb className="h-4 w-4 rounded-full bg-white shadow-bottom transition-transform data-[checked]:translate-x-4" />
      </Switch.Root>
    </label>
  )
}

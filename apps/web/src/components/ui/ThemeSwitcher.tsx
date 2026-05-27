import { useTheme, type Theme } from '@/contexts/ThemeContext';

const themes: Array<{ value: Theme; label: string; icon: string }> = [
  { value: 'dark-blue', label: 'Dark Blue', icon: '🔵' },
  { value: 'dark-purple', label: 'Dark Purple', icon: '🟣' },
  { value: 'dark-cyan', label: 'Dark Cyan', icon: '🔷' },
  { value: 'light-modern', label: 'Light', icon: '☀️' },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative group">
      <button
        className="p-2 rounded-md hover:bg-surface-1 transition-colors"
        title="Switch theme"
        aria-label="Theme switcher"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      </button>

      {/* Dropdown Menu - Opens Upward */}
      <div className="absolute right-0 bottom-full mb-2 w-48 bg-surface-0 rounded-md shadow-lg border border-line opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
        <div className="p-2">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-sm hover:bg-surface-1 transition-colors"
            >
              <span className="text-lg">{t.icon}</span>
              <span className="flex-1">{t.label}</span>
              {theme === t.value && (
                <span className="text-primary font-bold">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

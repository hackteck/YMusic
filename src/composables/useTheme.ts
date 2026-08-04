import { readonly, ref } from 'vue'

export type Theme = 'light' | 'dark'

const storageKey = 'ym-theme'
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

// `--background` in each theme, resolved: the packages bake light in as a
// fallback and globals.css names dark. Written out rather than read back off
// the computed style, because `theme-color` won't take an `oklch()`.
const barColor: Record<Theme, string> = { light: '#ffffff', dark: '#080808' }

const theme = ref<Theme>('dark')

const apply = (value: Theme) => {
  theme.value = value
  document.documentElement.dataset.theme = value

  // Installed, this is the status bar (iOS) or the title bar (Android,
  // desktop) — chrome the app paints, so it has to follow the toggle. The
  // manifest's `theme_color` is fixed and only covers the splash.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barColor[value])
}

/** The system's side until the user picks one, and theirs from then on. */
export function initTheme() {
  const stored = localStorage.getItem(storageKey)
  apply(stored === 'light' || stored === 'dark' ? stored : prefersDark.matches ? 'dark' : 'light')

  // The OS can flip while the tab is open — worth following, but only for as
  // long as it is still the one deciding.
  prefersDark.addEventListener('change', (event) => {
    if (!localStorage.getItem(storageKey)) apply(event.matches ? 'dark' : 'light')
  })
}

export function useTheme() {
  const setTheme = (value: Theme) => {
    apply(value)
    localStorage.setItem(storageKey, value)
  }

  return { theme: readonly(theme), setTheme, toggle: () => setTheme(theme.value === 'dark' ? 'light' : 'dark') }
}

import { readonly, ref } from 'vue'

const storageKey = 'ym-history'

/**
 * Whether a finished track is reported to Yandex — and, with it, whether this
 * app keeps the local tally the home page charts.
 *
 * **On unless it has been turned off.** Reporting is what puts a play in
 * music.yandex.ru's history and what everything Yandex recommends is built
 * from, so the default is the one that makes the account work normally; the
 * switch is here for someone who would rather it didn't.
 *
 * Same shape as `useTheme`: a module-level ref mirrored into localStorage, so
 * every reader sees one value and it survives a reload.
 */
const enabled = ref(localStorage.getItem(storageKey) !== 'off')

export function useSettings() {
  const setHistory = (value: boolean) => {
    enabled.value = value
    localStorage.setItem(storageKey, value ? 'on' : 'off')
  }

  return { historyEnabled: readonly(enabled), setHistory }
}

/** For the api and store layers, which only ever ask. */
export const historyEnabled = readonly(enabled)

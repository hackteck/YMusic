import { ref } from 'vue'

/**
 * The OAuth token, owned by the api layer so `client.ts` can read it without
 * depending on a store (the auth store writes it and holds everything else).
 */
const storageKey = 'ym-token'

export const token = ref(localStorage.getItem(storageKey) ?? '')

export function setToken(value: string) {
  token.value = value
  if (value) localStorage.setItem(storageKey, value)
  else localStorage.removeItem(storageKey)
}

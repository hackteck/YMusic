import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getAvatarUrl } from '@/api/auth'
import { getAccount } from '@/api/library'
import { setToken, token } from '@/api/session'
import type { Account } from '@/api/types'

export const useAuth = defineStore('auth', () => {
  const account = ref<Account>()
  const avatar = ref('')
  const checking = ref(false)

  const isAuthenticated = computed(() => !!account.value)

  // Deliberately not awaited by either caller: it's a second request to another
  // host, and the initials hold the header's place until it lands.
  async function loadAvatar() {
    avatar.value = await getAvatarUrl()
  }

  /** Resolves once the token has been accepted or rejected by the API. */
  async function restore() {
    if (!token.value) return
    checking.value = true
    try {
      account.value = await getAccount()
      loadAvatar()
    } catch {
      setToken('')
    } finally {
      checking.value = false
    }
  }

  async function signIn(value: string) {
    setToken(value.trim())
    account.value = await getAccount()
    loadAvatar()
  }

  function signOut() {
    setToken('')
    account.value = undefined
    avatar.value = ''
  }

  return { account, avatar, checking, isAuthenticated, restore, signIn, signOut }
})

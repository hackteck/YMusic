<template>
  <!-- The shell only renders for a signed-in route, so this is a fallback the
       user shouldn't see — worth having, since a rejected token empties the
       account without unmounting the header. -->
  <Button v-if="!auth.account" variant="outline" size="sm" @click="router.push('/login')">
    Войти
  </Button>

  <DropdownMenu v-else :items="menu" align="end" @select="onSelect">
    <template #trigger="{ open, toggle }">
      <button
        :class="$style.trigger"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="open"
        :aria-label="auth.account.displayName"
        @click="toggle"
      >
        <Avatar :src="auth.avatar" :alt="auth.account.displayName" size="sm" />
        <span :class="$style.name">{{ auth.account.displayName }}</span>
      </button>
    </template>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar } from '@surstromming/avatar'
import { Button } from '@surstromming/button'
import { DropdownMenu, type DropdownMenuItem } from '@surstromming/dropdown-menu'
import { LogOut, Settings } from 'lucide'
import { useAuth } from '@/stores/auth'

const router = useRouter()
const auth = useAuth()

const menu = computed<DropdownMenuItem[]>(() => [
  { label: auth.account?.login ?? '', value: 'login', disabled: true },
  { separator: true },
  { label: 'Настройки', value: 'settings', icon: Settings },
  { label: 'Выйти', value: 'signOut', icon: LogOut, destructive: true },
])

function onSelect(value: string) {
  if (value === 'settings') return router.push('/settings')
  if (value !== 'signOut') return
  auth.signOut()
  router.push('/login')
}
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.trigger {
  display: flex;
  align-items: center;
  gap: design.spacing(2);
  border-radius: design.radius(md);
  padding: design.spacing(1);
  color: inherit;
  cursor: pointer;

  &:hover {
    background-color: design.color(accent);
  }
}

// The name is desktop chrome — on a phone the avatar carries it alone.
.name {
  display: none;

  @include design.screen(md) {
    display: block;
    max-width: design.spacing(32);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.875rem;
    font-weight: 500;
  }
}
</style>

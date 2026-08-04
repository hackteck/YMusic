<template>
  <Button :class="$style.root" variant="ghost" size="icon" :aria-label="label" @click="toggle">
    <Icon :icon="theme === 'dark' ? Sun : Moon" :size="18" />
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@surstromming/button'
import { Icon } from '@surstromming/icon'
import { Moon, Sun } from 'lucide'
import { useTheme } from '@/composables/useTheme'

const { theme, toggle } = useTheme()

const label = computed(() => (theme.value === 'dark' ? 'Светлая тема' : 'Тёмная тема'))
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  color: design.color(muted-foreground);
}
</style>

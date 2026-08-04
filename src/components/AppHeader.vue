<template>
  <Header>
    <!-- Everywhere: on a phone it slides the nav in over the page, on a desktop
         it narrows the rail to its icons. -->
    <Button
      :class="$style.toggle"
      variant="ghost"
      size="icon"
      :aria-label="expanded ? 'Свернуть меню' : 'Развернуть меню'"
      :aria-expanded="expanded"
      @click="toggle"
    >
      <Icon :icon="PanelLeft" :size="18" />
    </Button>

    <Separator :class="$style.divider" orientation="vertical" />

    <HeaderSearch />

    <div :class="$style.actions">
      <ThemeToggle />
      <AppAccount />
    </div>
  </Header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@surstromming/button'
import { Header } from '@surstromming/header'
import { Icon } from '@surstromming/icon'
import { Separator } from '@surstromming/separator'
import { isMobile } from '@surstromming/util'
import { PanelLeft } from 'lucide'
import { useSidebar } from '@/composables/useSidebar'
import AppAccount from './AppAccount.vue'
import HeaderSearch from './HeaderSearch.vue'
import ThemeToggle from './ThemeToggle.vue'

const { collapsed, open, toggle } = useSidebar()

/** What the button is announcing: the drawer being in, or the rail being wide. */
const expanded = computed(() => (isMobile.value ? open.value : !collapsed.value))
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.toggle {
  color: design.color(muted-foreground);
}

// A vertical rule fills the flex row it's in, and the header's row is as tall
// as the header — a rule wall to wall reads as a border, not a divider.
.divider {
  align-self: center;
  height: design.spacing(6);
  // The header's gap is 8px; the rule wants room on both sides of it, not to
  // sit as close to the toggle as the toggle sits to the field.
  margin-inline: design.spacing(1);
}

// Hard right at every width. On a phone the search is an icon and there's
// nothing else to take the slack; on a desktop the field grows to its cap and
// this eats what's left over.
.actions {
  display: flex;
  align-items: center;
  gap: design.spacing(1);
  margin-inline-start: auto;
}
</style>

<template>
  <!-- Phone: a drawer over the page, so the scrim goes with it. Desktop: a rail
       in the grid, and `visible` is never true there. -->
  <Backdrop :visible="isMobile && open" layer="sidebar" @click="close" />

  <nav :class="classes">
    <RouterLink :class="$style.brand" to="/" @click="close">
      <Icon :class="$style.brandMark" :icon="AudioLines" :size="22" />
      <span :class="$style.brandName">YMusic</span>
    </RouterLink>

    <ul :class="$style.links">
      <li v-for="link in links" :key="link.to">
        <RouterLink
          :class="$style.link"
          :to="link.to"
          :exact-active-class="$style.isActive"
          @click="close"
        >
          <Icon :icon="link.icon" :size="22" />
          <span :class="$style.label">{{ link.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, useCssModule, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Backdrop } from '@surstromming/backdrop'
import { Icon } from '@surstromming/icon'
import { isMobile } from '@surstromming/util'
import { AudioLines, History, House, Library, Radio, Search } from 'lucide'
import { useSidebar } from '@/composables/useSidebar'

const links = [
  { to: '/', label: 'Главная', icon: House },
  { to: '/search', label: 'Поиск', icon: Search },
  { to: '/radio', label: 'Радио', icon: Radio },
  { to: '/library', label: 'Моя музыка', icon: Library },
  { to: '/history', label: 'История', icon: History },
]

const { collapsed, open, close } = useSidebar()

// Escape is the other way out of anything that covers the page. Listening only
// while it's open keeps the handler off every keystroke in the search field.
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

const $style = useCssModule()
const classes = computed(() => [
  $style.root,
  { [$style.isCollapsed]: collapsed.value, [$style.isOpen]: open.value },
])
</script>

<style module lang="scss">
@use '@surstromming/design' as design;
@use '@/css/tokens' as app;

// Phone: out of the grid entirely and parked off the left edge, so the page
// below it keeps the full width whether the drawer is open or not.
.root {
  display: flex;
  position: fixed;
  z-index: design.z-index(sidebar);
  flex-direction: column;
  gap: design.spacing(4);
  inset-block: 0;
  inset-inline-start: 0;
  width: design.spacing(60);
  border-right: 1px solid design.color(border);
  background-color: design.color(sidebar);
  // Fixed, so it's measured against the viewport and the shell's safe-area
  // padding passes it by — installed on a phone the drawer is edge to edge and
  // keeps itself off the notch and the home indicator.
  padding: calc(#{design.spacing(3)} + env(safe-area-inset-top)) design.spacing(3)
    calc(#{design.spacing(3)} + env(safe-area-inset-bottom));
  transform: translateX(-100%);
  transition: transform 0.2s ease;

  @include design.screen(md) {
    position: static;
    width: design.spacing(60);
    // Back in the grid, so the shell's padding is already holding the insets
    // off it and a second helping here would count them twice.
    padding: design.spacing(3);
    transform: none;
    transition: width 0.2s ease;
  }
}

.isOpen {
  transform: translateX(0);
}

.brand {
  display: flex;
  // Same height as the header beside it, so the wordmark and the toggle sit on
  // one line across the fold.
  align-items: center;
  gap: design.spacing(2);
  height: design.spacing(9);
  overflow: hidden;
  padding-inline: design.spacing(2);
  color: inherit;
  text-decoration: none;
}

.brandMark {
  flex-shrink: 0;
  color: app.color(brand);
}

.brandName {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

// Collapsed the rail keeps its icons rather than leaving: a hidden nav on a
// desktop leaves the wordmark as the only way anywhere. Width is stated on both
// sides — `auto` wouldn't animate. Never on a phone, where the drawer is either
// there in full or not at all.
.isCollapsed {
  @include design.screen(md) {
    width: design.spacing(16);

    // The rows still span the rail, so the icon centres in one instead of
    // sitting where its vanished label used to start.
    .brand,
    .link {
      justify-content: center;
      padding-inline: 0;
    }

    .brandName,
    .label {
      display: none;
    }
  }
}

.links {
  display: flex;
  flex-direction: column;
  gap: design.spacing(1);
  list-style: none;
  // `list-style: none` drops the marker but not the 40px the UA reserves for
  // it — which is the rail's whole content box once it's collapsed.
  padding-inline-start: 0;

  > li {
    width: 100%;
  }
}

.link {
  display: flex;
  align-items: center;
  gap: design.spacing(3);
  border-radius: design.radius(md);
  padding: design.spacing(2.5) design.spacing(3);
  color: design.color(muted-foreground);
  text-decoration: none;

  &:hover {
    background-color: design.color(sidebar-accent);
    color: design.color(sidebar-accent-foreground);
  }

  &.isActive {
    background-color: design.color(sidebar-accent);
    color: app.color(brand);
  }
}

.label {
  font-size: 0.9375rem;
  font-weight: 500;
}
</style>

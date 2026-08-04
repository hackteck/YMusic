<template>
  <section :class="$style.root">
    <!-- A heading that leads somewhere becomes the link, rather than growing a
         "see all" beside it: the words are already the thing being pointed at. -->
    <component :is="to ? RouterLink : 'h2'" :class="[$style.title, to && $style.isLink]" :to="to">
      {{ title }}
      <Icon v-if="to" :class="$style.chevron" :icon="ChevronRight" :size="18" />
    </component>

    <slot />
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Icon } from '@surstromming/icon'
import { ChevronRight } from 'lucide'

defineProps<{ title: string; to?: string }>()
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  display: flex;
  flex-direction: column;
  gap: design.spacing(3);
}

.title {
  font-size: 1.125rem;
  font-weight: 600;

  @include design.screen(md) {
    font-size: 1.375rem;
  }
}

.isLink {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: design.spacing(1);
  color: inherit;
  text-decoration: none;

  &:hover .chevron {
    transform: translateX(2px);
  }
}

// The affordance, since the heading itself keeps the colour of one that isn't
// a link — underlining a section title reads as an error.
.chevron {
  color: design.color(muted-foreground);
  transition: transform 0.15s ease;
}
</style>

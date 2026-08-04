<template>
  <div :class="$style.root">
    <!-- Indexed: search can return the same album under two entries. -->
    <MediaCard v-for="(item, index) in items" :key="`${item.to}-${index}`" v-bind="item" />
  </div>
</template>

<script setup lang="ts">
import MediaCard from './MediaCard.vue'
import type { MediaItem } from './media'

defineProps<{ items: MediaItem[] }>()
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

// Column count follows the width, so the same grid works from a phone to a
// wide desktop without a breakpoint per step.
.root {
  display: grid;
  gap: design.spacing(4);
  grid-template-columns: repeat(auto-fill, minmax(design.spacing(32), 1fr));

  @include design.screen(md) {
    gap: design.spacing(6);
    grid-template-columns: repeat(auto-fill, minmax(design.spacing(40), 1fr));
  }
}
</style>

<template>
  <RouterLink :to="to" :class="$style.root">
    <CoverMosaic v-if="covers?.length === 4" :class="$style.cover" :covers="covers" />
    <CoverArt v-else :class="$style.cover" :src="cover" :alt="title" :shape="shape" :kind="kind" />

    <span :class="$style.title">{{ title }}</span>
    <span v-if="subtitle" :class="$style.subtitle">{{ subtitle }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import CoverArt from './CoverArt.vue'
import CoverMosaic from './CoverMosaic.vue'

withDefaults(
  defineProps<{
    to: string
    cover?: string
    /** A collection's four sample covers; takes the place of `cover` when set. */
    covers?: string[]
    title: string
    subtitle?: string
    shape?: 'square' | 'circle'
    kind?: 'track' | 'album' | 'artist'
  }>(),
  { shape: 'square', kind: 'album' },
)
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  display: flex;
  flex-direction: column;
  gap: design.spacing(1);
  color: inherit;
  text-decoration: none;
}

.cover {
  width: 100%;
  margin-bottom: design.spacing(1);
  box-shadow: design.shadow(sm);
  transition: transform 0.2s ease;

  .root:hover & {
    transform: translateY(-2px);
  }
}

// Two lines, then ellipsis — titles vary wildly and a ragged grid reads worse
// than a clipped one.
.title,
.subtitle {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  line-height: 1.3;
}

.title {
  font-size: 0.875rem;
  font-weight: 500;
}

.subtitle {
  -webkit-line-clamp: 1;
  color: design.color(muted-foreground);
  font-size: 0.8125rem;
}
</style>

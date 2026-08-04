<template>
  <div :class="classes">
    <img v-if="status === 'loaded'" :class="$style.image" :src="src" :alt="alt" />
    <Icon v-else :class="$style.placeholder" :icon="fallbackIcon" />
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, useCssModule } from 'vue'
import { useImageStatus } from '@surstromming/avatar'
import { Icon } from '@surstromming/icon'
import { Disc3, Music, User } from 'lucide'

const props = withDefaults(
  defineProps<{
    src?: string
    alt?: string
    /** Artists are round, everything else square. */
    shape?: 'square' | 'circle'
    kind?: 'track' | 'album' | 'artist'
  }>(),
  { shape: 'square', kind: 'album' },
)

// Preloaded off-DOM, so a slow or broken cover shows the placeholder instead
// of flashing a half-painted image.
const status = useImageStatus(toRef(props, 'src'))

const icons = { track: Music, album: Disc3, artist: User }
const fallbackIcon = computed(() => icons[props.kind])

const $style = useCssModule()
const classes = computed(() => [$style.root, $style[`shape-${props.shape}`]])
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  aspect-ratio: 1;
  overflow: hidden;
  background-color: design.color(muted);
  color: design.color(muted-foreground);
}

.shape-square {
  border-radius: design.radius(md);
}

.shape-circle {
  border-radius: 9999px;
}

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

// Scales with the cover rather than the surrounding text.
.placeholder {
  width: 40%;
  height: 40%;
}
</style>

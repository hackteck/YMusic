<template>
  <!-- Four covers in a square, the way Yandex draws a playlist that has no
       artwork of its own. A collection card showing one album's cover would
       read as that album. -->
  <div :class="$style.root">
    <CoverArt
      v-for="(src, index) in covers"
      :key="index"
      :class="$style.tile"
      :src="src"
      kind="album"
    />
  </div>
</template>

<script setup lang="ts">
import CoverArt from './CoverArt.vue'

defineProps<{ covers: string[] }>()
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  display: grid;
  aspect-ratio: 1;
  overflow: hidden;
  grid-template-columns: 1fr 1fr;
  border-radius: design.radius(md);
}

// Two classes deep: CoverArt rounds its own corners from a single class, and a
// tie would be settled by whichever stylesheet loaded last. Only the mosaic's
// outer edge is rounded — the seams inside it are square.
.root .tile {
  border-radius: 0;
}
</style>

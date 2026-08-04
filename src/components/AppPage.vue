<template>
  <!-- autoHide on a phone: a parked bar would eat 18px of every row, and an
       overlay that fades is what a touch scroller is supposed to look like.
       vertical, so a shelf that bleeds a pixel past the margin gets clipped
       rather than handed the whole page a sideways bar. -->
  <ScrollArea as="main" orientation="vertical" :auto-hide="isMobile">
    <!-- Padding and max-width sit inside the scroller, so they scroll with the
         content instead of boxing the scrollbar in. -->
    <div :class="$style.page">
      <slot />
    </div>
  </ScrollArea>
</template>

<script setup lang="ts">
import { ScrollArea } from '@surstromming/scroll-area'
import { isMobile } from '@surstromming/util'
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.page {
  display: flex;
  flex-direction: column;
  gap: design.spacing(8);
  padding: design.spacing(4);

  @include design.screen(md) {
    gap: design.spacing(10);
    padding: design.spacing(6);
  }

  @include design.screen(xl) {
    margin-inline: auto;
    width: 100%;
    max-width: design.spacing(320);
  }
}
</style>

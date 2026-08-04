<template>
  <ContentSection :title="title" :to="to">
    <!-- A rail, not a grid: a shelf should hint that there's more to the right,
         and on a phone a swipe is the natural gesture. autoHide on mobile for
         the same reason AppPage does it — a parked bar under every shelf would
         eat 18px a piece, and there are several on a page. -->
    <ScrollArea orientation="horizontal" :auto-hide="isMobile" :class="$style.shelf">
      <div :class="$style.rail">
        <MediaCard
          v-for="(item, index) in items"
          :key="`${item.to}-${index}`"
          :class="$style.card"
          v-bind="item"
        />
      </div>
    </ScrollArea>
  </ContentSection>
</template>

<script setup lang="ts">
import { ScrollArea } from '@surstromming/scroll-area'
import { isMobile } from '@surstromming/util'
import ContentSection from './ContentSection.vue'
import MediaCard from './MediaCard.vue'
import type { MediaItem } from './media'

defineProps<{ title: string; items: MediaItem[]; to?: string }>()
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.shelf {
  // Bleeds to the page edges so cards scroll out of view rather than stopping
  // short of them; the rail's padding puts the first one back on the text margin.
  margin-inline: calc(-1 * #{design.spacing(4)});

  @include design.screen(md) {
    margin-inline: calc(-1 * #{design.spacing(6)});
  }
}

.rail {
  display: flex;
  // Sized to the cards rather than to the viewport, so the trailing padding is
  // past the last card instead of collapsing onto the scroller's edge.
  width: max-content;
  gap: design.spacing(4);
  padding-inline: design.spacing(4);
  // Keeps the bar off the subtitles — parked it sits flush under the viewport,
  // and auto-hiding it floats over whatever is there.
  padding-bottom: design.spacing(2);

  @include design.screen(md) {
    padding-inline: design.spacing(6);
  }
}

// Stated as a `width`, not as a flex-basis, and that is what keeps the rail
// honest: WebKit sizes a `max-content` flex container from its items' *content*
// widths and ignores a fixed flex-basis, so a card's untruncated title — the
// two-line clamp still wraps, so its max-content is the whole line — counted
// towards the rail. On an iPhone that put ~700px of empty space past the last
// card and left the scrollbar thumb at half its length. A real `width` caps the
// contribution. Chromium and Firefox lay this out identically either way.
.card {
  flex: none;
  width: design.spacing(36);

  @include design.screen(md) {
    width: design.spacing(44);
  }
}
</style>

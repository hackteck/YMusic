<template>
  <ContentSection :title="title">
    <!-- A rail rather than a grid, for the reason MediaShelf is one: there are
         only ever a handful of these and they shouldn't own a page's width. -->
    <ScrollArea orientation="horizontal" :auto-hide="isMobile" :class="$style.shelf">
      <div :class="$style.rail">
        <StationCard
          v-for="station in stations"
          :key="stationKey(station.id)"
          :class="$style.card"
          :station="station"
        />
      </div>
    </ScrollArea>
  </ContentSection>
</template>

<script setup lang="ts">
import { ScrollArea } from '@surstromming/scroll-area'
import { isMobile } from '@surstromming/util'
import { stationKey, type Station } from '@/api/rotor'
import ContentSection from './ContentSection.vue'
import StationCard from './StationCard.vue'

defineProps<{ title: string; stations: Station[] }>()
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

// The same bleed MediaShelf takes, so the two kinds of row line up down a page.
.shelf {
  margin-inline: calc(-1 * #{design.spacing(4)});

  @include design.screen(md) {
    margin-inline: calc(-1 * #{design.spacing(6)});
  }
}

.rail {
  display: flex;
  // Sized to the cards, so the trailing padding lands past the last one rather
  // than collapsing onto the scroller's edge.
  width: max-content;
  gap: design.spacing(4);
  padding-inline: design.spacing(4);
  padding-bottom: design.spacing(2);

  @include design.screen(md) {
    padding-inline: design.spacing(6);
  }
}

// Bigger than a browsing tile: there are four of these, not four hundred.
// A `width` rather than a flex-basis, for the reason MediaShelf states one.
.card {
  flex: none;
  width: design.spacing(32);

  @include design.screen(md) {
    width: design.spacing(40);
  }
}
</style>

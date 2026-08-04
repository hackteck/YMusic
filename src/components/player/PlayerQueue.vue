<template>
  <ScrollArea orientation="vertical" :class="$style.root">
    <ol :class="$style.list">
      <li v-for="(entry, index) in entries" :key="`${entry.track.id}-${index}`">
        <button
          :class="[$style.row, { [$style.isActive]: index === player.position }]"
          type="button"
          @click="player.jumpTo(index)"
        >
          <CoverArt :class="$style.cover" :src="entry.cover" :alt="entry.track.title" kind="track" />
          <span :class="$style.text">
            <span :class="$style.title">{{ entry.track.title }}</span>
            <span :class="$style.artists">{{ artistNames(entry.track.artists) }}</span>
          </span>
          <span :class="$style.duration">{{ formatDuration(entry.track.durationMs) }}</span>
        </button>
      </li>
    </ol>
  </ScrollArea>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ScrollArea } from '@surstromming/scroll-area'
import { coverUrl } from '@/api/cover'
import CoverArt from '@/components/CoverArt.vue'
import { artistNames, formatDuration } from '@/components/media'
import { usePlayer } from '@/stores/player'

const player = usePlayer()

// `order` is the sequence, `queue` the list the user picked — shuffled, those
// differ, and what's coming next is the one worth showing.
const entries = computed(() =>
  player.order.map((index) => {
    const track = player.queue[index]
    return { track, cover: coverUrl(track.coverUri, 100) }
  }),
)
</script>

<style module lang="scss">
@use '@surstromming/design' as design;
@use '@/css/tokens' as app;

.root {
  width: 100%;
  height: 100%;
}

.list {
  display: flex;
  flex-direction: column;
  list-style: none;
  // `list-style: none` drops the marker but not the 40px the UA reserves for it.
  padding-inline-start: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: design.spacing(3);
  width: 100%;
  border-radius: design.radius(md);
  padding: design.spacing(2);
  color: inherit;
  text-align: start;
  cursor: pointer;

  &:hover {
    background-color: design.color(accent);
  }
}

.cover {
  flex-shrink: 0;
  width: design.spacing(11);
}

.text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.title,
.artists {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.title {
  font-size: 0.9375rem;

  .isActive & {
    color: app.color(brand);
  }
}

.artists {
  color: design.color(muted-foreground);
  font-size: 0.8125rem;
}

.duration {
  flex-shrink: 0;
  color: design.color(muted-foreground);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}
</style>

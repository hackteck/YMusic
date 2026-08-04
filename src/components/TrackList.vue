<template>
  <div ref="list" :class="$style.root">
    <!-- The rows above and below the window, as the height they would take.
         Together with the mounted ones the list is always exactly its full
         height, so the scrollbar never moves under the thumb. -->
    <div :style="{ height: `${padTop}px` }" aria-hidden="true" />

    <TrackRow
      v-for="(track, offset) in window"
      :key="`${track.id}-${first + offset}`"
      :track="track"
      :number="numbered ? first + offset + 1 : undefined"
      :chart="chart?.[first + offset]"
      :active="track.id === player.current?.id"
      @play="player.play(tracks, first + offset, playlistId)"
    />

    <div :style="{ height: `${padBottom}px` }" aria-hidden="true" />
  </div>
</template>

<script lang="ts">
/**
 * One row, in pixels. `TrackRow` pins itself to this so the two can't drift:
 * the spacers above and below stand in for every row not mounted, and a number
 * that was merely close would leave the list the wrong height. Exported because
 * a page standing in for a list it hasn't fetched yet needs the same number.
 */
export const ROW_HEIGHT = 60
</script>

<script setup lang="ts">
import { computed, toRef, useTemplateRef } from 'vue'
import { usePlayer } from '@/stores/player'
import { useVirtualRows } from '@/composables/useVirtualRows'
import TrackRow from './TrackRow.vue'
import type { ChartPosition, Track } from '@/api/types'

const props = defineProps<{
  tracks: Track[]
  /** Numbers the rows — the cover shows either way. */
  numbered?: boolean
  /** Parallel to `tracks`, and only the chart has one. */
  chart?: ChartPosition[]
  /** Rides along into the play report; only a playlist has one. */
  playlistId?: string
}>()

const player = usePlayer()

// Only what's on screen is mounted, wherever on screen happens to be. A
// 978-track library is ~34 rows and ~1 MB of heap this way, against ~12 800
// nodes and 76 MB for the whole list.
const list = useTemplateRef<HTMLElement>('list')
const { first, last } = useVirtualRows(
  list,
  toRef(() => props.tracks.length),
  ROW_HEIGHT,
)

const window = computed(() => props.tracks.slice(first.value, last.value))

const padTop = computed(() => first.value * ROW_HEIGHT)
const padBottom = computed(() => (props.tracks.length - last.value) * ROW_HEIGHT)
</script>

<style module lang="scss">
.root {
  display: flex;
  flex-direction: column;
}
</style>

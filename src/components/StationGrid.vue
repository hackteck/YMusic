<template>
  <!-- The rows off screen are reserved as padding on the outside rather than as
       spacer cells inside the grid: a child of the grid takes a row of its own
       and a gap with it, and the reserved height has to land exactly. -->
  <div
    ref="root"
    :style="{ paddingTop: `${padTop}px`, paddingBottom: `${padBottom}px` }"
  >
    <div ref="grid" :class="$style.grid">
      <StationCard v-for="station in window" :key="stationKey(station.id)" :station="station" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { stationKey, type Station } from '@/api/rotor'
import { useVirtualRows } from '@/composables/useVirtualRows'
import StationCard from './StationCard.vue'

const props = defineProps<{ stations: Station[] }>()

const root = useTemplateRef<HTMLElement>('root')
const grid = useTemplateRef<HTMLElement>('grid')

/** How many tiles `auto-fill` actually put on a row: 2 on a phone, 8 open. */
const columns = ref(1)
/** A tile plus the gap under it — the step from one row's top to the next. */
const pitch = ref(0)

// Both are read back off the laid-out grid rather than named here, so the tile
// size and the gap stay defined once, in the stylesheet below.
function measure() {
  const card = grid.value?.firstElementChild
  if (!grid.value || !card) return

  const styles = getComputedStyle(grid.value)
  columns.value = styles.gridTemplateColumns.split(' ').length
  pitch.value = card.getBoundingClientRect().height + parseFloat(styles.rowGap)
}

// Width is the only thing that changes the layout. The grid's *height* changes
// on every scroll as the window moves through it, and measuring there would be
// a layout read per frame for an answer that hasn't moved.
let width = 0
const observer = new ResizeObserver(([entry]) => {
  if (entry.contentRect.width === width) return
  width = entry.contentRect.width
  measure()
})

watch(
  grid,
  (element) => {
    observer.disconnect()
    if (element) observer.observe(element)
  },
  { flush: 'post' },
)

onBeforeUnmount(() => observer.disconnect())

// 447 micro-genres is 447 tiles and as many images the moment they mount, so
// the grid rides the same window a track list does — a row of it is just a row
// of several, and the tiles it hasn't mounted are reserved as height.
const rows = computed(() => Math.ceil(props.stations.length / columns.value))
const { first, last } = useVirtualRows(root, rows, pitch)

const window = computed(() =>
  props.stations.slice(first.value * columns.value, last.value * columns.value),
)

const padTop = computed(() => first.value * pitch.value)
const padBottom = computed(() => (rows.value - last.value) * pitch.value)
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

// Tighter than MediaGrid: a station is a name on a colour, not artwork with two
// lines under it, so more of them fit on a row before they stop being scannable.
.grid {
  display: grid;
  gap: design.spacing(4);
  grid-template-columns: repeat(auto-fill, minmax(design.spacing(24), 1fr));

  @include design.screen(md) {
    grid-template-columns: repeat(auto-fill, minmax(design.spacing(28), 1fr));
  }
}
</style>

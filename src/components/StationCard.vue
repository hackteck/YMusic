<template>
  <!-- A button, not a link: a station has no page to open. Pressing it starts
       the wave, and pressing the one already playing pauses it. -->
  <button :class="classes" type="button" :aria-label="label" @click="toggle">
    <span :class="$style.tile" :style="{ backgroundColor: station.icon?.backgroundColor }">
      <img v-if="icon" :class="$style.glyph" :src="icon" alt="" />

      <!-- A wave takes a request and then a whole track before it makes a
           sound, so the tile waits the same way a track row does. -->
      <span :class="$style.state">
        <Spinner v-if="starting" :size="20" />
        <PlayingBars v-else-if="active && player.playing" />
        <Icon v-else :icon="Play" :size="20" />
      </span>
    </span>

    <span :class="$style.name">{{ station.name }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed, useCssModule } from 'vue'
import { Icon } from '@surstromming/icon'
import { Spinner } from '@surstromming/spinner'
import { Play } from 'lucide'
import { coverUrl } from '@/api/cover'
import { stationKey, type Station } from '@/api/rotor'
import { usePlayer } from '@/stores/player'
import PlayingBars from './PlayingBars.vue'

const props = defineProps<{ station: Station }>()

const player = usePlayer()

// The glyph is a small transparent PNG meant to sit on the colour beside it —
// which is how a station tile stays unmistakably not an album cover.
const icon = computed(() => coverUrl(props.station.icon?.imageUrl, 200))

const active = computed(
  () => !!player.station && stationKey(player.station.id) === stationKey(props.station.id),
)

const starting = computed(() => active.value && player.loading)

const label = computed(() =>
  active.value && player.playing ? 'Пауза' : `Слушать «${props.station.name}»`,
)

const toggle = () => (active.value ? player.toggle() : player.playStation(props.station))

const $style = useCssModule()
const classes = computed(() => [$style.root, { [$style.isActive]: active.value }])
</script>

<style module lang="scss">
@use '@surstromming/design' as design;
@use '@/css/tokens' as app;

.root {
  display: flex;
  flex-direction: column;
  gap: design.spacing(2);
  border: none;
  background: none;
  padding: 0;
  color: inherit;
  text-align: center;
  cursor: pointer;
}

.tile {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: design.radius(lg);
  box-shadow: design.shadow(sm);
  transition: transform 0.2s ease;

  .root:hover & {
    transform: translateY(-2px);
  }
}

.glyph {
  width: 60%;
  height: 60%;
  object-fit: contain;
}

// Over the tile rather than beside it: the artwork is the affordance, and a
// separate button would double the target on a phone.
.state {
  display: flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  inset: 0;
  background-color: color-mix(in oklab, black 45%, transparent);
  color: white;
  opacity: 0;
  transition: opacity 0.15s ease;

  .root:hover &,
  .root:focus-visible & {
    opacity: 1;
  }
}

// The station that's playing says so without being hovered — it's the one fact
// a wall of tiles has to carry.
.isActive .state {
  opacity: 1;
}

.name {
  overflow: hidden;
  color: design.color(muted-foreground);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.3;
  // Two lines whether or not the name needs both. StationGrid reserves the
  // height of the rows it hasn't mounted from one it has, so a row holding a
  // name that wraps has to be the same height as one that doesn't.
  height: 2.6em;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;

  .isActive & {
    color: app.color(brand);
  }
}
</style>

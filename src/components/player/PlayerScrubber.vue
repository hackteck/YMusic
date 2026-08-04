<template>
  <div :class="$style.root">
    <Slider
      v-model="seconds"
      :class="$style.slider"
      :max="player.duration || 1"
      :step="0.5"
      aria-label="Перемотка"
    />
    <div :class="$style.times">
      <span>{{ formatTime(player.currentTime) }}</span>
      <span>{{ formatTime(player.duration) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Slider } from '@surstromming/slider'
import { formatTime } from '@/components/media'
import { usePlayer } from '@/stores/player'

const player = usePlayer()

// Seeks straight through the drag — the audio is a fully-loaded blob, so
// there's nothing to buffer and a commit-on-release would only feel laggy.
const seconds = computed({
  get: () => player.currentTime,
  set: (value: number) => player.seek(value),
})
</script>

<style module lang="scss">
@use '@surstromming/design' as design;
@use '@/css/tokens' as app;

.root {
  display: flex;
  flex-direction: column;
  gap: design.spacing(1);
  width: 100%;
}

// Repainting the slider through the token it already reads — the design
// package's own runtime-theming hatch, no fork of the component needed.
.slider {
  --primary: #{app.color(brand)};
}

// The package haloes the knob on hover as well as on focus, and on hover that
// ring swelling in and out as the pointer crosses the line reads as a pulse.
// Keep it for focus, where it's the keyboard's only cue. Two classes deep,
// since one each would only tie and a tie goes to whichever loaded last.
.root .slider:hover::-webkit-slider-thumb {
  box-shadow: design.shadow(sm);
}

.root .slider:hover::-moz-range-thumb {
  box-shadow: design.shadow(sm);
}

.times {
  display: flex;
  justify-content: space-between;
  color: design.color(muted-foreground);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
</style>

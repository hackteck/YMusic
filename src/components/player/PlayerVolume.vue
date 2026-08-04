<template>
  <div :class="$style.root">
    <Button variant="ghost" size="icon" :aria-label="label" @click="player.muted = !player.muted">
      <Icon :icon="icon" :size="18" />
    </Button>
    <Slider v-model="player.volume" :class="$style.slider" :max="1" :step="0.01" aria-label="Громкость" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@surstromming/button'
import { Icon } from '@surstromming/icon'
import { Slider } from '@surstromming/slider'
import { Volume1, Volume2, VolumeX } from 'lucide'
import { usePlayer } from '@/stores/player'

const player = usePlayer()

const icon = computed(() => {
  if (player.muted || !player.volume) return VolumeX
  return player.volume < 0.5 ? Volume1 : Volume2
})

const label = computed(() => (player.muted ? 'Включить звук' : 'Выключить звук'))
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  display: flex;
  align-items: center;
  gap: design.spacing(1);
  color: design.color(muted-foreground);
}

.slider {
  width: design.spacing(24);
}

// The seek line's rule, for the same reason: the package's hover halo pulses
// around the knob as the pointer crosses it. Focus keeps its ring.
.root .slider:hover::-webkit-slider-thumb {
  box-shadow: design.shadow(sm);
}

.root .slider:hover::-moz-range-thumb {
  box-shadow: design.shadow(sm);
}
</style>

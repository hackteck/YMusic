<template>
  <div
    ref="root"
    :class="[$style.root, { [$style.isActive]: active || isMobile, [$style.isScrubbing]: active }]"
    @pointerenter="active = true"
    @pointerleave="active = false"
    @pointerdown="active = true"
    @pointerup="release"
    @pointercancel="active = false"
  >
    <span :class="$style.elapsed" :style="{ left: `${elapsedLeft}px` }">
      {{ formatTime(player.currentTime) }}
    </span>

    <!-- Dropped once the head gets close enough to sit on top of it. -->
    <span v-if="showDuration" :class="$style.total">{{ formatTime(player.duration) }}</span>

    <Slider
      v-model="seconds"
      :class="$style.slider"
      :max="player.duration || 1"
      :step="0.5"
      aria-label="Перемотка"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { Slider } from '@surstromming/slider'
import { isMobile } from '@surstromming/util'
import { formatTime } from '@/components/media'
import { usePlayer } from '@/stores/player'

/** Half a bubble, near enough — what it takes to keep one clear of an edge. */
const BUBBLE_HALF = 32

const player = usePlayer()

/** Pointer is on the line: hovering it, or dragging it on a touch screen. */
const active = ref(false)

// A mouse that's still over the line hasn't stopped hovering it. Dropping back
// to a hairline the instant a seek ended — under a cursor that hadn't moved —
// read as the line flinching; a finger really is gone when it lifts.
const release = (event: PointerEvent) => {
  if (event.pointerType !== 'mouse') active.value = false
}

// Seeks straight through the drag — the audio is a fully-loaded blob, so
// there's nothing to buffer and a commit-on-release would only feel laggy.
const seconds = computed({
  get: () => player.currentTime,
  set: (value: number) => player.seek(value),
})

// The bubbles are placed in pixels, not percent, because both questions below
// are about pixels: whether one is falling off an edge, and whether two are
// about to sit on top of each other. A percentage threshold that read right on
// a phone would hide the duration a third of the way through on a desktop.
const width = ref(0)
const root = useTemplateRef<HTMLElement>('root')

let resize: ResizeObserver | undefined
watch(root, (element) => {
  resize?.disconnect()
  if (!element) return
  resize = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width))
  resize.observe(element)
})

onBeforeUnmount(() => resize?.disconnect())

const elapsedLeft = computed(() => {
  const at = player.progress * width.value
  return Math.min(Math.max(at, BUBBLE_HALF), Math.max(width.value - BUBBLE_HALF, BUBBLE_HALF))
})

/** Room for the head's own bubble, the pinned one, and a gap between them. */
const showDuration = computed(() => elapsedLeft.value < width.value - BUBBLE_HALF * 3.5)
</script>

<style module lang="scss">
@use '@surstromming/design' as design;
@use '@/css/tokens' as app;

.root {
  position: relative;
  width: 100%;
}

// Two classes deep on purpose: Slider draws its track and thumb from a single
// class of its own, and a tie would be settled by whichever stylesheet loaded
// last. Everything below repaints it rather than replacing it — `--primary` is
// the package's own runtime-theming hatch.
//
// The band the input occupies stays 16px whatever the line is doing: it's the
// grab target, and on a phone that's the whole reason this control moved out
// here instead of living only inside the full-screen player.
.root .slider {
  --primary: #{app.color(brand)};

  display: block;
  height: design.spacing(4);
  border-radius: 0;
  background-size: 100% 3px;
  transition: background-size 0.15s ease;
}

// The knob rides the line rather than sitting on it. The two pseudo-elements
// can't be grouped: an unknown selector in the list voids the whole rule in
// that engine.
.root .slider::-webkit-slider-thumb {
  width: design.spacing(2.5);
  height: design.spacing(2.5);
  border-color: app.color(brand);
  background-color: app.color(brand);
  box-shadow: none;
  transition:
    width 0.15s ease,
    height 0.15s ease;
}

.root .slider::-moz-range-thumb {
  width: design.spacing(2.5);
  height: design.spacing(2.5);
  border-color: app.color(brand);
  background-color: app.color(brand);
  box-shadow: none;
  transition:
    width 0.15s ease,
    height 0.15s ease;
}

// A hairline until you reach for it — and on a phone there is no reaching, so
// it stays at full size there.
.isActive .slider {
  background-size: 100% 6px;
}

.isActive .slider::-webkit-slider-thumb {
  width: design.spacing(3.5);
  height: design.spacing(3.5);
}

.isActive .slider::-moz-range-thumb {
  width: design.spacing(3.5);
  height: design.spacing(3.5);
}

// The package haloes the thumb on hover as well as focus. Keep it for focus,
// where it's the keyboard's only cue; on hover it reads as a smudge on a line
// this thin.
.root .slider:hover::-webkit-slider-thumb {
  box-shadow: none;
}

.root .slider:hover::-moz-range-thumb {
  box-shadow: none;
}

// Above the line, so they don't cover the thing being scrubbed. Never a pointer
// target — one sitting under the cursor would fight the drag it's reporting on.
//
// The rung matters: the player spans both shell columns, so near the start of a
// track this bubble hangs over the nav rail — which is a *later* sibling than
// the footer and painted straight over it. They're tooltips, so they take the
// ladder's tooltip rung rather than a number invented here.
.elapsed,
.total {
  position: absolute;
  z-index: design.z-index(tooltip);
  bottom: 100%;
  border: 1px solid design.color(border);
  border-radius: design.radius(lg);
  background-color: design.color(popover);
  padding: design.spacing(1) design.spacing(2.5);
  box-shadow: design.shadow(md);
  color: design.color(popover-foreground);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.elapsed {
  transform: translateX(-50%);
}

.total {
  right: design.spacing(2);
}

.isScrubbing .elapsed,
.isScrubbing .total {
  opacity: 1;
}
</style>

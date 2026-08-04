<template>
  <Teleport to="body">
    <Transition name="player-screen">
      <section v-if="open && track" :class="$style.root">
        <header :class="$style.bar">
          <Button variant="ghost" size="icon" aria-label="Свернуть" @click="close">
            <Icon :icon="ChevronDown" :size="22" />
          </Button>
          <span :class="$style.source">{{ source }}</span>
        </header>

        <!-- The queue takes the cover's place rather than opening beside it:
             on a phone there is only ever room for one of them. -->
        <div
          :class="$style.stage"
          @pointerdown="startSwipe"
          @pointerup="endSwipe"
          @pointercancel="cancelSwipe"
        >
          <PlayerLyrics v-if="view === 'lyrics'" />
          <PlayerQueue v-else-if="view === 'queue'" />
          <CoverArt v-else :class="$style.cover" :src="cover" :alt="track.title" kind="track" />
        </div>

        <!-- The title goes where the bar's does: there is no track page, and
             `/album/<id>` is the page this song lives on. -->
        <div v-if="!compact" :class="$style.meta">
          <h1 :class="$style.title">
            <component
              :is="album ? RouterLink : 'span'"
              :class="$style.titleLink"
              :to="album ? albumLink(album) : undefined"
              @click="close"
            >
              {{ track.title }}
            </component>
          </h1>
          <span :class="$style.artists">
            <template v-for="(artist, index) in track.artists" :key="artist.id">
              <span v-if="index">, </span>
              <RouterLink :class="$style.artist" :to="artistLink(artist)" @click="close">{{
                artist.name
              }}</RouterLink>
            </template>
          </span>
        </div>

        <PlayerScrubber v-if="!compact" />

        <!-- Always two rows, at every width: side by side these eight controls
             are 396px of content in a 350px phone, and the transport is the one
             that wants the room. On a short window they shrink rather than
             merge — the rule that keeps them apart is about width, and the
             room that's missing here is height. -->
        <div :class="$style.actions">
          <PlayerControls :size="compact ? 'sm' : 'lg'" variant="transport" />

          <div :class="$style.row">
            <PlayerControls :class="$style.extras" variant="extras" />
            <PlayerVolume :class="$style.volume" />
          </div>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@surstromming/button'
import { Icon } from '@surstromming/icon'
import { ChevronDown } from 'lucide'
import { coverUrl } from '@/api/cover'
import CoverArt from '@/components/CoverArt.vue'
import { albumLink, artistLink } from '@/router/links'
import { usePlayer } from '@/stores/player'
import { usePlayerScreen } from '@/composables/usePlayerScreen'
import { viewportHeight } from '@/composables/useViewportHeight'
import PlayerControls from './PlayerControls.vue'
import PlayerLyrics from './PlayerLyrics.vue'
import PlayerQueue from './PlayerQueue.vue'
import PlayerScrubber from './PlayerScrubber.vue'
import PlayerVolume from './PlayerVolume.vue'

const player = usePlayer()
const { open, view, close } = usePlayerScreen()

// The bar's rule, for the same reason: this names the song being heard.
const track = computed(() => player.nowPlaying)
const album = computed(() => track.value?.albums[0])
const cover = computed(() => coverUrl(track.value?.coverUri, 600))

/**
 * Below this the screen is mostly chrome. A 560px window left the queue 185px —
 * three rows — with the title, the scrubber and a 64px play button taking the
 * rest, so under it those give way and the stage keeps what's left. The cover
 * view is exempt: there the stage *is* the artwork, and shrinking the chrome to
 * grow a picture buys nothing.
 */
const SHORT = 600

const compact = computed(() => viewportHeight.value < SHORT && view.value !== 'cover')

// Which wave is playing, now that three different buttons can start one — an
// endless stream with nothing naming it is the one thing worth saying up here.
const source = computed(() => {
  if (view.value === 'queue') return 'Очередь'
  return player.station?.name ?? 'Сейчас играет'
})

// A cover the user hasn't seen yet shouldn't arrive with the last track's lyrics
// still up. The queue survives — it's about the session, not the song.
watch(track, () => {
  if (view.value === 'lyrics') view.value = 'cover'
})

/**
 * Swiping the stage steps through the queue — left for the next track, right
 * for the one before, the gesture a phone expects of a full-screen player.
 *
 * The **stage only**, not the whole screen: the scrubber below it is a
 * horizontal drag of its own, and its pointerup bubbles up here.
 */
const SWIPE = 60
/** How far horizontal has to beat vertical, so scrolling the queue isn't a skip. */
const SLOPE = 1.5

let from: { x: number; y: number } | undefined

// A mouse never swipes: dragging the cover starts a native image drag, which
// swallows the pointerup this ends on.
const startSwipe = (event: PointerEvent) => {
  from = event.pointerType === 'mouse' ? undefined : { x: event.clientX, y: event.clientY }
}

const cancelSwipe = () => (from = undefined)

const endSwipe = (event: PointerEvent) => {
  const start = from
  from = undefined
  if (!start) return

  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(dy) * SLOPE) return

  // The gates the transport buttons carry: at the ends of a queue there is
  // nothing to step to, and a swipe shouldn't pretend otherwise.
  if (dx < 0) {
    if (player.canNext) player.next()
  } else if (player.canPrevious) {
    player.previous()
  }
}
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  display: flex;
  position: fixed;
  flex-direction: column;
  gap: design.spacing(4);
  z-index: design.z-index(modal);
  inset: 0;
  background-color: design.color(background);
  // `position: fixed` is measured against the viewport, so the shell's own
  // safe-area padding does nothing for it — installed, this covers the notch
  // and the home indicator itself.
  padding: calc(#{design.spacing(3)} + env(safe-area-inset-top)) design.spacing(4)
    calc(#{design.spacing(6)} + env(safe-area-inset-bottom));

  @include design.screen(md) {
    gap: design.spacing(6);
    padding-inline: max(#{design.spacing(8)}, calc((100vw - #{design.spacing(160)}) / 2));
  }
}

// Three columns with nothing in the third: the label stays centred over the
// screen rather than beside the button that closes it.
.bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  color: design.color(muted-foreground);
}

// A station's name is a sentence, not a word — clipped rather than allowed to
// push the close button off its own row.
.source {
  overflow: hidden;
  max-width: 60vw;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

// Takes whatever height is left, so the cover grows on a tall screen and the
// controls below never get pushed off a short one. A size container because the
// cover needs to know how tall it is — see below.
.stage {
  display: flex;
  container-type: size;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

// A cover is square and has to stay square, so it's sized by whichever of the
// stage's sides is shorter. `height: 100%` alone doesn't do it: `max-width`
// then clamps the width and the aspect ratio loses, which stretched a 600×600
// cover into a 460×501 box and cropped it. `cqh` is how the width asks about
// the height, which is the one question plain CSS can't answer.
.cover {
  width: min(100%, 100cqh);
  height: auto;
  border-radius: design.radius(xl);
  box-shadow: design.shadow(md);
}

.meta {
  display: flex;
  flex-direction: column;
  gap: design.spacing(1);
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.titleLink {
  color: inherit;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.artists {
  color: design.color(muted-foreground);
  font-size: 1rem;
}

// Each name is its own link, so the hover is on the name and not on the line —
// pointing at the second of two has to take you to the second of two.
.artist {
  color: inherit;
  text-decoration: none;

  &:hover {
    color: design.color(foreground);
    text-decoration: underline;
  }
}

// The transport on its own line, the extras under it.
.actions {
  display: grid;
  justify-items: center;
  gap: design.spacing(3);
}

// The extras stay centred on the screen while the volume parks at the right of
// the same line, so it can't shift them off centre.
.row {
  display: flex;
  justify-content: center;
  width: 100%;

  @include design.screen(md) {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
  }
}

.extras {
  @include design.screen(md) {
    grid-column: 2;
  }
}

// Volume is a mouse affordance; a phone has hardware keys for it.
.volume {
  display: none;

  @include design.screen(md) {
    display: flex;
    grid-column: 3;
    justify-self: end;
  }
}

// Transition classes are generated from the `name`, so they can't be hashed —
// the block escapes CSS Modules and the name is prefixed instead.
:global {
  .player-screen-enter-active,
  .player-screen-leave-active {
    transition: transform 0.3s ease;
  }

  .player-screen-enter-from,
  .player-screen-leave-to {
    transform: translateY(100%);
  }
}
</style>

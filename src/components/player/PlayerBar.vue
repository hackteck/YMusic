<template>
  <footer v-if="track" :class="$style.root">
    <!-- Above the bar and the full width of it, at every breakpoint: on a phone
         a line this long is the difference between seeking and not. -->
    <PlayerProgress />

    <div :class="$style.bar">
      <div :class="$style.track">
        <!-- The cover is the full-screen button and the only thing that is:
             the text beside it goes where the text says it goes. -->
        <button
          :class="$style.art"
          type="button"
          title="На весь экран"
          aria-label="На весь экран"
          @click="screen.show()"
        >
          <CoverArt :class="$style.cover" :src="cover" :alt="track.title" kind="track" />
          <span :class="$style.expand" aria-hidden="true">
            <Icon :icon="Maximize2" :size="18" />
          </span>
        </button>

        <span :class="$style.text">
          <span :class="$style.titleLine">
            <component
              :is="album ? RouterLink : 'span'"
              :class="$style.title"
              :to="album ? albumLink(album) : undefined"
            >
              {{ track.title }}
            </component>
            <span v-if="explicit" :class="$style.explicit">E</span>
          </span>

          <!-- A load failure belongs on the track it happened to, not in a
               toast that floats away from it. -->
          <span v-if="player.error" :class="$style.error">{{ player.error }}</span>

          <!-- Clipped, the line ends in an ellipsis and every name after the
               first is unreachable — so the whole of it becomes one button and
               the names are picked from a list instead. Same string, same box:
               what's measured has to lay out the same either way. -->
          <button
            v-else-if="crowded"
            ref="artists"
            :class="[$style.artists, $style.crowded]"
            type="button"
            aria-haspopup="dialog"
            :title="artistNames(track.artists)"
            @click="picking = true"
          >
            {{ artistNames(track.artists) }}
          </button>

          <span v-else ref="artists" :class="$style.artists">
            <template v-for="(artist, index) in track.artists" :key="artist.id">
              <span v-if="index">, </span>
              <RouterLink :class="$style.artist" :to="artistLink(artist)">{{ artist.name }}</RouterLink>
            </template>
          </span>
        </span>
      </div>

      <PlayerControls :class="$style.controls" variant="transport" />

      <!-- The extras sit with the volume rather than around the transport: they
           act on the track, not on playback, and this keeps the middle of the
           bar to the three buttons that do. -->
      <div :class="$style.side">
        <PlayerControls variant="extras" />
        <PlayerVolume />
      </div>
    </div>

    <!-- A dialog rather than a menu, and the bar's own position is the reason:
         Popover shifts but never flips, and it has no `top` side, so anything
         anchored to a footer at the bottom edge opens below the screen. -->
    <Dialog v-model:open="picking" title="Исполнители">
      <ul :class="$style.list">
        <li v-for="artist in track.artists" :key="artist.id">
          <RouterLink :class="$style.option" :to="artistLink(artist)" @click="picking = false">
            {{ artist.name }}
          </RouterLink>
        </li>
      </ul>
    </Dialog>
  </footer>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Dialog } from '@surstromming/dialog'
import { Icon } from '@surstromming/icon'
import { Maximize2 } from 'lucide'
import { coverUrl } from '@/api/cover'
import CoverArt from '@/components/CoverArt.vue'
import { artistNames } from '@/components/media'
import { usePlayerScreen } from '@/composables/usePlayerScreen'
import { useTruncated } from '@/composables/useTruncated'
import { albumLink, artistLink } from '@/router/links'
import { usePlayer } from '@/stores/player'
import PlayerControls from './PlayerControls.vue'
import PlayerProgress from './PlayerProgress.vue'
import PlayerVolume from './PlayerVolume.vue'

const player = usePlayer()
const screen = usePlayerScreen()

// What is audible, not what the queue points at: a track that is still loading
// has nothing to show here yet, and the row that was pressed says so instead.
const track = computed(() => player.nowPlaying)
const album = computed(() => track.value?.albums[0])
const cover = computed(() => coverUrl(track.value?.coverUri, 100))
const explicit = computed(() => track.value?.contentWarning === 'explicit')

const picking = ref(false)

// One name has nothing to pick from — clipped or not, it keeps its link.
const { truncated, measure } = useTruncated(useTemplateRef<HTMLElement>('artists'))
const crowded = computed(() => truncated.value && (track.value?.artists.length ?? 0) > 1)

// The line is re-measured on a track change, since the box it's in doesn't
// move when the names inside it do — nothing else would notice.
watch(track, () => nextTick(measure))
</script>

<style module lang="scss">
@use '@surstromming/design' as design;
@use '@/css/tokens' as app;

// A column so the progress can be the full width of the player: the padding
// lives on the row below it, not on the footer.
.root {
  display: flex;
  flex-direction: column;
  border-top: 1px solid design.color(border);
  background-color: design.color(sidebar);
}

.bar {
  display: flex;
  align-items: center;
  gap: design.spacing(2);
  padding: design.spacing(2) design.spacing(3);

  @include design.screen(md) {
    gap: design.spacing(4);
    padding: design.spacing(2) design.spacing(4) design.spacing(3);
  }
}

.track {
  display: flex;
  flex: 1;
  align-items: center;
  gap: design.spacing(3);
  min-width: 0;

  @include design.screen(md) {
    flex: 0 0 design.spacing(64);
  }
}

// The padding reset is load-bearing: a bare <button> keeps the UA's `1px 6px`,
// which made this box 68×58 around a 56×56 cover — and `.expand` is pinned to
// its edges, so the overlay stuck out either side of the artwork.
.art {
  display: block;
  position: relative;
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0;
  border-radius: design.radius(md);
  cursor: pointer;
}

.cover {
  width: design.spacing(10);

  @include design.screen(md) {
    width: design.spacing(14);
  }
}

// The cover *is* the full-screen button, so it says so when you point at it.
.expand {
  display: flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  inset: 0;
  border-radius: design.radius(md);
  background-color: color-mix(in oklab, black 55%, transparent);
  color: white;
  opacity: 0;
  transition: opacity 0.15s ease;

  // The cover only — reaching for the title shouldn't offer to swallow the
  // screen, now that the title goes somewhere of its own.
  .art:hover &,
  .art:focus-visible & {
    opacity: 1;
  }
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.titleLine {
  display: flex;
  align-items: center;
  gap: design.spacing(1.5);
  min-width: 0;
}

.title,
.artists,
.error {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.title {
  color: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.explicit {
  flex-shrink: 0;
  border-radius: design.radius(sm);
  padding-inline: 0.25rem;
  background-color: design.color(muted-foreground);
  color: design.color(sidebar);
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.3;
}

.artists {
  color: design.color(muted-foreground);
  font-size: 0.75rem;
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

// Only what a bare <button> gets wrong, and deliberately nothing `.artists`
// already says: a shorthand `font` here would out-order its font-size and this
// box has to measure the same as the span of links it stands in for. (The UA's
// own `1px 6px` padding is the other half of that.)
.crowded {
  display: block;
  border: none;
  background: none;
  padding: 0;
  width: 100%;
  font-family: inherit;
  font-weight: inherit;
  line-height: inherit;
  text-align: start;
  cursor: pointer;

  &:hover {
    color: design.color(foreground);
    text-decoration: underline;
  }
}

// `list-style: none` drops the marker but not the 40px the UA reserves for it.
.list {
  list-style: none;
  padding-inline-start: 0;
}

.option {
  display: block;
  border-radius: design.radius(sm);
  padding: design.spacing(2);
  color: inherit;
  text-decoration: none;

  &:hover {
    background-color: design.color(accent);
    color: design.color(accent-foreground);
  }
}

.error {
  color: design.color(destructive);
  font-size: 0.75rem;
}

// Equal side columns would centre the transport, but the track block is fixed
// and the volume is not — pushing from both ends does the same job with one
// fewer wrapper.
.controls {
  @include design.screen(md) {
    flex: 1;
    justify-content: center;
  }
}

// Desktop chrome: the phone's bar is the transport and nothing else, and it has
// hardware keys for the volume.
.side {
  display: none;

  @include design.screen(md) {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: design.spacing(2);
  }
}
</style>

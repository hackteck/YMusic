<template>
  <div :class="classes">
    <div :class="$style.main">
      <!-- The number is a column of its own beside the cover, not instead of
           it: a place in a list and the thing in that place are two facts. -->
      <span v-if="number" :class="$style.rank">
        <span :class="$style.number">{{ number }}</span>
        <span
          v-if="chart"
          :class="[$style.move, $style[`is-${chart.progress}`]]"
          :title="moveLabel"
        />
      </span>

      <!-- The cover is this row's play button, and on the row that is playing
           it is the pause button too — a button of its own rather than part of
           the row's, so pressing the title still means "play this from here". -->
      <button
        :class="$style.art"
        type="button"
        :disabled="!track.available"
        :aria-label="playLabel"
        @click="onCover"
      >
        <CoverArt :src="cover" :alt="track.title" kind="track" />

        <!-- Three states over the artwork, and the order matters: a track being
             fetched says so here, and the bars stay on the row that is still
             audible until this one really starts. -->
        <span v-if="fetching" :class="$style.overlay">
          <Spinner :size="18" />
        </span>
        <span v-else-if="sounding" :class="$style.overlay">
          <PlayingBars />
        </span>
        <span v-else :class="[$style.overlay, $style.play, { [$style.isCurrent]: active }]" aria-hidden="true">
          <Icon :icon="Play" :size="16" />
        </span>
      </button>

      <!-- The two names are links, the way the player's are: a title goes to
           the album the song lives on (there is no track page) and an artist to
           their own. Playing from here is the cover's job, beside them. -->
      <span :class="$style.text">
        <span :class="$style.titleLine">
          <component
            :is="album ? RouterLink : 'span'"
            :class="$style.title"
            :to="album ? albumLink(album) : undefined"
          >
            {{ title }}
          </component>
          <span v-if="explicit" :class="$style.explicit" title="Ненормативная лексика">E</span>
        </span>

        <span :class="$style.artists">
          <template v-for="(artist, index) in track.artists" :key="artist.id">
            <span v-if="index">, </span>
            <RouterLink :class="$style.artist" :to="artistLink(artist)">{{ artist.name }}</RouterLink>
          </template>
        </span>
      </span>
    </div>

    <!-- The chart's own figure, and the only play statistic the API gives out.
         Desktop only: on a phone the row has no width to spare for it. -->
    <span v-if="listeners" :class="$style.listeners" :title="`${listeners} за неделю`">
      {{ listeners }}
    </span>

    <!-- Tagging runs ffmpeg over the whole file, so this is seconds rather than
         instant and has to say so. -->
    <Button
      :class="$style.action"
      variant="ghost"
      size="icon"
      aria-label="Скачать"
      :disabled="downloading"
      @click="download(track)"
    >
      <Spinner v-if="downloading" :size="18" />
      <Icon v-else :icon="Download" :size="18" />
    </Button>

    <Button
      :class="[$style.action, { [$style.isLiked]: liked }]"
      variant="ghost"
      size="icon"
      :aria-label="liked ? 'Убрать из любимых' : 'В любимые'"
      :aria-pressed="liked"
      @click="likes.toggle(track.id)"
    >
      <Icon :icon="Heart" :size="18" />
    </Button>

    <!-- One slot, two controls: the row under the pointer is the only one whose
         menu is reachable, so it takes the duration's place rather than sitting
         beside it. Where there's no hover both stay put. -->
    <span :class="$style.trailing">
      <span :class="$style.duration">{{ formatDuration(track.durationMs) }}</span>

      <DropdownMenu :class="$style.menu" :items="menu" side="bottom" align="end" @select="onSelect">
        <template #trigger="{ toggle }">
          <Button variant="ghost" size="icon" aria-label="Ещё" @click="toggle">
            <Icon :icon="Ellipsis" :size="18" />
          </Button>
        </template>
      </DropdownMenu>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, useCssModule } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Button } from '@surstromming/button'
import { DropdownMenu, type DropdownMenuItem } from '@surstromming/dropdown-menu'
import { Icon } from '@surstromming/icon'
import { Spinner } from '@surstromming/spinner'
import { Disc3, Download, Ellipsis, Heart, Play, Radio, User } from 'lucide'
import { coverUrl } from '@/api/cover'
import { trackWave } from '@/components/wave'
import { albumLink, artistLink } from '@/router/links'
import { useLikes } from '@/stores/likes'
import { usePlayer } from '@/stores/player'
import { useTrackDownload } from '@/composables/useTrackDownload'
import CoverArt from './CoverArt.vue'
import PlayingBars from './PlayingBars.vue'
import { formatCount, formatDuration } from './media'
import type { ChartPosition, Track } from '@/api/types'

const props = defineProps<{
  track: Track
  /** Shown beside the cover, on the lists that rank their rows. */
  number?: number
  /** Only the chart has one; it draws the movement marker under the number. */
  chart?: ChartPosition
  active?: boolean
}>()

const emit = defineEmits<{ play: [] }>()

const router = useRouter()
const player = usePlayer()
const likes = useLikes()
const { download, downloading } = useTrackDownload()

const cover = computed(() => coverUrl(props.track.coverUri, 100))
const title = computed(() =>
  props.track.version ? `${props.track.title} (${props.track.version})` : props.track.title,
)
const explicit = computed(() => props.track.contentWarning === 'explicit')

/** Pressed, and waiting on the bytes: the whole file is fetched and decrypted
 *  before anything can play, and on a cold track that is seconds. */
const fetching = computed(() => props.active && player.loading)

/** Coming out of the speakers *now* — which the track being loaded is not, and
 *  the one before it still is. Only this row gets the bars. */
const sounding = computed(
  () => player.playing && player.nowPlaying?.id === props.track.id,
)

const playLabel = computed(() => {
  if (fetching.value) return 'Загрузка'
  return sounding.value ? 'Пауза' : 'Играть'
})

/** On the row that is already playing the cover pauses it; anywhere else it
 *  starts the list here. A spinner is not a pause button, so a row waiting on
 *  its bytes ignores the press — pausing there would stop the track still
 *  sounding, which is a different one. */
function onCover() {
  if (fetching.value) return
  if (props.active) player.toggle()
  else emit('play')
}

// The marker is a shape with no text of its own, so the movement is only
// readable through this.
const moveLabel = computed(() => {
  const chart = props.chart
  if (!chart) return undefined
  if (chart.progress === 'new') return 'Новинка чарта'
  if (chart.progress === 'same') return 'Без изменений'
  return `${chart.progress === 'up' ? '+' : '−'}${Math.abs(chart.shift)}`
})
const liked = computed(() => likes.has(props.track.id))
const listeners = computed(() =>
  props.chart?.listeners ? formatCount(props.chart.listeners) : undefined,
)

const album = computed(() => props.track.albums[0])

const menu = computed<DropdownMenuItem[]>(() => [
  { label: 'Волна по треку', value: 'wave', icon: Radio },
  { label: 'Скачать', value: 'download', icon: Download },
  ...(album.value ? [{ label: 'К альбому', value: 'album', icon: Disc3 }] : []),
  ...(props.track.artists[0] ? [{ label: 'К исполнителю', value: 'artist', icon: User }] : []),
])

function onSelect(value: string) {
  if (value === 'wave') player.playStation(trackWave(props.track))
  else if (value === 'download') download(props.track)
  else if (value === 'album' && album.value) router.push(albumLink(album.value))
  else if (value === 'artist') router.push(artistLink(props.track.artists[0]))
}

const $style = useCssModule()
const classes = computed(() => [
  $style.root,
  { [$style.isActive]: props.active, [$style.isUnavailable]: !props.track.available },
])
</script>

<style module lang="scss">
@use '@surstromming/design' as design;
@use '@/css/tokens' as app;

$art-size: design.spacing(11);

// Pinned, not merely what the content happens to add up to: TrackList reserves
// the height of every row it hasn't mounted yet from this exact number, and a
// row that drifted would take the scrollbar with it.
.root {
  display: flex;
  align-items: center;
  gap: design.spacing(1);
  height: design.spacing(15);
  border-radius: design.radius(md);
  padding-right: design.spacing(1);

  &:hover {
    background-color: design.color(accent);
  }
}

.isUnavailable {
  opacity: 0.4;
}

// Everything but the trailing controls. Not a button itself — the cover and the
// text inside it are, and a button can't hold another one.
.main {
  display: flex;
  flex: 1;
  align-items: center;
  gap: design.spacing(3);
  min-width: 0;
  padding: design.spacing(2);
}

.rank {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: design.spacing(6);
}

.number {
  color: design.color(muted-foreground);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

// Solid triangles from borders, and a bar for "no change". A stroked lucide
// chevron reads as an affordance at this size and the set has no solid caret —
// the same call ScrollArea's own carets make.
.move {
  width: 0;
  height: 0;
  border-inline: 4px solid transparent;
}

.is-up {
  border-bottom: 5px solid app.color(chart-up);
}

.is-down {
  border-top: 5px solid app.color(chart-down);
}

.is-same {
  width: design.spacing(2.5);
  height: 2px;
  border: none;
  background-color: design.color(muted-foreground);
}

// A new entry has no previous place to have moved from, so it gets a dot rather
// than an arrow — an empty box would leave its tooltip with nothing to hover.
.is-new {
  width: 5px;
  height: 5px;
  border: none;
  border-radius: 50%;
  background-color: app.color(brand);
}

.art {
  display: block;
  position: relative;
  flex-shrink: 0;
  width: $art-size;
  height: $art-size;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;

  &:disabled {
    cursor: default;
  }
}

// Stretched, not start-aligned: the title's ellipsis needs the child to be the
// width of the column rather than the width of the text.
.text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  text-align: left;
}

.titleLine {
  display: flex;
  align-items: center;
  gap: design.spacing(1.5);
  min-width: 0;
}

.title {
  overflow: hidden;
  color: inherit;
  font-size: 0.9375rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  .isActive & {
    color: app.color(brand);
  }
}

// Yandex's own badge, and small enough that a lucide glyph would only blur.
.explicit {
  flex-shrink: 0;
  border-radius: design.radius(sm);
  padding-inline: 0.25rem;
  background-color: design.color(muted-foreground);
  color: design.color(background);
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1.3;
}

.artists {
  overflow: hidden;
  color: design.color(muted-foreground);
  font-size: 0.8125rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.artist {
  color: inherit;
  text-decoration: none;

  &:hover {
    color: design.color(foreground);
    text-decoration: underline;
  }
}

.listeners {
  display: none;

  @include design.screen(md) {
    display: block;
    flex-shrink: 0;
    min-width: design.spacing(20);
    padding-inline: design.spacing(2);
    color: design.color(muted-foreground);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
}

.action {
  flex-shrink: 0;
  color: design.color(muted-foreground);
}

// The one filled glyph in the row, so it reads as a state rather than a button.
.isLiked {
  color: app.color(brand);

  svg {
    fill: currentcolor;
  }
}

.trailing {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-width: design.spacing(14);
}

.duration {
  color: design.color(muted-foreground);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

// Only where a pointer can reveal it. On touch the duration and the menu both
// stay: there is no hover to trade one for the other.
@media (hover: hover) {
  .trailing {
    position: relative;
  }

  .menu {
    display: flex;
    position: absolute;
    align-items: center;
    justify-content: center;
    inset: 0;
    color: design.color(muted-foreground);
    opacity: 0;
  }

  .duration {
    transition: opacity 0.15s ease;
  }

  // `focus-within` so the menu is reachable by keyboard, which never hovers.
  .root:hover,
  .trailing:focus-within {
    .duration {
      opacity: 0;
    }

    .menu {
      opacity: 1;
    }
  }
}

.overlay {
  display: flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  inset: 0;
  border-radius: design.radius(md);
  background-color: color-mix(in oklab, black 55%, transparent);
  color: white;
}

.play {
  opacity: 0;
  transition: opacity 0.15s ease;

  .root:hover & {
    opacity: 1;
  }
}

// The current track, stopped. The bars say "playing", so a paused row says it
// with the glyph that starts it again — in the colour that marks the row as the
// one the player is on, and showing whether or not anything is hovered.
.isCurrent {
  color: app.color(brand);
  opacity: 1;
}

</style>

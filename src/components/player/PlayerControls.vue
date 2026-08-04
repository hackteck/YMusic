<template>
  <div :class="classes">
    <template v-if="variant === 'transport'">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Предыдущий"
        :disabled="!player.canPrevious"
        @click="player.previous"
      >
        <Icon :icon="SkipBack" />
      </Button>

      <Button :class="$style.play" size="icon" :aria-label="playLabel" @click="player.toggle">
        <Spinner v-if="player.loading" />
        <Icon v-else :icon="player.playing ? Pause : Play" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Следующий"
        :disabled="!player.canNext"
        @click="player.next"
      >
        <Icon :icon="SkipForward" />
      </Button>
    </template>

    <template v-else>
      <Button
        :class="{ [$style.isOn]: screen.open.value && screen.view.value === 'lyrics' }"
        variant="ghost"
        size="icon"
        aria-label="Текст песни"
        @click="screen.toggleView('lyrics')"
      >
        <Icon :icon="MicVocal" />
      </Button>

      <Button
        :class="{ [$style.isLiked]: liked }"
        variant="ghost"
        size="icon"
        :aria-label="liked ? 'Убрать из любимых' : 'В любимые'"
        :aria-pressed="liked"
        :disabled="!track"
        @click="track && likes.toggle(track.id)"
      >
        <Icon :icon="Heart" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Скачать"
        :disabled="!track || downloading"
        @click="track && download(track)"
      >
        <Spinner v-if="downloading" />
        <Icon v-else :icon="DownloadIcon" />
      </Button>

      <!-- No lit state, unlike its neighbours: a wave is an action, and the
           moment it starts the current track is a different one, so "this
           track's wave is playing" would be true for one song and then wrong. -->
      <Button
        variant="ghost"
        size="icon"
        aria-label="Волна по треку"
        :disabled="!track"
        @click="track && player.playStation(trackWave(track))"
      >
        <Icon :icon="Radio" />
      </Button>

      <Button
        :class="{ [$style.isOn]: screen.open.value && screen.view.value === 'queue' }"
        variant="ghost"
        size="icon"
        aria-label="Очередь"
        @click="screen.toggleView('queue')"
      >
        <Icon :icon="ListMusic" />
      </Button>

      <Button
        :class="{ [$style.isOn]: player.shuffle }"
        variant="ghost"
        size="icon"
        aria-label="Перемешать"
        @click="player.toggleShuffle"
      >
        <Icon :icon="Shuffle" />
      </Button>

      <Button
        :class="{ [$style.isOn]: player.repeat !== 'off' }"
        variant="ghost"
        size="icon"
        :aria-label="repeatLabel"
        @click="player.cycleRepeat"
      >
        <Icon :icon="player.repeat === 'one' ? Repeat1 : Repeat" />
      </Button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, useCssModule } from 'vue'
import { Button } from '@surstromming/button'
import { Icon } from '@surstromming/icon'
import { Spinner } from '@surstromming/spinner'
import {
  Download as DownloadIcon,
  Heart,
  ListMusic,
  MicVocal,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
} from 'lucide'
import { trackWave } from '@/components/wave'
import { usePlayerScreen } from '@/composables/usePlayerScreen'
import { useTrackDownload } from '@/composables/useTrackDownload'
import { useLikes } from '@/stores/likes'
import { usePlayer } from '@/stores/player'

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'lg'
    /**
     * The player's controls come in two rows that are never mixed: the
     * `transport`, which acts on playback, and the `extras`, which act on the
     * track or on the session. Both the bar and the full-screen player draw
     * them apart — side by side eight controls are 396px of content in a 350px
     * phone, and on a desktop the extras belong beside the volume.
     */
    variant?: 'transport' | 'extras'
  }>(),
  { size: 'sm', variant: 'transport' },
)

const player = usePlayer()
const likes = useLikes()
const screen = usePlayerScreen()
const { download, downloading } = useTrackDownload()

// The extras act on the track the player is showing, so they follow the title
// beside them rather than the queue's pointer — see `nowPlaying`.
const track = computed(() => player.nowPlaying)
const liked = computed(() => !!track.value && likes.has(track.value.id))

const playLabel = computed(() => (player.playing ? 'Пауза' : 'Играть'))
const repeatLabel = computed(() => (player.repeat === 'one' ? 'Повтор трека' : 'Повтор'))

const $style = useCssModule()
const classes = computed(() => [
  $style.root,
  $style[`size-${props.size}`],
  { [$style.extras]: props.variant === 'extras' },
])
</script>

<style module lang="scss">
@use '@surstromming/design' as design;
@use '@/css/tokens' as app;

.root {
  display: flex;
  align-items: center;
  gap: design.spacing(1);
}

// Quieter than the transport: none of these is the thing you came to press.
.extras {
  color: design.color(muted-foreground);
}

// Button pins its icons to 1rem; a player's glyphs have to be bigger than a
// form control's, so the sizes are set here rather than through Icon's prop.
.size-sm svg {
  width: 1.25rem;
  height: 1.25rem;
}

.size-lg {
  gap: design.spacing(3);

  svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .play {
    width: design.spacing(16);
    height: design.spacing(16);

    svg {
      width: 1.75rem;
      height: 1.75rem;
    }
  }
}

// Round, like every transport control — the square corners the system uses for
// form buttons read as a toolbar here.
.play {
  @include app.brand-button;

  border-radius: 9999px;
}

.isOn {
  color: app.color(brand);
}

// The one filled glyph, so it reads as a state and not a button.
.isLiked {
  color: app.color(brand);

  svg {
    fill: currentcolor;
  }
}
</style>

<template>
  <!-- Collapsed on a phone the field is a single icon; tapping it lays the
       field over the header rather than opening a screen of its own, so the
       results below it are the same ones the desktop field drops. -->
  <Button
    v-if="collapsed"
    variant="ghost"
    size="icon"
    aria-label="Поиск"
    @click="expand"
  >
    <Icon :icon="Search" :size="18" />
  </Button>

  <Popover v-else v-model:open="open" :class="rootClasses">
    <template #trigger>
      <div ref="field" :class="$style.field">
        <Icon :class="$style.fieldIcon" :icon="Search" :size="18" />
        <Input
          ref="input"
          v-model="query"
          :class="$style.input"
          type="search"
          placeholder="Треки, артисты, альбомы"
          @focus="open = !!groups.length"
          @blur="onBlur"
          @keydown.enter="showAll"
          @keydown.esc="dismiss"
        />
      </div>
    </template>

    <!-- Sized to the field. The panel is only *floored* at its trigger's width
         and grows with its content, so one long track title stretches it across
         the window. -->
    <div :class="$style.panel" :style="{ width: `${panelWidth}px` }">
      <!-- The spinner is centred by the box, not by itself: the class lands on
           the Spinner's own root, so a flex rule there centres nothing. -->
      <div v-if="loading" :class="$style.note"><Spinner :size="20" /></div>
      <p v-else-if="!groups.length" :class="$style.note">Ничего не нашлось</p>

      <template v-else>
        <!-- Four kinds of thing in one list look alike until they're labelled —
             a name on its own doesn't say whether it's an artist or a playlist. -->
        <section v-for="group in groups" :key="group.label">
          <h2 :class="$style.group">{{ group.label }}</h2>

          <button
            v-for="result in group.results"
            :key="result.item.to"
            :class="$style.result"
            type="button"
            @click="pick(result)"
          >
            <CoverArt
              :class="$style.cover"
              :src="result.item.cover"
              :alt="result.item.title"
              :shape="result.item.shape"
              :kind="result.item.kind"
            />
            <span :class="$style.text">
              <span :class="$style.title">{{ result.item.title }}</span>
              <span :class="$style.subtitle">{{ result.item.subtitle }}</span>
            </span>
          </button>
        </section>

        <button :class="$style.all" type="button" @click="showAll">
          Все результаты по «{{ query.trim() }}»
        </button>
      </template>
    </div>
  </Popover>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useCssModule, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@surstromming/button'
import { Icon } from '@surstromming/icon'
import { Input } from '@surstromming/input'
import { Popover } from '@surstromming/popover'
import { Spinner } from '@surstromming/spinner'
import { isMobile } from '@surstromming/util'
import { Search } from 'lucide'
import { search } from '@/api/catalog'
import { usePlayer } from '@/stores/player'
import CoverArt from './CoverArt.vue'
import { albumItem, artistItem, playlistItem, trackAlbumItem } from './media'
import type { MediaItem } from './media'
import type { Track } from '@/api/types'

/** A row in the panel: navigate to `item.to`, unless it's a track, which plays. */
interface Result {
  item: MediaItem
  track?: Track
}

/** The rows of one kind, under the heading that says which kind that is. */
interface Group {
  label: string
  results: Result[]
}

/** Enough to recognise what you typed, not enough to be a results page. */
const PER_GROUP = 3
const DEBOUNCE = 350

const router = useRouter()
const player = usePlayer()

const query = ref('')
const groups = ref<Group[]>([])
const loading = ref(false)
const open = ref(false)
/** Phone only: the field is laid over the header instead of hidden behind its icon. */
const expanded = ref(false)

const input = useTemplateRef<InstanceType<typeof Input>>('input')
const field = useTemplateRef<HTMLElement>('field')

const collapsed = computed(() => isMobile.value && !expanded.value)

// The panel's own chrome — its border, and the gutter the vertical scrollbar
// parks in — sits outside the width set below, so the content has to give it
// back for the panel's right edge to land on the field's.
const PANEL_CHROME = 20

const panelWidth = ref(0)

let resize: ResizeObserver | undefined
watch(field, (element) => {
  resize?.disconnect()
  if (!element) return
  resize = new ResizeObserver(([entry]) => {
    panelWidth.value = Math.max(entry.contentRect.width - PANEL_CHROME, 0)
  })
  resize.observe(element)
})

const expand = async () => {
  expanded.value = true
  await nextTick()
  input.value?.focus()
}

/** Set while the field is being written by the route rather than by the user. */
let syncing = false

// Debounced, and each run checks it's still the newest — a slow request for an
// earlier prefix must not overwrite the list the user is looking at.
let timer: number | undefined
watch(query, (text) => {
  clearTimeout(timer)

  // Arriving at a result page is the end of a search, not the start of one —
  // the field follows the route there, and that must not drop a panel over it.
  if (syncing) {
    syncing = false
    groups.value = []
    loading.value = false
    open.value = false
    return
  }

  const needle = text.trim()
  if (!needle) {
    groups.value = []
    loading.value = false
    open.value = false
    return
  }
  loading.value = true
  open.value = true
  timer = window.setTimeout(async () => {
    const found = await search(needle)
    if (query.value.trim() !== needle) return
    groups.value = [
      {
        label: 'Исполнители',
        results: (found.artists?.results ?? [])
          .slice(0, PER_GROUP)
          .map((artist) => ({ item: artistItem(artist) })),
      },
      {
        label: 'Треки',
        results: (found.tracks?.results ?? [])
          .slice(0, PER_GROUP)
          .map((track) => ({ item: trackAlbumItem(track), track })),
      },
      {
        label: 'Альбомы',
        results: (found.albums?.results ?? [])
          .slice(0, PER_GROUP)
          .map((album) => ({ item: albumItem(album) })),
      },
      {
        label: 'Плейлисты',
        results: (found.playlists?.results ?? [])
          .slice(0, PER_GROUP)
          .map((playlist) => ({ item: playlistItem(playlist) })),
      },
    ].filter((group) => group.results.length)
    loading.value = false
  }, DEBOUNCE)
})

/** Leaves the query in the field: the page it opened is showing those results. */
const close = () => {
  open.value = false
  expanded.value = false
}

/** Escape backs all the way out — an empty field is how you start over. */
const dismiss = () => {
  query.value = ''
  close()
}

// Leaving the field is what folds it back into its icon on a phone; without it
// it stays parked over the brand with no way out. Not while the panel is open:
// clicking a result blurs the field first, and unmounting it there would eat
// the click. `pick` collapses it a moment later anyway.
const onBlur = () => {
  if (!open.value) expanded.value = false
}

const pick = (result: Result) => {
  close()
  if (result.track) player.play([result.track])
  else router.push(result.item.to)
}

const showAll = () => {
  const needle = query.value.trim()
  if (!needle) return
  close()
  router.push({ path: '/search', query: { q: needle } })
}

// The route is the query's owner — a deep link, the back button and the nav's
// Поиск tab all arrive as a change to `q`, and the field follows it.
watch(
  () => router.currentRoute.value.query.q,
  (q) => {
    const text = typeof q === 'string' ? q : ''
    if (text === query.value.trim()) return
    syncing = true
    query.value = text
  },
  { immediate: true },
)

onUnmounted(() => {
  clearTimeout(timer)
  resize?.disconnect()
})

const $style = useCssModule()
const rootClasses = computed(() => [$style.root, { [$style.isExpanded]: expanded.value }])
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  flex: 1;
  // Off the wordmark and off the account, rather than sharing the header's
  // 8px gap with them.
  margin-inline: design.spacing(4);
  max-width: design.spacing(120);
}

// Phone, field showing: it covers the header rather than squeezing the brand
// and the account into what's left. The header is `position: sticky`, so it is
// the containing block this insets against.
.isExpanded {
  position: absolute;
  inset: design.spacing(2) design.spacing(3);
  margin-inline: 0;
  max-width: none;
  background-color: design.color(background);
}

.panel {
  padding: design.spacing(1.5);
}

.field {
  display: flex;
  position: relative;
  align-items: center;
}

.fieldIcon {
  position: absolute;
  left: design.spacing(3);
  color: design.color(muted-foreground);
  pointer-events: none;
}

// Two classes deep on purpose: Input sets its own padding from a single class,
// and a tie would be settled by whichever stylesheet loaded last.
.field .input {
  flex: 1;
  padding-left: design.spacing(10);
}

// Tall enough that the panel doesn't open as a sliver and then jump to full
// height when the results land.
.note {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: design.spacing(24);
  color: design.color(muted-foreground);
}

// Quiet enough to scan past when you already know what you're looking at.
.group {
  padding: design.spacing(2) design.spacing(2) design.spacing(1);
  color: design.color(muted-foreground);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.result {
  display: flex;
  align-items: center;
  gap: design.spacing(3);
  width: 100%;
  border-radius: design.radius(md);
  padding: design.spacing(2);
  color: inherit;
  text-align: start;
  cursor: pointer;

  &:hover {
    background-color: design.color(accent);
  }
}

.cover {
  flex-shrink: 0;
  width: design.spacing(10);
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.title,
.subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  font-size: 0.875rem;
  font-weight: 500;
}

.subtitle {
  color: design.color(muted-foreground);
  font-size: 0.8125rem;
}

.all {
  width: 100%;
  margin-top: design.spacing(1);
  border-top: 1px solid design.color(border);
  padding: design.spacing(3) design.spacing(2);
  color: design.color(muted-foreground);
  font-size: 0.8125rem;
  text-align: start;
  cursor: pointer;

  &:hover {
    color: design.color(foreground);
  }
}
</style>

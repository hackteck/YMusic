<template>
  <!-- vertical: an unbreakable line wraps or is clipped, it never scrolls sideways. -->
  <ScrollArea orientation="vertical" :class="$style.root">
    <p v-if="loading" :class="$style.note">Загружаем текст…</p>
    <p v-else-if="!lines.length" :class="$style.note">Для этого трека нет текста</p>

    <template v-else>
      <p
        v-for="(line, index) in lines"
        :key="index"
        :ref="(el) => setLineRef(el, index)"
        :class="[$style.line, { [$style.isActive]: index === activeIndex }]"
      >
        {{ line.text }}
      </p>
    </template>
  </ScrollArea>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ScrollArea } from '@surstromming/scroll-area'
import { getLyrics, type LyricLine } from '@/api/lyrics'
import { usePlayer } from '@/stores/player'

const player = usePlayer()

const lines = ref<LyricLine[]>([])
const loading = ref(false)

const lineRefs: (HTMLElement | null)[] = []
const setLineRef = (el: unknown, index: number) => {
  lineRefs[index] = el as HTMLElement | null
}

watch(
  // The song being heard, so the words can't run ahead of it while the next
  // track loads.
  () => player.nowPlaying,
  async (track) => {
    lines.value = []
    if (!track) return
    loading.value = true
    lineRefs.length = 0
    lines.value = await getLyrics(track.id, !!track.lyricsInfo?.hasAvailableSyncLyrics)
    loading.value = false
  },
  { immediate: true },
)

/** The last line whose timestamp has passed; -1 while unsynced or before the first. */
const activeIndex = computed(() => {
  const ms = player.currentTime * 1000
  let active = -1
  lines.value.forEach((line, index) => {
    if (line.time !== undefined && line.time <= ms) active = index
  })
  return active
})

watch(activeIndex, (index) => {
  lineRefs[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  width: 100%;
  height: 100%;
  text-align: center;
}

.note {
  padding-block: design.spacing(8);
  color: design.color(muted-foreground);
}

.line {
  padding-block: design.spacing(1.5);
  color: design.color(muted-foreground);
  font-size: 1.125rem;
  font-weight: 500;
  transition: color 0.2s ease;
}

.isActive {
  color: design.color(foreground);
  font-size: 1.375rem;
}
</style>

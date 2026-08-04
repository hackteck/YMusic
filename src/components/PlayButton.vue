<template>
  <Button :class="$style.root" size="lg" :disabled="pending" @click="start">
    <Spinner v-if="pending" />
    <Icon v-else :icon="Play" />
    {{ label }}
  </Button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@surstromming/button'
import { Icon } from '@surstromming/icon'
import { Spinner } from '@surstromming/spinner'
import { Play } from 'lucide'
import { usePlayer } from '@/stores/player'
import type { Track } from '@/api/types'

/**
 * Exactly one of `tracks` and `load`. A page that already holds its list hands
 * it straight over; one whose list is too big to fetch with the page hands a
 * way to fetch it — the artist page, where "everything they've recorded" is
 * hundreds of tracks nobody has asked for until this is pressed.
 *
 * `playlistId` rides along into the play report; only a playlist has one.
 */
const props = defineProps<{
  tracks?: Track[]
  load?: () => Promise<Track[]>
  playlistId?: string
}>()

const player = usePlayer()

const pending = ref(false)

async function start() {
  if (!props.load) {
    player.play(props.tracks ?? [], 0, props.playlistId)
    return
  }

  pending.value = true
  try {
    player.play(await props.load(), 0, props.playlistId)
  } catch (cause) {
    console.error(cause)
  } finally {
    pending.value = false
  }
}

// Says what it will do: resume this queue, or start it over. A list that only
// exists once it's been fetched can't answer that, so it always offers to start.
const isCurrentQueue = computed(
  () => !!props.tracks?.length && player.queue[0]?.id === props.tracks[0]?.id,
)
const label = computed(() => (isCurrentQueue.value ? 'Слушать снова' : 'Слушать'))
</script>

<style module lang="scss">
@use '@/css/tokens' as app;

.root {
  @include app.brand-button;
}
</style>

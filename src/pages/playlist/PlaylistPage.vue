<template>
  <AppPage>
    <EntityHeader
      label="Плейлист"
      :title="playlist.title"
      :subtitle="playlist.owner?.name"
      :meta="meta"
      :cover="cover"
    >
      <template #actions>
        <PlayButton :tracks="tracks" :playlist-id="playlistId" />
      </template>
    </EntityHeader>

    <!-- Covers, not numbers: a playlist's ordering isn't part of the track the
         way an album's is, and the cover is what you recognise a row by. -->
    <TrackList :tracks="tracks" :playlist-id="playlistId" />
  </AppPage>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getPlaylist } from '@/api/catalog'
import { playlistCoverUrl } from '@/api/cover'
import AppPage from '@/components/AppPage.vue'
import EntityHeader from '@/components/EntityHeader.vue'
import PlayButton from '@/components/PlayButton.vue'
import TrackList from '@/components/TrackList.vue'
import { formatTotal, plural } from '@/components/media'

const route = useRoute()
const playlist = await getPlaylist(route.params.uid as string, route.params.kind as string)

const tracks = computed(() => (playlist.tracks ?? []).map((entry) => entry.track))
const cover = computed(() => playlistCoverUrl(playlist.cover, 600))
// A playlist is identified by the pair, and Yandex writes it with a colon.
const playlistId = `${playlist.uid}:${playlist.kind}`

const meta = computed(() =>
  [
    plural(playlist.trackCount, 'трек', 'трека', 'треков'),
    playlist.durationMs && formatTotal(playlist.durationMs),
  ]
    .filter(Boolean)
    .join(' · '),
)
</script>

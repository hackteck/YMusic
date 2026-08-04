<template>
  <AppPage>
    <EntityHeader
      label="Альбом"
      :title="album.title"
      :subtitle="artistNames(album.artists)"
      :meta="meta"
      :cover="cover"
    >
      <template #actions>
        <PlayButton :tracks="tracks" />
      </template>
    </EntityHeader>

    <TrackList :tracks="tracks" numbered />
  </AppPage>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getAlbum } from '@/api/catalog'
import { coverUrl } from '@/api/cover'
import AppPage from '@/components/AppPage.vue'
import EntityHeader from '@/components/EntityHeader.vue'
import PlayButton from '@/components/PlayButton.vue'
import TrackList from '@/components/TrackList.vue'
import { artistNames, formatTotal, plural } from '@/components/media'

const route = useRoute()
const album = await getAlbum(route.params.id as string)

// `volumes` is one array per disc; the UI plays the album as one queue.
const tracks = computed(() => (album.volumes ?? []).flat())
const cover = computed(() => coverUrl(album.coverUri, 600))

const meta = computed(() => {
  const total = tracks.value.reduce((sum, track) => sum + track.durationMs, 0)
  return [album.year, plural(tracks.value.length, 'трек', 'трека', 'треков'), formatTotal(total)]
    .filter(Boolean)
    .join(' · ')
})
</script>

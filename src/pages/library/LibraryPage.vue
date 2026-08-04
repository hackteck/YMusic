<template>
  <AppPage>
    <h1 :class="$style.title">Моя музыка</h1>

    <Tabs v-model="tab" :tabs="tabs" variant="line">
      <template #tracks>
        <TrackList :tracks="likedTracks" numbered />
      </template>
      <template #playlists>
        <MediaGrid :items="playlists" />
      </template>
      <template #albums>
        <MediaGrid :items="albums" />
      </template>
      <template #artists>
        <MediaGrid :items="artists" />
      </template>
    </Tabs>
  </AppPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Tabs } from '@surstromming/tabs'
import {
  getLikedAlbums,
  getLikedArtists,
  getLikedPlaylists,
  getLikedTracks,
  getUserPlaylists,
} from '@/api/library'
import AppPage from '@/components/AppPage.vue'
import MediaGrid from '@/components/MediaGrid.vue'
import TrackList from '@/components/TrackList.vue'
import { albumItem, artistItem, playlistItem } from '@/components/media'
import { useAuth } from '@/stores/auth'

const uid = useAuth().account!.uid

// One round trip for the whole page; the tabs only switch what's shown.
const [likedTracks, ownPlaylists, likedPlaylists, likedAlbums, likedArtists] = await Promise.all([
  getLikedTracks(uid),
  getUserPlaylists(uid),
  getLikedPlaylists(uid),
  getLikedAlbums(uid),
  getLikedArtists(uid),
])

const playlists = [...ownPlaylists, ...likedPlaylists].map(playlistItem)
const albums = likedAlbums.map(albumItem)
const artists = likedArtists.map(artistItem)

const tabs = [
  { label: `Треки (${likedTracks.length})`, value: 'tracks' },
  { label: `Плейлисты (${playlists.length})`, value: 'playlists' },
  { label: `Альбомы (${albums.length})`, value: 'albums' },
  { label: `Артисты (${artists.length})`, value: 'artists' },
]

const tab = ref('tracks')
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
</style>

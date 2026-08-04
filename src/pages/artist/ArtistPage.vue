<template>
  <AppPage>
    <EntityHeader
      label="Исполнитель"
      :title="artist.name"
      :meta="meta"
      :cover="cover"
      shape="circle"
      kind="artist"
    >
      <template #actions>
        <!-- Everything they've recorded, not the ten "Популярное" shows below.
             Fetched on the press: it's hundreds of tracks, and a visit that
             only browses the albums should pay nothing for them. -->
        <PlayButton :load="loadTracks" />

        <Button
          :class="[$style.action, { [$style.isLiked]: liked }]"
          variant="outline"
          size="icon"
          :aria-label="liked ? 'Убрать из любимых' : 'В любимые'"
          :aria-pressed="liked"
          :disabled="pending"
          @click="toggleLike"
        >
          <Icon :icon="Heart" :size="18" />
        </Button>

        <!-- An endless stream around this artist, not their own tracks — which
             is what "Слушать" beside it already plays. -->
        <Button variant="outline" @click="player.playStation(artistWave(artist))">
          <Icon :icon="Radio" :size="18" />
          Волна по артисту
        </Button>
      </template>
    </EntityHeader>

    <!-- The heading leads to the whole catalogue, the way the similar-artists
         one does: this shelf is the sample, that page is the list. -->
    <ContentSection
      v-if="page.popularTracks.length"
      title="Популярное"
      :to="`${artistLink(artist)}/tracks`"
    >
      <TrackList :tracks="page.popularTracks" numbered />
    </ContentSection>

    <MediaShelf v-if="albums.length" title="Альбомы" :items="albums" />

    <!-- The heading is the way through to the full list now that the header's
         button starts a wave instead: this shelf shows ten of nearer fifty. -->
    <MediaShelf
      v-if="similar.length"
      title="Похожие исполнители"
      :items="similar"
      :to="`${artistLink(artist)}/similar`"
    />
  </AppPage>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@surstromming/button'
import { Icon } from '@surstromming/icon'
import { Heart, Radio } from 'lucide'
import { getArtist, getArtistTracks } from '@/api/catalog'
import { coverUrl } from '@/api/cover'
import { getLikedArtists, likeArtist, unlikeArtist } from '@/api/library'
import AppPage from '@/components/AppPage.vue'
import ContentSection from '@/components/ContentSection.vue'
import EntityHeader from '@/components/EntityHeader.vue'
import MediaShelf from '@/components/MediaShelf.vue'
import PlayButton from '@/components/PlayButton.vue'
import TrackList from '@/components/TrackList.vue'
import { albumItem, artistItem, plural } from '@/components/media'
import { artistWave } from '@/components/wave'
import { artistLink } from '@/router/links'
import { useAuth } from '@/stores/auth'
import { usePlayer } from '@/stores/player'

const route = useRoute()
const player = usePlayer()
const uid = useAuth().account!.uid

const page = await getArtist(route.params.id as string)

const artist = computed(() => page.artist)
const cover = computed(() => coverUrl(artist.value.cover?.uri, 600))
const albums = computed(() => page.albums.map(albumItem))

const loadTracks = async () => (await getArtistTracks(artist.value.id)).tracks
const similar = computed(() => page.similarArtists.map(artistItem))

// Unlike tracks, there is no store for this: an artist heart only ever appears
// on the artist's own page, so one page's worth of state is all it needs. The
// list is small — the whole point of `/likes/artists` — so asking on arrival
// costs one request and keeps the heart right after a like made elsewhere.
const liked = ref(false)
const pending = ref(false)

getLikedArtists(uid)
  .then((artists) => {
    liked.value = artists.some((entry) => String(entry.id) === String(artist.value.id))
  })
  .catch((cause) => console.error(cause))

/**
 * Not optimistic, unlike the track heart. A track is liked from a list of
 * fifty and has to feel instant; this is one button on one page, and it is
 * pressed once — so it says "working" and then says what actually happened.
 */
async function toggleLike() {
  pending.value = true
  const next = !liked.value
  try {
    await (next ? likeArtist(uid, artist.value.id) : unlikeArtist(uid, artist.value.id))
    liked.value = next
  } catch (cause) {
    console.error(cause)
  } finally {
    pending.value = false
  }
}

const meta = computed(() => {
  const counts = artist.value.counts
  if (!counts) return undefined
  return [
    plural(counts.tracks, 'трек', 'трека', 'треков'),
    plural(counts.directAlbums, 'альбом', 'альбома', 'альбомов'),
  ].join(' · ')
})
</script>

<style module lang="scss">
@use '@/css/tokens' as app;

.action {
  flex-shrink: 0;
}

// Filled, the way the track row's is — it reads as a state, not a button.
.isLiked {
  color: app.color(brand);

  svg {
    fill: currentcolor;
  }
}
</style>

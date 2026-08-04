<template>
  <AppPage>
    <h1 v-if="query" :class="$style.heading">Результаты по «{{ query }}»</h1>

    <p v-if="!query" :class="$style.note">Что будем слушать?</p>
    <Spinner v-else-if="loading" :class="$style.note" :size="24" />
    <p v-else-if="!hasResults" :class="$style.note">Ничего не нашлось</p>

    <template v-else>
      <ContentSection v-if="tracks.length" title="Треки">
        <TrackList :tracks="tracks" />
      </ContentSection>

      <ContentSection v-if="artists.length" title="Исполнители">
        <MediaGrid :items="artists" />
      </ContentSection>

      <ContentSection v-if="albums.length" title="Альбомы">
        <MediaGrid :items="albums" />
      </ContentSection>

      <ContentSection v-if="playlists.length" title="Плейлисты">
        <MediaGrid :items="playlists" />
      </ContentSection>
    </template>
  </AppPage>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Spinner } from '@surstromming/spinner'
import { search, type SearchResults } from '@/api/catalog'
import AppPage from '@/components/AppPage.vue'
import ContentSection from '@/components/ContentSection.vue'
import MediaGrid from '@/components/MediaGrid.vue'
import TrackList from '@/components/TrackList.vue'
import { albumItem, artistItem, playlistItem } from '@/components/media'

const route = useRoute()

// The header's field is the only one in the app and it writes `?q=`. Reading it
// back here is what makes a result page linkable and the back button work.
const query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))

const results = ref<SearchResults>({})
const loading = ref(false)

// Capped: the API returns 20, and a full page of them buries the artist,
// album and playlist sections below the fold.
const tracks = computed(() => (results.value.tracks?.results ?? []).slice(0, 10))
const artists = computed(() => (results.value.artists?.results ?? []).map(artistItem))
const albums = computed(() => (results.value.albums?.results ?? []).map(albumItem))
const playlists = computed(() => (results.value.playlists?.results ?? []).map(playlistItem))

const hasResults = computed(
  () => tracks.value.length || artists.value.length || albums.value.length || playlists.value.length,
)

// No debounce here — the header field already has one, so this only runs on a
// query that has settled. It still checks it's the newest: two fast navigations
// must not let the earlier request overwrite the later results.
watch(
  query,
  async (text) => {
    if (!text) {
      results.value = {}
      loading.value = false
      return
    }
    loading.value = true
    const found = await search(text)
    if (query.value !== text) return
    results.value = found
    loading.value = false
  },
  { immediate: true },
)
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.heading {
  font-size: 1.375rem;
  font-weight: 600;
}

.note {
  align-self: center;
  padding-block: design.spacing(10);
  color: design.color(muted-foreground);
}
</style>

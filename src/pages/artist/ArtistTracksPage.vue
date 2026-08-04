<template>
  <AppPage>
    <p :class="$style.back">
      <RouterLink :class="$style.link" :to="artistLink(artist)">← {{ artist.name }}</RouterLink>
    </p>

    <div :class="$style.head">
      <h1 :class="$style.title">Все треки — {{ artist.name }}</h1>
      <PlayButton :tracks="tracks" />
    </div>

    <!-- The list is capped, so where it is the page says so rather than
         calling a thousand of three thousand "все треки". -->
    <p v-if="tracks.length < total" :class="$style.note">
      Показаны первые {{ plural(tracks.length, 'трек', 'трека', 'треков') }} из
      {{ formatCount(total) }}
    </p>

    <TrackList v-if="tracks.length" :tracks="tracks" numbered />
    <p v-else :class="$style.note">Треков не нашлось</p>
  </AppPage>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { getArtist, getArtistTracks } from '@/api/catalog'
import AppPage from '@/components/AppPage.vue'
import PlayButton from '@/components/PlayButton.vue'
import TrackList from '@/components/TrackList.vue'
import { formatCount, plural } from '@/components/media'
import { artistLink } from '@/router/links'

const route = useRoute()
const id = route.params.id as string

// Both at once: neither answers the other's question, and one after the other
// is two round trips before the page can draw anything.
const [brief, list] = await Promise.all([getArtist(id), getArtistTracks(id)])

const artist = brief.artist
const { tracks, total } = list
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.back {
  font-size: 0.875rem;
}

.link {
  color: design.color(muted-foreground);
  text-decoration: none;

  &:hover {
    color: design.color(foreground);
  }
}

// The button sits beside the title where there's room for it and drops under
// it where there isn't — a phone has neither the width nor a header to hang it
// off, the way the artist page's own does.
.head {
  display: flex;
  flex-direction: column;
  gap: design.spacing(3);

  @include design.screen(md) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.note {
  color: design.color(muted-foreground);
  font-size: 0.875rem;
}
</style>

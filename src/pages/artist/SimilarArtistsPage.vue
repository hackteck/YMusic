<template>
  <AppPage>
    <p :class="$style.back">
      <RouterLink :class="$style.link" :to="artistLink(artist)">← {{ artist.name }}</RouterLink>
    </p>

    <h1 :class="$style.title">Похожие на {{ artist.name }}</h1>

    <MediaGrid v-if="similar.length" :items="similar" />
    <p v-else :class="$style.note">Похожих исполнителей не нашлось</p>
  </AppPage>
</template>

<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { getSimilarArtists } from '@/api/catalog'
import AppPage from '@/components/AppPage.vue'
import MediaGrid from '@/components/MediaGrid.vue'
import { artistItem } from '@/components/media'
import { artistLink } from '@/router/links'

const route = useRoute()

// `/artists/<id>/similar`, not the ten the brief-info shelf shows — this page
// exists because that shelf is a sample and this is the list.
const { artist, similarArtists } = await getSimilarArtists(route.params.id as string)

const similar = similarArtists.map(artistItem)
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

.title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.note {
  color: design.color(muted-foreground);
}
</style>

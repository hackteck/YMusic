<template>
  <AppPage>
    <h1 :class="$style.title">{{ collection.title }}</h1>

    <MediaGrid v-if="items.length" :items="items" />
    <p v-else :class="$style.note">Здесь пока пусто</p>
  </AppPage>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { COLLECTIONS, getCollection, type CollectionKey } from '@/api/landing'
import AppPage from '@/components/AppPage.vue'
import MediaGrid from '@/components/MediaGrid.vue'
import { mixedItem } from '@/components/media'

const route = useRoute()

// One page for both blocks: they differ only in which entities come back, and
// the card grid renders either. The route is validated rather than trusted —
// `/collection/anything` would otherwise ask Yandex for a block that isn't one.
const key = route.params.key as CollectionKey
const collection = key in COLLECTIONS ? await getCollection(key) : { title: '', items: [] }

const items = collection.items.map(mixedItem)
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.note {
  color: design.color(muted-foreground);
}
</style>

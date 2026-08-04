<template>
  <AppPage>
    <h1 :class="$style.greeting">{{ greeting }}</h1>

    <!-- The waves come first: on a page whose point is "put something on", the
         one control that needs no decision belongs above everything else. -->
    <StationShelf title="Моя волна" :stations="stations" />

    <MediaShelf v-if="picks.length" title="Собираем для вас" :items="picks" />

    <ContentSection title="Чарт">
      <Tabs v-model="tab" :tabs="tabs" variant="line">
        <template #russia>
          <TrackList :class="$style.list" :tracks="russia.tracks" :chart="russia.positions" numbered />
        </template>

        <template #world>
          <!-- Tabs unmount the chart that was showing before this one arrives,
               and a spinner is six thousand pixels shorter than the list it
               stands in for: the scroller clamps and throws the reader to the
               top of the page. Holding the height keeps them where they were. -->
          <div v-if="!world" :class="$style.list" :style="{ height: `${pending}px` }">
            <PageLoader />
          </div>
          <TrackList
            v-else
            :class="$style.list"
            :tracks="world.tracks"
            :chart="world.positions"
            numbered
          />
        </template>
      </Tabs>
    </ContentSection>
  </AppPage>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Tabs } from '@surstromming/tabs'
import { getChart, getFeed, type Chart as ChartData } from '@/api/landing'
import { getDashboard } from '@/api/rotor'
import AppPage from '@/components/AppPage.vue'
import ContentSection from '@/components/ContentSection.vue'
import MediaShelf from '@/components/MediaShelf.vue'
import PageLoader from '@/components/PageLoader.vue'
import StationShelf from '@/components/StationShelf.vue'
import TrackList, { ROW_HEIGHT } from '@/components/TrackList.vue'
import { collectionItem, playlistItem } from '@/components/media'
import { useAuth } from '@/stores/auth'

const auth = useAuth()

// Only what the page opens on. The world chart is another ~300 KB and isn't on
// screen until its tab is, so it's fetched the first time that happens, below.
const [stations, feed, russia] = await Promise.all([
  getDashboard(),
  getFeed(),
  getChart('russia'),
])

// The four playlists picked for this account, then one card each for the two
// standing lists — twenty loose cards behind them buried the four.
const picks = [...feed.personal.map(playlistItem), ...feed.collections.map(collectionItem)]

const tabs = [
  { label: 'Россия', value: 'russia' },
  { label: 'Мир', value: 'world' },
]
const tab = ref('russia')

const world = ref<ChartData>()

// Both charts are a hundred tracks, so the list already on the page is the
// right size for the one still coming.
const pending = russia.tracks.length * ROW_HEIGHT

watch(tab, async (value) => {
  if (value === 'world' && !world.value) world.value = await getChart('world')
})

const greetings = [
  [5, 'Доброй ночи'],
  [12, 'Доброе утро'],
  [18, 'Добрый день'],
  [24, 'Добрый вечер'],
] as const

const greeting = computed(() => {
  const hour = new Date().getHours()
  const [, text] = greetings.find(([until]) => hour < until) ?? greetings[3]
  return `${text}, ${auth.account?.displayName ?? ''}`.trim()
})
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.greeting {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.list {
  margin-top: design.spacing(4);
}
</style>

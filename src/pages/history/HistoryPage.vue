<template>
  <AppPage>
    <h1 :class="$style.title">История</h1>

    <ContentSection v-if="chart.points.length" :title="`Прослушивания по ${stepName}`">
      <Chart
        type="line"
        :data="chart.points"
        :series="[{ key: 'plays', label: 'Прослушивания' }]"
        x-key="label"
        :height="200"
      />
    </ContentSection>

    <Tabs v-model="tab" :tabs="tabs" variant="line">
      <template #tracks>
        <TrackList v-if="tracks.length" :class="$style.list" :tracks="tracks" />
        <p v-else :class="$style.note">
          Пока пусто. Треки появляются здесь после того, как вы дослушаете их.
        </p>
      </template>

      <template #albums>
        <MediaGrid v-if="albums.length" :class="$style.list" :items="albums" />
        <p v-else :class="$style.note">
          Пока пусто. Альбом попадает сюда, когда вы слушаете его целиком или трек из него.
        </p>
      </template>
    </Tabs>
  </AppPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Chart } from '@surstromming/chart'
import { Tabs } from '@surstromming/tabs'
import { getListenHistory } from '@/api/history'
import AppPage from '@/components/AppPage.vue'
import ContentSection from '@/components/ContentSection.vue'
import MediaGrid from '@/components/MediaGrid.vue'
import TrackList from '@/components/TrackList.vue'
import { albumItem } from '@/components/media'
import { useAuth } from '@/stores/auth'
import { listenChart } from './stats'

const uid = useAuth().account!.uid

// One request for the page: the chart, the tracks and the albums are three
// views of the same hundred plays.
const history = await getListenHistory(uid)

const tracks = history.listens.map((listen) => listen.track)
const albums = history.albums.map((listen) => albumItem(listen.album))

const chart = listenChart(history.listens)
const stepName = chart.step === 'week' ? 'неделям' : 'дням'

const tabs = [
  { label: `Треки (${tracks.length})`, value: 'tracks' },
  { label: `Альбомы (${albums.length})`, value: 'albums' },
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

.list {
  margin-top: design.spacing(4);
}

.note {
  padding-block: design.spacing(8);
  color: design.color(muted-foreground);
}
</style>

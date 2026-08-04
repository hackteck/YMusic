<template>
  <AppPage>
    <h1 :class="$style.title">Радио</h1>

    <!-- The user's own, "Моя волна" first — the reason most people open this
         page at all, so it sits above the browsing and never behind a tab. -->
    <StationShelf title="Ваши волны" :stations="dashboard" />

    <ContentSection title="Все станции">
      <Tabs v-model="tab" :tabs="tabs" variant="line">
        <template v-for="group in groups" :key="group.value" #[group.value]>
          <StationGrid :class="$style.grid" :stations="group.stations" />
        </template>
      </Tabs>
    </ContentSection>
  </AppPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Tabs } from '@surstromming/tabs'
import { getDashboard, getStations } from '@/api/rotor'
import AppPage from '@/components/AppPage.vue'
import ContentSection from '@/components/ContentSection.vue'
import StationGrid from '@/components/StationGrid.vue'
import StationShelf from '@/components/StationShelf.vue'
import { groupStations } from './groups'

// One round trip for the page; the tabs only switch what's shown. The full
// list is ~2 MB, which is why nothing but this page asks for it.
const [dashboard, all] = await Promise.all([getDashboard(), getStations()])

const groups = groupStations(all)
const tabs = groups.map((group) => ({ label: group.label, value: group.value }))
const tab = ref(tabs[0]?.value ?? '')
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.grid {
  margin-top: design.spacing(4);
}
</style>

<template>
  <!-- Login owns the whole viewport; everything else lives in the shell. -->
  <RouterView v-if="isPublic" />

  <template v-else>
    <AppHeader />

    <!-- The page is keyed by path so navigating between two albums remounts it:
         fresh data, and its ScrollArea starts at the top. The comment lives out
         here rather than inside `Suspense`, whose default slot has to be a
         *single* root — and a comment is a vnode of its own in dev, which makes
         it two and drops the whole branch into a fragment. -->
    <RouterView v-slot="{ Component }">
      <!-- `v-if="Component"`, because the slot hands out `undefined` until the
           route's lazy chunk has resolved. `<component :is="undefined">` renders
           a *comment*, and Suspense's single-root check skips comments — so the
           slot counts as no roots at all, which is what it warns about. -->
      <Suspense v-if="Component" :timeout="0">
        <component :is="Component" :key="route.fullPath" />
        <template #fallback>
          <PageLoader />
        </template>
      </Suspense>
    </RouterView>

    <PlayerBar />
    <PlayerScreen />
    <AppNav />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppNav from '@/components/AppNav.vue'
import PageLoader from '@/components/PageLoader.vue'
import PlayerBar from '@/components/player/PlayerBar.vue'
import PlayerScreen from '@/components/player/PlayerScreen.vue'

const route = useRoute()
const isPublic = computed(() => route.meta.public === true)
</script>

<style lang="scss">
@use '@/css/shell';
@include shell.shell;
</style>

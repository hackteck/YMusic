<template>
  <main :class="$style.root">
    <Spinner :size="28" />
  </main>
</template>

<script setup lang="ts">
import { Spinner } from '@surstromming/spinner'
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  display: flex;
  align-items: center;
  justify-content: center;
  color: design.color(muted-foreground);
}
</style>

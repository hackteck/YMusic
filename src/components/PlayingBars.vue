<template>
  <span :class="$style.root" aria-hidden="true">
    <i v-for="bar in 3" :key="bar" />
  </span>
</template>

<script setup lang="ts">
/** Three bouncing bars: the one thing in the app that means "this, right now". */
</script>

<style module lang="scss">
@use '@/css/tokens' as app;

.root {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 60%;

  i {
    width: 3px;
    height: 100%;
    border-radius: 2px;
    background-color: app.color(brand);
    animation: bounce 0.9s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.15s;
    }

    &:nth-child(3) {
      animation-delay: 0.3s;
    }
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: scaleY(0.35);
  }

  50% {
    transform: scaleY(1);
  }
}
</style>

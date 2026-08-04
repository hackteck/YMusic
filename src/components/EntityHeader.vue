<template>
  <header :class="$style.root">
    <CoverArt :class="$style.cover" :src="cover" :alt="title" :shape="shape" :kind="kind" />

    <div :class="$style.text">
      <span :class="$style.kind">{{ label }}</span>
      <h1 :class="$style.title">{{ title }}</h1>
      <p v-if="subtitle" :class="$style.subtitle">{{ subtitle }}</p>
      <p v-if="meta" :class="$style.meta">{{ meta }}</p>

      <div :class="$style.actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import CoverArt from './CoverArt.vue'

withDefaults(
  defineProps<{
    label: string
    title: string
    subtitle?: string
    /** The small grey line: year, track count, total time. */
    meta?: string
    cover?: string
    shape?: 'square' | 'circle'
    kind?: 'track' | 'album' | 'artist'
  }>(),
  { shape: 'square', kind: 'album' },
)
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

// Stacked and centred on a phone, side by side once there's room.
.root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: design.spacing(4);
  text-align: center;

  @include design.screen(md) {
    flex-direction: row;
    align-items: flex-end;
    gap: design.spacing(6);
    text-align: left;
  }
}

.cover {
  width: design.spacing(44);
  max-width: 60%;
  box-shadow: design.shadow(md);

  @include design.screen(md) {
    width: design.spacing(56);
    max-width: none;
  }
}

.text {
  display: flex;
  flex-direction: column;
  gap: design.spacing(2);
  align-items: center;
  min-width: 0;

  @include design.screen(md) {
    align-items: flex-start;
  }
}

.kind {
  color: design.color(muted-foreground);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;

  @include design.screen(md) {
    font-size: 3rem;
  }
}

.subtitle {
  font-size: 1rem;
}

.meta {
  color: design.color(muted-foreground);
  font-size: 0.875rem;
}

.actions {
  display: flex;
  gap: design.spacing(2);
  margin-top: design.spacing(2);
}
</style>

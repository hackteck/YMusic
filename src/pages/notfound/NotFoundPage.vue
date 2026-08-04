<template>
  <AppPage>
    <div :class="$style.root">
      <Icon :class="$style.icon" :icon="Disc3" :size="48" />
      <h1 :class="$style.title">Здесь ничего нет</h1>
      <p :class="$style.text">Страница не найдена — вернитесь на главную и слушайте дальше.</p>
      <Button @click="router.push('/')">На главную</Button>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@surstromming/button'
import { Icon } from '@surstromming/icon'
import { Disc3 } from 'lucide'
import AppPage from '@/components/AppPage.vue'

const router = useRouter()
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.root {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: design.spacing(3);
  padding-block: design.spacing(20);
  text-align: center;
}

.icon {
  color: design.color(muted-foreground);
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
}

.text {
  color: design.color(muted-foreground);
}
</style>

<template>
  <AppPage>
    <h1 :class="$style.title">Настройки</h1>

    <section :class="$style.group">
      <h2 :class="$style.heading">Прослушивания</h2>

      <Label :class="$style.option" for="history">
        <Checkbox id="history" v-model="checked" />
        <span :class="$style.text">
          <span :class="$style.name">Сохранять историю прослушиваний</span>
          <span :class="$style.hint">
            Дослушанные треки попадают в историю Яндекс Музыки и влияют на рекомендации —
            на «Мою волну», «Плейлист дня» и «Вы недавно слушали». Из неё же собрана
            страница «История».
          </span>
        </span>
      </Label>
    </section>

    <!-- An alertdialog, not a dialog: this is a decision, and a click outside
         that quietly left the setting half-changed would be worse than asking. -->
    <Dialog
      v-model:open="confirming"
      role="alertdialog"
      title="Отключить историю прослушиваний?"
      description="Треки перестанут попадать в историю Яндекс Музыки, а рекомендации — «Моя волна», «Плейлист дня», «Вы недавно слушали» — перестанут учитывать, что вы слушаете. Страница «История» тоже перестанет пополняться. Уже собранные данные останутся."
    >
      <template #footer>
        <Button variant="outline" @click="confirming = false">Оставить включённой</Button>
        <Button variant="destructive" @click="disable">Отключить</Button>
      </template>
    </Dialog>
  </AppPage>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@surstromming/button'
import { Checkbox } from '@surstromming/checkbox'
import { Dialog } from '@surstromming/dialog'
import { Label } from '@surstromming/label'
import AppPage from '@/components/AppPage.vue'
import { useSettings } from '@/composables/useSettings'

const { historyEnabled, setHistory } = useSettings()

/**
 * The box has state of its own rather than reading the setting directly, and it
 * has to: `Checkbox` wraps a real `<input>`, so a click flips the DOM before
 * anything here gets a say. Bound straight to the setting, cancelling the
 * dialog left the box drawn unchecked with the setting still on — the value
 * never changed, so Vue had nothing to patch back.
 */
const checked = ref(historyEnabled.value)
const confirming = ref(false)

// Turning it back on needs no ceremony; only switching it off is worth asking
// about, so that is the only direction that opens the dialog.
watch(checked, (value) => {
  if (value) setHistory(true)
  else confirming.value = true
})

// However the dialog ended, the box has to end up telling the truth again.
watch(confirming, (open) => {
  if (!open) checked.value = historyEnabled.value
})

function disable() {
  setHistory(false)
  confirming.value = false
}
</script>

<style module lang="scss">
@use '@surstromming/design' as design;

.title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.group {
  display: flex;
  flex-direction: column;
  gap: design.spacing(4);
  max-width: design.spacing(160);
}

.heading {
  font-size: 1.125rem;
  font-weight: 600;
}

// Aligned to the top: the hint below runs to three lines on a phone, and a
// centred box would float beside the middle of it.
.option {
  display: flex;
  align-items: flex-start;
  gap: design.spacing(3);
  cursor: pointer;
}

.text {
  display: flex;
  flex-direction: column;
  gap: design.spacing(1);
}

.name {
  font-size: 0.9375rem;
  font-weight: 500;
}

.hint {
  color: design.color(muted-foreground);
  font-size: 0.8125rem;
  line-height: 1.5;
}
</style>

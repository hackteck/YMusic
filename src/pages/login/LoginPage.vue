<template>
  <main :class="$style.root">
    <div :class="$style.card">
      <div :class="$style.brand">
        <Icon :class="$style.brandMark" :icon="AudioLines" :size="28" />
        <h1 :class="$style.brandName">YMusic</h1>
      </div>
      <p :class="$style.lead">Войдите с аккаунтом Яндекса, чтобы слушать свою музыку.</p>

      <!-- Step 2: the code is live — the user confirms it on Yandex's page. -->
      <template v-if="device">
        <p :class="$style.step">1. Скопируйте код</p>
        <!-- The whole box copies, because picking eight monospaced characters out
             of a phone's text selection is the worst part of this screen. -->
        <button type="button" :class="$style.code" :aria-label="`Скопировать код ${device.user_code}`" @click="copy">
          <span :class="$style.codeText">{{ device.user_code }}</span>
          <Icon :class="$style.codeIcon" :icon="copied ? Check : Copy" :size="20" />
        </button>
        <p :class="$style.hint">{{ copied ? 'Код скопирован' : 'Нажмите, чтобы скопировать' }}</p>

        <p :class="$style.step">2. Введите его на странице Яндекса</p>
        <Button :class="$style.action" size="lg" @click="openYandex">
          Открыть Яндекс
          <Icon :icon="ExternalLink" />
        </Button>
        <p :class="$style.hint">
          <Spinner :size="14" /> Ждём подтверждения…
        </p>
        <Button variant="ghost" size="sm" @click="reset">Начать заново</Button>
      </template>

      <template v-else>
        <Button :class="$style.action" size="lg" :disabled="busy" @click="startDeviceFlow">
          Войти через Яндекс
        </Button>

        <details :class="$style.manual">
          <summary :class="$style.summary">У меня уже есть токен</summary>
          <form :class="$style.form" @submit.prevent="signIn">
            <Input v-model="manualToken" type="password" placeholder="y0_Ag..." />
            <Button type="submit" variant="outline" :disabled="!manualToken || busy">Войти</Button>
          </form>
        </details>
      </template>

      <p v-if="error" :class="$style.error">{{ error }}</p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@surstromming/button'
import { Icon } from '@surstromming/icon'
import { Input } from '@surstromming/input'
import { Spinner } from '@surstromming/spinner'
import { AudioLines, Check, Copy, ExternalLink } from 'lucide'
import { pollForToken, requestDeviceCode, type DeviceCode } from '@/api/auth'
import { useAuth } from '@/stores/auth'

const router = useRouter()
const auth = useAuth()

const device = ref<DeviceCode>()
const manualToken = ref('')
const busy = ref(false)
const copied = ref(false)
const error = ref('')

let poller: number | undefined
let copiedTimer: number | undefined
/**
 * The tab Yandex is confirmed in. Kept so the flow can close it once the token
 * lands — which is why it's `window.open` and not an `<a target="_blank">`, and
 * why `noopener` is deliberately absent: it would null this handle. The cost is
 * that Yandex's own OAuth page gets a `window.opener`; nothing else does.
 */
let yandexTab: Window | null = null

onUnmounted(() => {
  clearInterval(poller)
  clearTimeout(copiedTimer)
})

const enter = async (token: string) => {
  await auth.signIn(token)
  router.push('/')
}

/**
 * Deprecated, and tried first anyway: it copies inside the click with nothing to
 * ask anyone for, where `navigator.clipboard` needs a permission it can be
 * refused. A throwaway off-screen field rather than the code element itself — a
 * selection inside a `<button>` is not something every browser allows.
 */
function execCopy(text: string) {
  const field = document.createElement('textarea')
  field.value = text
  // Read-only, or iOS opens its keyboard for a field nobody types in.
  field.readOnly = true
  // Off screen and fixed, so giving it the selection can't scroll the page.
  field.style.cssText = 'position:fixed;left:-9999px'
  document.body.append(field)
  field.select()
  field.setSelectionRange(0, text.length) // iOS ignores `select()` on its own.
  const done = document.execCommand('copy')
  field.remove()
  return done
}

async function copy() {
  if (!device.value) return
  const code = device.value.user_code
  if (!execCopy(code)) {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // Both refused, so say nothing and leave the code selectable —
      // `user-select: all` means one long press takes the whole of it.
      return
    }
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copied.value = false), 2000)
}

/** Called straight from the click, so a popup blocker has no reason to stop it. */
function openYandex() {
  if (device.value) yandexTab = window.open(device.value.verification_url, '_blank')
}

function reset() {
  clearInterval(poller)
  device.value = undefined
  copied.value = false
  error.value = ''
}

async function startDeviceFlow() {
  busy.value = true
  error.value = ''
  try {
    device.value = await requestDeviceCode()
    poller = window.setInterval(poll, device.value.interval * 1000)
  } catch {
    error.value = 'Не удалось получить код. Проверьте, что прокси доступен.'
  } finally {
    busy.value = false
  }
}

async function poll() {
  if (!device.value) return
  const { access_token, error: reason } = await pollForToken(device.value.device_code)
  if (access_token) {
    clearInterval(poller)
    // A window this page opened is a window it may close, cross-origin or not.
    yandexTab?.close()
    return enter(access_token)
  }
  // Anything but "not confirmed yet" ends the attempt.
  if (reason && reason !== 'authorization_pending') {
    clearInterval(poller)
    device.value = undefined
    error.value = 'Код не подтверждён. Попробуйте ещё раз.'
  }
}

async function signIn() {
  busy.value = true
  error.value = ''
  try {
    await enter(manualToken.value)
  } catch {
    error.value = 'Токен не принят'
  } finally {
    busy.value = false
  }
}
</script>

<style module lang="scss">
@use '@surstromming/design' as design;
@use '@/css/tokens' as app;

.root {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: design.spacing(6);
}

.card {
  display: flex;
  flex-direction: column;
  gap: design.spacing(4);
  width: 100%;
  max-width: design.spacing(96);
  text-align: center;
}

.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: design.spacing(2);
}

.brandMark {
  color: app.color(brand);
}

.brandName {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.lead {
  color: design.color(muted-foreground);
}

.action {
  @include app.brand-button;
}

.step {
  font-size: 0.875rem;
  font-weight: 600;
  text-align: start;
}

// The whole point of the screen while it's showing — big, spaced, and one tap.
.code {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: design.spacing(3);
  cursor: pointer;
  border: 1px solid design.color(border);
  border-radius: design.radius(lg);
  background-color: design.color(card);
  // The UA's own `1px 6px` survives the reset, which drops only border and
  // background.
  padding: design.spacing(4);
  width: 100%;

  &:hover {
    border-color: design.color(ring);
  }
}

.codeText {
  font-family: design.font(mono);
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  // The fallback for a refused clipboard: a long press takes the code whole
  // rather than a character at a time. Prefixed too — nothing autoprefixes here
  // and Safari only dropped the `-webkit-` in 17.
  -webkit-user-select: all;
  user-select: all;
}

.codeIcon {
  color: design.color(muted-foreground);
}

.hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: design.spacing(2);
  color: design.color(muted-foreground);
  font-size: 0.875rem;
}

.manual {
  color: design.color(muted-foreground);
  font-size: 0.875rem;
  text-align: left;
}

.summary {
  cursor: pointer;
  text-align: center;
}

// Stacked, not side by side: the card is 384px and a password field sharing a
// row with a button leaves neither enough of it on a phone.
.form {
  display: flex;
  flex-direction: column;
  gap: design.spacing(2);
  margin-top: design.spacing(3);
}

.error {
  color: design.color(destructive);
  font-size: 0.875rem;
}
</style>

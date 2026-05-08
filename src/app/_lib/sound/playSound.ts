/**
 * playSound.ts — Web Audio API 「ポン」 sound for Garden v2.8a
 *
 * 仕様:
 *   - localStorage キー `garden.sound` で ON/OFF 永続化（default: false ＝ off）
 *   - prefers-reduced-motion: reduce で強制 OFF
 *   - SSR safe: 全関数で typeof window チェック
 *   - prototype index.html v2.8a の playPon() ロジックをそのまま移植
 *     (sine wave 680Hz → 340Hz, lowpass 2200Hz, attack 12ms / release 220ms)
 */

const STORAGE_KEY = "garden.sound";

let audioContext: AudioContext | null = null;

/** SSR-safe な reduced-motion 判定 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** AudioContext を遅延生成（user gesture 後に呼ぶ前提） */
function ensureAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return null;
      audioContext = new Ctx();
    } catch {
      return null;
    }
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {
      /* ignore */
    });
  }
  return audioContext;
}

/** 音 ON/OFF を取得（localStorage 永続化） */
export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** 音 ON/OFF を設定（localStorage 永続化） */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * 「ポン」 音を再生
 * @param volume 音量 (0.0 - 1.0、default 0.10)
 */
export function playPon(volume: number = 0.1): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  if (!getSoundEnabled()) return;

  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = "sine";
  osc.frequency.setValueAtTime(680, now);
  osc.frequency.exponentialRampToValueAtTime(340, now + 0.18);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2200, now);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.22);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * 1度だけ AudioContext を resume するヘルパ
 * (autoplay policy 対策、user gesture 内で呼ぶ)
 */
export function unlockAudio(): void {
  ensureAudioContext();
}

import type { KeySound } from '@tecleo/shared';

export type KeyKind = 'correct' | 'error' | 'space';

/**
 * Sonidos de tecla sintetizados con Web Audio (sin archivos). El contexto de audio se crea con
 * la primera pulsación, porque los navegadores solo lo permiten tras un gesto del usuario.
 */
let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.08), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Ruido blanco determinista: no hace falta aleatoriedad criptográfica para un clic.
  let seed = 1;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  noise = buffer;
  return buffer;
}

function envelope(ctx: AudioContext, peak: number, decay: number): GainNode {
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
  gain.connect(ctx.destination);
  return gain;
}

function burst(ctx: AudioContext, frequency: number, peak: number, decay: number) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = 1.4;
  source.connect(filter).connect(envelope(ctx, peak, decay));
  source.start();
  source.stop(ctx.currentTime + decay + 0.01);
}

function tone(
  ctx: AudioContext,
  type: OscillatorType,
  frequency: number,
  peak: number,
  decay: number,
) {
  const oscillator = ctx.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(envelope(ctx, peak, decay));
  oscillator.start();
  oscillator.stop(ctx.currentTime + decay + 0.01);
}

export function playKeySound(style: KeySound, volume: number, kind: KeyKind): void {
  if (style === 'off' || volume <= 0) return;
  const ctx = audio();
  if (!ctx) return;
  const error = kind === 'error';
  switch (style) {
    case 'click':
      burst(ctx, error ? 900 : kind === 'space' ? 1600 : 2600, 0.5 * volume, 0.03);
      break;
    case 'soft':
      tone(ctx, 'sine', error ? 240 : kind === 'space' ? 420 : 560, 0.18 * volume, 0.06);
      break;
    case 'typewriter':
      burst(ctx, error ? 1100 : 1900, 0.55 * volume, 0.035);
      tone(
        ctx,
        'triangle',
        kind === 'space' ? 85 : 140,
        0.35 * volume,
        kind === 'space' ? 0.09 : 0.04,
      );
      break;
  }
}

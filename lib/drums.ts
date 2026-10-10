"use client";

/**
 * The four drum sounds, synthesized with oscillators and one shared noise buffer. Each connects to
 * the shared master gain from lib/audio — never to `destination` — and stays silent (without
 * throwing) when the context is not running yet.
 *
 * `when` is an `AudioContext.currentTime` value: the sequencer schedules ahead on the audio clock,
 * so a hit lands exactly on its step even when the timer that scheduled it was late.
 */

import { getAudioContext, getMasterGain } from "@/lib/audio";
import type { DrumId } from "@/lib/patterns";

let noise: AudioBuffer | null = null;
let noiseFor: AudioContext | null = null;

/** One second of white noise, made once per context. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noiseFor === ctx) return noise;
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buffer;
  noiseFor = ctx;
  return buffer;
}

/** A filtered noise burst with a gain envelope: the body of the snare, hat and clap. */
function noiseBurst(ctx: AudioContext, when: number, duration: number, peak: number, filter: BiquadFilterNode, envelope: GainNode): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;
  source.connect(filter).connect(envelope);
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.exponentialRampToValueAtTime(peak, when + 0.002);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  source.start(when);
  source.stop(when + duration + 0.02);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    envelope.disconnect();
  };
}

/**
 * One drum hit at time `when`. Returns false when it could not be played (no context, or sound
 * not unlocked yet) — the caller decides whether that is worth saying in text.
 */
export function playDrum(id: DrumId, when: number): boolean {
  const ctx = getAudioContext();
  const out = getMasterGain();
  if (!ctx || !out || ctx.state !== "running") return false;

  if (id === "kick") {
    // A low thump: the pitch drops two octaves while the envelope fades.
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(0.9, when + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
    osc.connect(envelope).connect(out);
    osc.start(when);
    osc.stop(when + 0.42);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
    };
    return true;
  }

  if (id === "snare") {
    // Noise for the crack, plus a short tonal body underneath it.
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.8;
    const burst = ctx.createGain();
    noiseBurst(ctx, when, 0.2, 0.55, filter, burst);
    burst.connect(out);
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(185, when);
    body.frequency.exponentialRampToValueAtTime(130, when + 0.1);
    bodyGain.gain.setValueAtTime(0.0001, when);
    bodyGain.gain.exponentialRampToValueAtTime(0.35, when + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    body.connect(bodyGain).connect(out);
    body.start(when);
    body.stop(when + 0.14);
    body.onended = () => {
      body.disconnect();
      bodyGain.disconnect();
    };
    return true;
  }

  if (id === "hat") {
    // A short tick: high-passed noise, gone in forty milliseconds.
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7500;
    const envelope = ctx.createGain();
    noiseBurst(ctx, when, 0.045, 0.3, filter, envelope);
    envelope.connect(out);
    return true;
  }

  // Clap: two quick bursts a few milliseconds apart, with a short tail after the second.
  for (const [offset, peak, duration] of [
    [0, 0.4, 0.03],
    [0.016, 0.5, 0.14],
  ] as const) {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1100;
    filter.Q.value = 1.2;
    const envelope = ctx.createGain();
    noiseBurst(ctx, when + offset, duration, peak, filter, envelope);
    envelope.connect(out);
  }
  return true;
}
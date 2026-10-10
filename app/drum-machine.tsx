"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { identity } from "@/app/identity";
import { getAudioContext, unlockAudio, useAudioStatus } from "@/lib/audio";
import { playDrum } from "@/lib/drums";
import { renderPatternCard } from "@/lib/pattern-card";
import {
  DEFAULT_PATTERN,
  INSTRUMENTS,
  PRESETS,
  STEPS,
  loadMachineState,
  patternHitCount,
  randomPattern,
  saveMachineState,
  type DrumId,
  type Mutes,
  type Pattern,
} from "@/lib/patterns";
import { cn } from "@/lib/utils";

const defaultMutes: Mutes = { kick: false, snare: false, hat: false, clap: false };

function clonePattern(pattern: Pattern): Pattern {
  return {
    kick: [...pattern.kick],
    snare: [...pattern.snare],
    hat: [...pattern.hat],
    clap: [...pattern.clap],
  };
}

function slugify(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "pocket-beat";
}

export function DrumMachine() {
  const [name, setName] = useState("My Beat");
  const [bpm, setBpm] = useState(120);
  const [pattern, setPattern] = useState<Pattern>(() => clonePattern(DEFAULT_PATTERN));
  const [mutes, setMutes] = useState<Mutes>(defaultMutes);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [chosenPreset, setChosenPreset] = useState("");
  const [undoable, setUndoable] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const bpmRef = useRef(bpm);
  const patternRef = useRef(pattern);
  const mutesRef = useRef(mutes);
  const beforeClear = useRef<Pattern | null>(null);

  const status = useAudioStatus();

  // The scheduler reads these through refs, so tempo, edits and mutes take effect mid-loop
  // without restarting playback.
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);
  useEffect(() => {
    mutesRef.current = mutes;
  }, [mutes]);

  // Saved state is read after mount, never during render, so the first client render matches the
  // server's. Unreadable or missing storage falls through to the defaults.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const saved = loadMachineState();
      if (!saved) return;
      setName(saved.name);
      setBpm(saved.bpm);
      setPattern(saved.pattern);
      setMutes(saved.mutes);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    saveMachineState({ name, bpm, pattern, mutes });
  }, [name, bpm, pattern, mutes]);

  // The sequencer: a 25 ms timer schedules each step at its exact time on the audio clock, and a
  // frame loop reveals the playhead as the scheduled time arrives. An empty grid plays silence
  // while the playhead still runs.
  useEffect(() => {
    if (!playing) return;
    const ctx = getAudioContext();
    if (!ctx) {
      setPlaying(false);
      return;
    }
    let step = 0;
    let nextTime = ctx.currentTime + 0.06;
    const pending: { step: number; time: number }[] = [];

    const timer = window.setInterval(() => {
      const secondsPerStep = 60 / bpmRef.current / 4;
      while (nextTime < ctx.currentTime + 0.15) {
        for (const instrument of INSTRUMENTS) {
          if (patternRef.current[instrument.id][step] && !mutesRef.current[instrument.id]) {
            playDrum(instrument.id, nextTime);
          }
        }
        pending.push({ step, time: nextTime });
        nextTime += secondsPerStep;
        step = (step + 1) % STEPS;
      }
    }, 25);

    let shown = -1;
    let announced = -1;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      while (pending.length && pending[0].time <= ctx.currentTime) {
        shown = pending.shift()!.step;
      }
      if (shown >= 0 && shown !== announced) {
        announced = shown;
        setCurrentStep(shown);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, [playing]);

  const startPlayback = async () => {
    setProblem(null);
    const unlocked = await unlockAudio();
    if (unlocked === "unsupported") return;
    if (unlocked !== "running") {
      setProblem("Sound could not start. Press Play again.");
      return;
    }
    setPlaying(true);
  };

  const stopPlayback = () => {
    setPlaying(false);
    setCurrentStep(null);
  };

  const toggleStep = (id: DrumId, step: number) => {
    const next = clonePattern(pattern);
    next[id][step] = !next[id][step];
    setPattern(next);
    setChosenPreset("");
  };

  const toggleMute = (id: DrumId) => {
    setMutes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadPreset = (presetName: string) => {
    const preset = PRESETS.find((item) => item.name === presetName);
    if (!preset) return;
    setPattern(clonePattern(preset.pattern));
    setChosenPreset(preset.name);
    setUndoable(false);
    beforeClear.current = null;
  };

  const randomise = () => {
    setPattern(randomPattern());
    setChosenPreset("");
    setUndoable(false);
    beforeClear.current = null;
  };

  const clearPattern = () => {
    beforeClear.current = pattern;
    setPattern(clonePattern(DEFAULT_PATTERN).map(() => new Array<boolean>(STEPS).fill(false)) as unknown as Pattern);
    setChosenPreset("");
    setUndoable(true);
  };

  const undoClear = () => {
    if (!beforeClear.current) return;
    setPattern(beforeClear.current);
    beforeClear.current = null;
    setUndoable(false);
  };

  const makeImage = useCallback(() => renderPatternCard({ name, bpm, pattern }), [name, bpm, pattern]);
  const shareKey = `${name}|${bpm}|${INSTRUMENTS.map((instrument) => pattern[instrument.id].map((on) => (on ? 1 : 0)).join("")).join("")}`;

  const mutedList = INSTRUMENTS.filter((instrument) => mutes[instrument.id]).map((instrument) => instrument.label);
  const soundText =
    status === "running"
      ? "Sound on"
      : status === "unsupported"
        ? "Sound is not available in this browser"
        : status === "suspended"
          ? "Sound paused — press Play to resume"
          : "Sound off — press Play to turn it on";

  return (
    <div className="space-y-5">
      <section aria-label="Transport" className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button size="lg" onClick={playing ? stopPlayback : () => void startPlayback()} className="min-w-28">
            {playing ? "Stop" : "Play"}
          </Button>
          <div className="text-sm">
            <p aria-live="polite">{playing ? `Playing — step ${currentStep === null ? 1 : currentStep + 1} of ${STEPS}` : "Stopped"}</p>
            <p className="text-muted-foreground">{soundText}</p>
          </div>
        </div>
        {problem && <p className="text-sm text-destructive">{problem}</p>}

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="tempo">Tempo</Label>
            <span className="text-sm font-medium tabular-nums">{bpm} BPM</span>
          </div>
          <Slider
            id="tempo"
            min={60}
            max={200}
            step={1}
            value={[bpm]}
            onValueChange={(values) => setBpm(values[0] ?? bpm)}
            aria-label="Tempo in beats per minute"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pattern-name">Pattern name</Label>
          <Input
            id="pattern-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            placeholder="My Beat"
            autoComplete="off"
          />
        </div>
      </section>

      <section aria-label="Step grid" className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Tap a step to toggle it. Tab moves between steps; Enter or Space toggles. Muted: {mutedList.length ? mutedList.join(", ") : "none"}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <div className="hidden sm:block sm:w-24 sm:shrink-0" />
          <div className="grid flex-1 grid-cols-16 gap-1">
            {Array.from({ length: STEPS }, (_, step) => (
              <div key={step} className={cn("text-center text-[10px] text-muted-foreground", step % 4 === 3 && "mr-2")}>
                {step % 4 === 0 ? step / 4 + 1 : "·"}
              </div>
            ))}
          </div>
        </div>

        {INSTRUMENTS.map((instrument) => {
          const muted = mutes[instrument.id];
          return (
            <div key={instrument.id} className={cn("flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3", muted && "opacity-50")}>
              <div className="flex items-center justify-between gap-2 sm:w-24 sm:shrink-0 sm:justify-start">
                <span className="text-sm font-medium">{instrument.label}</span>
                <Button
                  size="sm"
                  variant={muted ? "secondary" : "outline"}
                  aria-pressed={muted}
                  onClick={() => toggleMute(instrument.id)}
                  className="h-8 px-2"
                >
                  {muted ? "Muted" : "Mute"}
                </Button>
              </div>
              <div role="group" aria-label={`${instrument.label} steps`} className="grid flex-1 grid-cols-16 gap-1">
                {pattern[instrument.id].map((on, step) => (
                  <button
                    key={step}
                    type="button"
                    aria-label={`${instrument.label} step ${step + 1}`}
                    aria-pressed={on}
                    onClick={() => toggleStep(instrument.id, step)}
                    className={cn(
                      "h-9 rounded-md border transition-colors sm:h-10",
                      "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary hover:bg-accent",
                      currentStep === step && "ring-2 ring-ring",
                      step % 4 === 3 && "mr-2",
                    )}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section aria-label="Pattern actions" className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={randomise}>
            Randomise
          </Button>
          <Button variant="destructive" onClick={clearPattern}>
            Clear Pattern
          </Button>
          {undoable && (
            <Button variant="outline" onClick={undoClear}>
              Undo clear
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="preset">Presets</Label>
          <Select value={chosenPreset} onValueChange={loadPreset}>
            <SelectTrigger id="preset" className="w-full">
              <SelectValue placeholder="Choose a preset" />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((preset) => (
                <SelectItem key={preset.name} value={preset.name}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {chosenPreset ? `${chosenPreset} loaded — ${patternHitCount(pattern)} steps on.` : "Custom pattern — pick a preset to start from a named beat."}
          </p>
        </div>

        <ShareButton
          label="Share pattern"
          title={name.trim() || "My beat"}
          text={`${name.trim() || "My beat"} — ${bpm} BPM on ${identity.name}`}
          filename={`${slugify(name)}.png`}
          makeImage={makeImage}
          cacheKey={shareKey}
        />
      </section>
    </div>
  );
}
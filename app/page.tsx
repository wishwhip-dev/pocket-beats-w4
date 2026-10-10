import { DrumMachine } from "./drum-machine";

/**
 * The drum machine. A server component so the heading renders before any script runs; the
 * interactive machine is the client island below it.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-3 py-6 sm:px-6 sm:py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pocket Beats</h1>
        <p className="text-muted-foreground">
          A 16-step drum machine for kick, snare, hat and clap. Tap out a beat, press Play, and share the pattern.
        </p>
      </header>
      <DrumMachine />
    </main>
  );
}
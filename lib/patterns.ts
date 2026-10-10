/**
 * The drum machine's data: what a pattern is, the beat it starts with, the named presets, a
 * randomiser that stays musical, and the small saved state in localStorage.
 *
 * The pattern is four rows of 16 boolean steps. Everything here is plain data so it can be stored,
 * drawn onto the share card and checked on load without touching the DOM.
 */

export const STEPS = 16;

export type DrumId = "kick" | "snare" | "hat" | "clap";

export type Instrument = { id: DrumId; label: string };

export const INSTRUMENTS: readonly Instrument[] = [
  { id: "kick", label: "Kick" },
  { id: "snare", label: "Snare" },
  { id: "hat", label: "Hat" },
  { id: "clap", label: "Clap" },
];

export type Pattern = Record<DrumId, boolean[]>;

export type Mutes = Record<DrumId, boolean>;

export type MachineState = {
  name: string;
  bpm: number;
  pattern: Pattern;
  mutes: Mutes;
};

/** Steps (0–15) on for one row, in a readable shape for the presets below. */
function row(steps: number[]): boolean[] {
  const cells = new Array<boolean>(STEPS).fill(false);
  for (const step of steps) if (step >= 0 && step < STEPS) cells[step] = true;
  return cells;
}

function emptyPattern(): Pattern {
  return {
    kick: row([]),
    snare: row([]),
    hat: row([]),
    clap: row([]),
  };
}

/** The pattern on first load: a house-style beat every row takes part in. */
export const DEFAULT_PATTERN: Pattern = {
  kick: row([0, 4, 8, 12]),
  snare: row([4, 12]),
  hat: row([0, 2, 4, 6, 8, 10, 12, 14]),
  clap: row([4, 12]),
};

export type Preset = { name: string; pattern: Pattern };

export const PRESETS: readonly Preset[] = [
  {
    name: "Four on the Floor",
    pattern: {
      kick: row([0, 4, 8, 12]),
      snare: row([]),
      hat: row([2, 6, 10, 14]),
      clap: row([4, 12]),
    },
  },
  {
    name: "Boom Bap",
    pattern: {
      kick: row([0, 6, 8, 10]),
      snare: row([4, 12]),
      hat: row([0, 2, 4, 6, 8, 10, 12, 14]),
      clap: row([]),
    },
  },
  {
    name: "Trap",
    pattern: {
      kick: row([0, 7, 10]),
      snare: row([8]),
      hat: row([0, 2, 3, 4, 6, 8, 10, 11, 12, 14, 15]),
      clap: row([8]),
    },
  },
  {
    name: "Disco",
    pattern: {
      kick: row([0, 8]),
      snare: row([4, 12]),
      hat: row([0, 2, 4, 6, 8, 10, 12, 14]),
      clap: row([4, 12]),
    },
  },
  {
    name: "Funk",
    pattern: {
      kick: row([0, 3, 6, 10]),
      snare: row([4, 12]),
      hat: row([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
      clap: row([]),
    },
  },
  {
    name: "Rock",
    pattern: {
      kick: row([0, 8, 10]),
      snare: row([4, 12]),
      hat: row([0, 2, 4, 6, 8, 10, 12, 14]),
      clap: row([]),
    },
  },
  {
    name: "Breakbeat",
    pattern: {
      kick: row([0, 10]),
      snare: row([4, 12, 14]),
      hat: row([0, 2, 4, 6, 8, 10, 12, 14]),
      clap: row([]),
    },
  },
  {
    name: "Dembow",
    pattern: {
      kick: row([0, 4, 8, 12]),
      snare: row([3, 6, 11, 14]),
      hat: row([0, 2, 4, 6, 8, 10, 12, 14]),
      clap: row([]),
    },
  },
];

/**
 * Fill a musically plausible beat: a kick that lands on the downbeat and favours the strong
 * positions, a snare backbeat on 2 and 4, and a hat that keeps time in one of three feels.
 */
export function randomPattern(): Pattern {
  const pick = (chance: number) => Math.random() < chance;
  const pattern = emptyPattern();

  pattern.kick[0] = true;
  pattern.kick[8] = pick(0.6);
  pattern.kick[4] = pick(0.3);
  pattern.kick[12] = pick(0.3);
  for (const step of [2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15]) {
    if (pick(0.12)) pattern.kick[step] = true;
  }
  if (!pattern.kick.some(Boolean)) pattern.kick[0] = true;

  pattern.snare[4] = true;
  pattern.snare[12] = true;
  if (pick(0.3)) pattern.snare[pick(0.5) ? 7 : 14] = true;

  const hatFeel = Math.random();
  if (hatFeel < 0.5) {
    for (let step = 0; step < STEPS; step += 2) pattern.hat[step] = true;
  } else if (hatFeel < 0.8) {
    pattern.hat.fill(true);
  } else {
    for (let step = 2; step < STEPS; step += 4) pattern.hat[step] = true;
  }
  if (pick(0.4)) pattern.hat[Math.floor(Math.random() * STEPS)] = true;

  if (pick(0.45)) {
    pattern.clap[4] = true;
    pattern.clap[12] = true;
  }
  if (pick(0.2)) pattern.clap[Math.floor(Math.random() * STEPS)] = true;

  return pattern;
}

const STORAGE_KEY = "pocket-beats:v1";

function isPattern(value: unknown): value is Pattern {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return INSTRUMENTS.every(
    (instrument) =>
      Array.isArray(candidate[instrument.id]) &&
      (candidate[instrument.id] as unknown[]).length === STEPS &&
      (candidate[instrument.id] as unknown[]).every((cell) => typeof cell === "boolean"),
  );
}

/**
 * The saved state, or null when there is none, storage is unavailable, or the value is unreadable
 * or malformed. Never throws: a broken save falls back to the defaults.
 */
export function loadMachineState(): MachineState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    if (!isPattern(candidate.pattern)) return null;
    const bpm = typeof candidate.bpm === "number" && Number.isFinite(candidate.bpm) ? candidate.bpm : 120;
    return {
      name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : "My Beat",
      bpm: Math.min(200, Math.max(60, Math.round(bpm))),
      pattern: candidate.pattern,
      mutes: {
        kick: candidate.mutes === true || (typeof candidate.mutes === "object" && candidate.mutes !== null && (candidate.mutes as Record<string, unknown>).kick === true),
        snare: typeof candidate.mutes === "object" && candidate.mutes !== null && (candidate.mutes as Record<string, unknown>).snare === true,
        hat: typeof candidate.mutes === "object" && candidate.mutes !== null && (candidate.mutes as Record<string, unknown>).hat === true,
        clap: typeof candidate.mutes === "object" && candidate.mutes !== null && (candidate.mutes as Record<string, unknown>).clap === true,
      },
    };
  } catch {
    return null;
  }
}

/** Save the current state; silently does nothing when storage is unavailable or refuses the write. */
export function saveMachineState(state: MachineState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be full, disabled or absent. The app works without it; nothing to report.
  }
}

export function patternHitCount(pattern: Pattern): number {
  return INSTRUMENTS.reduce((sum, instrument) => sum + pattern[instrument.id].filter(Boolean).length, 0);
}

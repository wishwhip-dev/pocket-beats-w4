"use client";

/**
 * The share image: the pattern drawn as a portrait story-sized card, with its name, the tempo and
 * the grid itself. The grid is the part a text card cannot show, so this draws it directly and
 * borrows the text wrapping from lib/share so a long pattern name still fits.
 *
 * Client-only: called from an event handler path (the share button's makeImage), never during
 * render.
 */

import { identity } from "@/app/identity";
import { INSTRUMENTS, STEPS, type Pattern } from "@/lib/patterns";
import { cardSize, wrapText } from "@/lib/share";

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const BACKGROUND = "#0b0c0e";
const FOREGROUND = "#ededf0";
const MUTED = "#9a9aa5";
const CELL_OFF = "#1b1d22";
const CELL_OFF_EDGE = "#2a2d33";
const FALLBACK_ACCENT = "#a9d977";

function themeAccent(): string {
  if (typeof document === "undefined") return FALLBACK_ACCENT;
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content?.trim() || FALLBACK_ACCENT;
}

export type PatternCardOptions = {
  name: string;
  bpm: number;
  pattern: Pattern;
};

/** Draw the card and return it as a PNG Blob. Rejects with a message fit for the screen. */
export async function renderPatternCard(options: PatternCardOptions): Promise<Blob> {
  const { width, height } = cardSize("story");
  const accent = themeAccent();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw a share image.");

  const padding = 88;
  const band = 28;
  const safeTop = 250;
  const safeBottom = 340;

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, band);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  // The pattern name, large, wrapped to the card.
  ctx.font = `800 96px ${FONT}`;
  const titleLines = wrapText(options.name.trim() || "Untitled beat", (text) => ctx.measureText(text).width, width - padding * 2, 2);
  let y = safeTop;
  for (const line of titleLines) {
    ctx.fillStyle = FOREGROUND;
    ctx.fillText(line, padding, y);
    y += 106;
  }
  y += 8;

  // Tempo and how full the pattern is, as the facts under the name.
  const hits = INSTRUMENTS.reduce((sum, instrument) => sum + options.pattern[instrument.id].filter(Boolean).length, 0);
  ctx.font = `500 46px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(`${options.bpm} BPM · ${hits} steps on`, padding, y);
  y += 110;

  // The grid: four labelled rows of sixteen steps.
  const labelWidth = 168;
  const groupGap = 20;
  const cellGap = 10;
  const gridWidth = width - padding * 2 - labelWidth - groupGap * 3;
  const cell = Math.floor((gridWidth - cellGap * (STEPS - 4)) / STEPS);
  const cellHeight = Math.round(cell * 1.35);
  const rowGap = 26;
  const radius = Math.round(cell * 0.22);

  const roundCell = (x: number, cellY: number, w: number, h: number, fill: string, stroke?: string) => {
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, cellY, w, h, radius);
    else ctx.rect(x, cellY, w, h);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };

  for (const [rowIndex, instrument] of INSTRUMENTS.entries()) {
    const rowY = y + rowIndex * (cellHeight + rowGap);
    ctx.font = `600 40px ${FONT}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(instrument.label, padding, rowY + Math.round((cellHeight - 40) / 2));
    for (let step = 0; step < STEPS; step++) {
      const x = padding + labelWidth + groupGap * Math.floor(step / 4) + step * (cell + cellGap);
      const on = options.pattern[instrument.id][step];
      if (on) {
        roundCell(x, rowY, cell, cellHeight, accent);
      } else {
        roundCell(x, rowY, cell, cellHeight, CELL_OFF, CELL_OFF_EDGE);
      }
      // Beat starts get a small mark so the grid reads like sixteen steps, not one long strip.
      if (step % 4 === 0 && !on) {
        ctx.fillStyle = CELL_OFF_EDGE;
        ctx.fillRect(x, rowY + cellHeight + 8, cell, 6);
      }
    }
  }

  // The app's name at the bottom, kept clear of where Stories put their own buttons.
  const footerTop = height - safeBottom - 20;
  const mark = 48;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(padding, footerTop, mark, mark, 10);
  ctx.fill();
  ctx.font = `600 40px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(identity.name, padding + mark + 24, footerTop + 4);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The share image could not be made."))), "image/png");
  });
}
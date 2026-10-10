# Plan

Goal: A tiny drum machine. A 4x16 step grid for kick, snare, hat and clap; press Play to hear the loop at a tempo I can change; tap steps to toggle them; a Share button that makes an image of my pattern with its name so I can post it to Stories.

1. The home page shows a 4-row by 16-column step grid with rows labelled Kick, Snare, Hat and Clap, and a starting pattern already filled in (a recognisable beat across all four rows) so it is visible and playable on first load, reachable directly by URL with no sign-in or parameters
2. Tapping any cell toggles that step on or off immediately with a clear on/off appearance, and a change made while the loop is playing takes effect on the next pass without stopping or restarting playback; every cell is reachable and toggleable from the keyboard (Tab to move, Enter or Space to toggle)
3. Pressing Play starts the loop and audibly plays the enabled steps in time on a repeating 16-step cycle; the button label switches to Stop and stops playback when pressed again; the sound on/off state is shown as text on the page; with an empty grid, Play still runs the playhead silently instead of failing or freezing
4. The four instruments are distinct synthesized drum sounds through the shared AudioContext in lib/audio.ts — a low thump for kick, a noise burst with body for snare, a short tick for hat and a doubled burst for clap — each recognisably different when heard alone
5. While playing, the current column is highlighted as the playhead moves across the grid in step with the audio, and the current step number (1–16) is also rendered as text outside the grid
6. A tempo slider changes the loop speed between 60 and 200 BPM, takes effect without stopping playback, stays in time at both extremes, and the current BPM value is displayed beside it
7. Each instrument row has its own mute control that silences that one drum during playback while the loop keeps running, with the muted rows shown as text or a visible dimmed state
8. An editable pattern name input holds a name (a default is supplied on first load) that appears on the share image
9. Pressing Share renders the current pattern as a portrait story-sized image showing the grid pattern, the pattern name and the tempo drawn on it, then shares, saves or copies it with the outcome shown as text; the button uses the shipped share components rather than a hand-rolled navigator.share call
10. Clear Pattern empties the grid (labelled as destructive), Randomise fills a musically plausible pattern, and 8 named built-in presets (such as Four on the Floor, Boom Bap, Trap, Disco) are selectable from a list, each loading a different audible beat
11. The current pattern, name, tempo and mute states are saved to localStorage under a key named for this app and are still there after reloading the page; if storage is unavailable or the saved value is unreadable, the defaults are used and nothing errors
12. On a phone-sized screen the 16 columns stay readable and tappable, with the transport controls (Play, tempo, name, Share) laid out so everything is reachable without horizontal scrolling past the grid
13. The app name, description and colour in app/identity.ts are rewritten to describe the drum machine, so the page title matches the product

These are the outcomes this task is judged against.
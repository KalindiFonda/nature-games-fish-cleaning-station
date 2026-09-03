# Nibble — Reef Cleaning Station

An interactive, procedural low-poly simulation of a coral reef cleaning station. You guide a cleaner fish — a juvenile Spanish Hogfish or a Sharknose Goby — as it picks parasites off a rotating cast of "client" fish: Nassau Grouper, Queen Parrotfish, Yellowtail Goatfish, Queen Triggerfish, Atlantic Trumpetfish, Spotted Moray, Whitespotted Filefish, and a school of French Grunts.

A collaboration between Nature Venture and Internet of Elephants. Developed by Gautam Shah and Kalindi Fonda.

## Why this exists

This project is an experiment: a try to see if **games as content** can work — whether a small, self-contained interactive game can stand on its own as a piece of content people engage with, the way an article or a video would.

## How to play

- **Move the mouse** over the water to guide your cleaner fish. Click either cleaner to switch between them.
- **Brush parasites** to eat them. Get close to a gill flap and it lifts so you can check behind it. Big-mouthed clients (grouper, moray, grunts) open up when you come to their mouth, but only for so long — watch for the warning flutter and back off before they chomp.
- **Click a waiting client** to invite it to the station. Your cleaner turns toward it and sways; the client flutters its fins and swims over. Whoever was at the station goes back to the queue if there is room.
- If nothing is at the station for a few seconds, the client that has waited longest comes over on its own.
- Each client at the station has a **patience timer**: 10 seconds from when it parks, plus 3 seconds for every parasite you eat. When it runs out the client swims off. Click the client's name in the top-right card to read a short field note; the timer pauses while you read.
- Waiting clients have their own patience (about 35 to 70 seconds depending on species) and drift off if ignored. A client that leaves half-cleaned comes back half-cleaned next time.
- Fully clean a client and it stays put, sparkling, for a couple of seconds before leaving — and you unlock a new field note in the notebook at the bottom left.
- The **Sound** button picks between Off, Spa (ambient pads and reef sounds) and Carwash (a funk groove).

## Running locally

Prerequisites: Node.js

```sh
npm install
npm run dev
```

Then open http://localhost:3000.

Other scripts:

```sh
npm run build     # production build
npm run preview   # preview the production build
npm run lint      # type-check with tsc (strict)
```

Note: the project was scaffolded in Google AI Studio, so `.env.example` mentions a `GEMINI_API_KEY` — the simulation itself doesn't call the Gemini API, so no key is needed to run it.

## Code layout

- `src/data/species.ts` — one registry of everything per client species: display copy, field note, patience, gape, station position, flap colors. Add a species here and in `ClientDirector`'s factory.
- `src/simulation/ClientDirector.ts` — runs the queue and the station: spawning, invitations, auto-calling, patience, the gill-flap and mouth "delicate zone" mechanics, departures.
- `src/simulation/ClientFishBase.ts` and the eight species classes — canvas-drawn client fish. Each class owns its parasite layout, anatomy spots and render code; the base owns parasite eating and stats.
- `src/simulation/CleanerFishBase.ts`, `SpanishHogfish.ts`, `SharknoseGoby.ts` — the two playable cleaners: spine physics, pointer following, autonomous cleaning behaviour and the invitation sway live in the base; each species keeps its tuning and art.
- `src/simulation/targeting.ts` — which parasites the autonomous cleaners go for.
- `src/components/FishCanvas.tsx` — the render loop and the bridge between the simulation and React.
- `src/render/` — effects (ripples, bubbles, bursts), the gill-flap overlay, cleaned-client sparkles, client drawing order.
- `src/components/ControlsOverlay.tsx`, `FieldNoteCard.tsx` — the UI overlay, notebook and sound menu.
- `src/utils/audio.ts` — all sound is synthesized with Web Audio; there are no audio files.
- `dev-preview.html` + `src/dev/preview.ts` — a dev-only page that draws the moray and the grunt school at a fixed pose, handy for checking art with a screenshot. Not part of the build.

## Tech

- React 19 + TypeScript (strict), built with Vite
- Canvas-based procedural animation
- Tailwind CSS 4 and `motion` for the UI overlay

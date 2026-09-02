# Fish Cleaning Game — Reef Cleaning Station

An interactive, procedural low-poly simulation of a coral reef cleaning station. You guide a cleaner fish — a Cleaner Wrasse or a Sharknose Goby — as it picks parasites off a rotating cast of "client" fish: Coral Grouper, Queen Parrotfish, Yellowtail Goatfish, Queen Triggerfish, Atlantic Trumpetfish, Spotted Moray, Whitespotted Filefish, and French Grunt.

## Why this exists

This project is an experiment: a try to see if **games as content** can work — whether a small, self-contained interactive game can stand on its own as a piece of content people engage with, the way an article or a video would.

## How to play

- **Drag the water** to guide your cleaner fish toward the client.
- **Click a cleaner fish** to switch between the Cleaner Wrasse and the Sharknose Goby.
- Clean parasites from the client's body and teeth; an info panel shows the current client's species, size, and key features, and a **Next fish** button brings in the next client.

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
npm run lint      # type-check with tsc
```

Note: the project was scaffolded in Google AI Studio, so `.env.example` mentions a `GEMINI_API_KEY` — the simulation itself doesn't call the Gemini API, so no key is needed to run it.

## Tech

- React 19 + TypeScript, built with Vite
- Canvas-based procedural animation — each fish species is its own simulation module in [src/simulation/](src/simulation/)
- Tailwind CSS 4 for the UI overlay

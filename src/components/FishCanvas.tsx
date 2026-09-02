import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CleanerWrasse } from '../simulation/CleanerWrasse';
import { SharknoseGoby } from '../simulation/SharknoseGoby';
import { Reef } from '../simulation/Reef';
import { ClientDirector, ClientFish, ChallengeInfo } from '../simulation/ClientDirector';
import { AmbientSchool } from '../simulation/AmbientSchool';
import { ControlledFish, ClientFishInfo, ClientFishSpecies } from '../types';

export type ActiveClientFish = ClientFish;

interface FishCanvasProps {
  isRunning: boolean;
  onToggleRunning?: () => void;
  selectedFish: ControlledFish;
  onSelectFish: (fish: ControlledFish) => void;
  wrasseScale: number;
  wrasseSpeed: number;
  gobiScale: number;
  gobiSpeed: number;
  skipTrigger?: number;
  onParasiteStatsUpdate?: (stats: {
    total: number;
    remaining: number;
    removed: number;
    teethRemaining: number;
    bodyRemaining: number;
  }) => void;
  onClientFishUpdate?: (info: ClientFishInfo) => void;
  onClientCleaned?: () => void;
  mode?: 'reef' | 'challenge';
  challengeRestartTrigger?: number;
  onChallengeUpdate?: (info: ChallengeInfo) => void;
}

interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface MicroBubble {
  x: number;
  y: number;
  size: number;
  speed: number;
  wobble: number;
  alpha: number;
}

const AMBIENT_SCHOOL_COUNT = 7;

// Gill-flap cover colors per species, matched to each body palette
// (base = the flap plate, edge = its darker margin - no muddy browns)
const FLAP_COLOR: Record<ClientFishSpecies, { base: string; edge: string }> = {
  grouper: { base: '#f97316', edge: '#b45309' }, // unused: grouper lifts its own art
  queen_parrotfish: { base: '#2dd4bf', edge: '#0f766e' },
  queen_triggerfish: { base: '#38bdf8', edge: '#155e75' },
  yellowtail_goatfish: { base: '#ece6cd', edge: '#b3ab84' },
  french_grunt: { base: '#f0dd8f', edge: '#b09b4a' },
  whitespotted_filefish: { base: '#ab9f92', edge: '#6e6357' },
  trumpetfish: { base: '#c89455', edge: '#7c5a2b' },
  spotted_moray: { base: '#e8d795', edge: '#a08e4e' },
};

interface ClampBurst {
  x: number;
  y: number;
  age: number; // 0..1
  golden?: boolean; // mucus-bite burst
  mini?: boolean; // small green nibble pop
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number; // 0..1
}

export function getClientSpeciesMetadata(species: ClientFishSpecies) {
  switch (species) {
    case 'grouper':
      return {
        name: 'Coral Grouper',
        scientificName: 'Epinephelus lanceolatus',
        size: '~60–120 cm',
        keyFeatures: [
          'Heavy predatory cranium',
          'Sharp conical predator teeth',
          'Coral red-amber spotted body',
          'Deep cavernous oral cavity',
        ],
      };
    case 'queen_parrotfish':
      return {
        name: 'Queen Parrotfish',
        scientificName: 'Scarus vetula',
        size: '~30–60 cm',
        keyFeatures: [
          'Deep, laterally compressed body',
          'Powerful parrot-like beak',
          'Bright turquoise/blue-green coloration',
          'Contrasting yellow/orange facial mask',
          'Distinctive fused dental plates',
          'Flowing lunate caudal tail',
        ],
      };
    case 'yellowtail_goatfish':
      return {
        name: 'Yellowtail Goatfish',
        scientificName: 'Mulloidichthys martinicus',
        size: '~25–35 cm',
        keyFeatures: [
          'Slender, streamlined body',
          'Silver/pale iridescent body',
          'Bright yellow tail',
          'Yellowish lateral coloration',
          'Two prominent chin barbels',
          'Small mouth beneath the head',
          'Forked tail',
        ],
      };
    case 'queen_triggerfish':
      return {
        name: 'Queen Triggerfish',
        scientificName: 'Balistes vetula',
        size: '~30–50 cm',
        keyFeatures: [
          'Deep, chunky, highly compressed body',
          'Small puckered mouth',
          'Large expressive eye',
          'Tall dorsal spines',
          'Strong angular fins',
          'Blue/green/turquoise body',
          'Yellow/orange accents around face and fins',
          'Elaborate tail',
        ],
      };
    case 'trumpetfish':
      return {
        name: 'Atlantic Trumpetfish',
        scientificName: 'Aulostomus maculatus',
        size: '~60–90 cm',
        keyFeatures: [
          'Extremely elongated body',
          'Extremely long tubular snout',
          'Tiny terminal mouth with chin barbel',
          'Long dorsal/anal fins toward rear',
          'Brown, yellow, blue or mottled coloration',
          'Small eye relative to body',
          'Very thin tail with black ocellus',
        ],
      };
    case 'spotted_moray':
      return {
        name: 'Spotted Moray',
        scientificName: 'Gymnothorax moringa',
        size: '~60–150 cm',
        keyFeatures: [
          'Long, snake-like body',
          'No obvious paired fins',
          'Large rounded head',
          'Huge mouth',
          'Prominent teeth',
          'Small eyes',
          'Cream/tan body covered with dark spots',
          'Often shown emerging from a reef crevice',
        ],
      };
    case 'whitespotted_filefish':
      return {
        name: 'Whitespotted Filefish',
        scientificName: 'Cantherhines macrocerus',
        size: '~25–35 cm',
        keyFeatures: [
          'Unusual, deep-bodied/oval shape',
          'Rough-looking skin texture',
          'Gray/brown base',
          'Numerous white spots',
          'Small mouth',
          'Tall dorsal spine',
          'Small pectoral fins',
        ],
      };
    case 'french_grunt':
      return {
        name: 'French Grunt',
        scientificName: 'Haemulon flavolineatum',
        size: '~20–30 cm',
        keyFeatures: [
          'Smaller, deep-bodied reef fish',
          'Silver/cream body',
          'Several strong yellow horizontal stripes',
          'Yellow head',
          'Blue/gray facial markings',
          'Large expressive-looking eye',
          'Relatively small mouth',
        ],
      };
  }
}

export const FishCanvas: React.FC<FishCanvasProps> = ({
  isRunning,
  selectedFish,
  onSelectFish,
  wrasseScale,
  wrasseSpeed,
  gobiScale,
  gobiSpeed,
  skipTrigger,
  onParasiteStatsUpdate,
  onClientFishUpdate,
  onClientCleaned,
  mode = 'reef',
  challengeRestartTrigger,
  onChallengeUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fishRef = useRef<CleanerWrasse | null>(null);
  const gobiRef = useRef<SharknoseGoby | null>(null);

  // Reef-mode traffic controller: one active client + waiting clients
  const directorRef = useRef<ClientDirector | null>(null);
  const schoolsRef = useRef<AmbientSchool[]>([]);

  const reefRef = useRef<Reef | null>(null);
  const ripplesRef = useRef<WaterRipple[]>([]);
  const burstsRef = useRef<ClampBurst[]>([]);
  const floatersRef = useRef<Floater[]>([]);
  // Which parasite ids we've already popped for, per active client
  const eatSeenRef = useRef<{ slot: unknown; ids: Set<number> } | null>(null);
  const bubblesRef = useRef<MicroBubble[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const selectedFishRef = useRef<ControlledFish>(selectedFish);
  const isPointerDownRef = useRef<boolean>(false);
  const lastStatsSyncRef = useRef<number>(0);
  const lastSkipTriggerRef = useRef<number | undefined>(skipTrigger);
  const lastPointerTsRef = useRef<number>(performance.now());
  const massageHeldRef = useRef<boolean>(false);
  const biteHeldRef = useRef<boolean>(false);
  const lastRestartRef = useRef<number | undefined>(challengeRestartTrigger);

  // Mode switch drives the director
  useEffect(() => {
    const d = directorRef.current;
    if (!d) return;
    if (mode === 'challenge' && d.mode !== 'challenge') d.startChallenge();
    if (mode === 'reef' && d.mode !== 'reef') d.stopChallenge();
  }, [mode]);

  // Restart button re-arms the timer
  useEffect(() => {
    if (
      challengeRestartTrigger !== undefined &&
      challengeRestartTrigger !== lastRestartRef.current
    ) {
      lastRestartRef.current = challengeRestartTrigger;
      if (mode === 'challenge') directorRef.current?.startChallenge();
    }
  }, [challengeRestartTrigger, mode]);

  // Challenge controls: hold SPACE to bite mucus, hold M to massage
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        biteHeldRef.current = true;
        e.preventDefault();
      }
      if (e.code === 'KeyM') massageHeldRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') biteHeldRef.current = false;
      if (e.code === 'KeyM') massageHeldRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);
  const onClientCleanedRef = useRef<typeof onClientCleaned>(onClientCleaned);

  useEffect(() => {
    onClientCleanedRef.current = onClientCleaned;
    if (directorRef.current) {
      directorRef.current.onClientCleaned = () => onClientCleanedRef.current?.();
    }
  }, [onClientCleaned]);

  useEffect(() => {
    selectedFishRef.current = selectedFish;
  }, [selectedFish]);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // Handle Skip: send the active client on its way, promote the next
  useEffect(() => {
    if (skipTrigger !== undefined && skipTrigger !== lastSkipTriggerRef.current) {
      lastSkipTriggerRef.current = skipTrigger;
      directorRef.current?.skipActive();
    }
  }, [skipTrigger]);

  // Initialize bubbles
  const initBubbles = useCallback((width: number, height: number) => {
    const bubbles: MicroBubble[] = [];
    const count = 28;
    for (let i = 0; i < count; i++) {
      bubbles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1.2 + Math.random() * 2.5,
        speed: 0.35 + Math.random() * 0.75,
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.15 + Math.random() * 0.45,
      });
    }
    bubblesRef.current = bubbles;
  }, []);

  // Update cleaner fish configuration
  useEffect(() => {
    if (fishRef.current) {
      fishRef.current.setRunning(isRunning);
      fishRef.current.config.scale = wrasseScale;
      fishRef.current.config.baseSpeed = wrasseSpeed;
    }
    if (gobiRef.current) {
      gobiRef.current.setRunning(isRunning);
      gobiRef.current.config.scale = gobiScale;
      gobiRef.current.config.baseSpeed = gobiSpeed;
    }
  }, [isRunning, wrasseScale, wrasseSpeed, gobiScale, gobiSpeed]);

  // Handle global pointerup
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      isPointerDownRef.current = false;
      fishRef.current?.setPointer(null, false);
      gobiRef.current?.setPointer(null, false);
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, []);

  // Handle ResizeObserver for crisp full-container rendering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });

          if (!fishRef.current) {
            fishRef.current = new CleanerWrasse(width * 0.35, height * 0.45);
            fishRef.current.config.scale = wrasseScale;
            fishRef.current.config.baseSpeed = wrasseSpeed;
            fishRef.current.setRunning(isRunning);
            initBubbles(width, height);
          }

          if (!gobiRef.current) {
            gobiRef.current = new SharknoseGoby(width, height);
            gobiRef.current.config.scale = gobiScale;
            gobiRef.current.config.baseSpeed = gobiSpeed;
            gobiRef.current.setRunning(isRunning);
          }

          if (!directorRef.current) {
            directorRef.current = new ClientDirector();
            directorRef.current.onClientCleaned = () => onClientCleanedRef.current?.();
            // Dev convenience: lets tests and the console inspect the tank
            (window as unknown as { __director?: ClientDirector }).__director =
              directorRef.current;
            (window as unknown as { __cleaners?: unknown[] }).__cleaners = [fishRef, gobiRef];
          }

          if (schoolsRef.current.length === 0) {
            for (let i = 0; i < AMBIENT_SCHOOL_COUNT; i++) {
              schoolsRef.current.push(new AmbientSchool(width, height, i + 1));
            }
          }

          if (!reefRef.current) {
            reefRef.current = new Reef();
          }
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [wrasseScale, wrasseSpeed, gobiScale, gobiSpeed, isRunning, initBubbles]);

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isPointerDownRef.current = true;
    lastPointerTsRef.current = performance.now();

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check hit tests to see if user clicked the Goby or the Wrasse to select them
    const hitGobi = gobiRef.current?.hitTest({ x, y });
    const hitWrasse = fishRef.current?.hitTest({ x, y });

    let active = selectedFishRef.current;

    if (hitGobi && !hitWrasse) {
      active = 'gobi';
      onSelectFish('gobi');
    } else if (hitWrasse && !hitGobi) {
      active = 'wrasse';
      onSelectFish('wrasse');
    } else if (hitGobi && hitWrasse) {
      const distGobi = Math.hypot(
        x - (gobiRef.current?.headPos.x || 0),
        y - (gobiRef.current?.headPos.y || 0)
      );
      const distWrasse = Math.hypot(
        x - (fishRef.current?.headPos.x || 0),
        y - (fishRef.current?.headPos.y || 0)
      );
      active = distGobi < distWrasse ? 'gobi' : 'wrasse';
      onSelectFish(active);
    }

    if (active === 'gobi' && gobiRef.current) {
      gobiRef.current.setPointer({ x, y }, true);
      fishRef.current?.setPointer(null, false);
    } else if (active === 'wrasse' && fishRef.current) {
      fishRef.current.setPointer({ x, y }, true);
      gobiRef.current?.setPointer(null, false);
    }

    // Spawn water ripple
    ripplesRef.current.push({
      x,
      y,
      radius: 5,
      maxRadius: 45,
      alpha: 0.45,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    lastPointerTsRef.current = performance.now();
    if (!isPointerDownRef.current || e.buttons === 0) {
      if (isPointerDownRef.current) {
        isPointerDownRef.current = false;
        fishRef.current?.setPointer(null, false);
        gobiRef.current?.setPointer(null, false);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const active = selectedFishRef.current;
    if (active === 'gobi' && gobiRef.current) {
      gobiRef.current.setPointer({ x, y }, true);
      fishRef.current?.setPointer(null, false);
    } else if (active === 'wrasse' && fishRef.current) {
      fishRef.current.setPointer({ x, y }, true);
      gobiRef.current?.setPointer(null, false);
    }
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    fishRef.current?.setPointer(null, false);
    gobiRef.current?.setPointer(null, false);
  };

  // Main Render & Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (time: number) => {
      const dtMs = time - lastTimeRef.current;
      lastTimeRef.current = time;
      const dt = Math.min(2.0, Math.max(0.2, dtMs / 16.67));

      const { width, height } = dimensions;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // --- Aquatic Background ---
      ctx.fillStyle = '#001f3f';
      ctx.fillRect(0, 0, width, height);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#002b5c');
      bgGrad.addColorStop(0.5, '#001f3f');
      bgGrad.addColorStop(1, '#001122');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // --- Ambient schools: distant silhouette fish, behind everything ---
      for (const school of schoolsRef.current) {
        if (isRunning) school.update(width, height, dt);
        school.render(ctx);
      }

      // --- Micro-Bubbles ---
      for (let i = 0; i < bubblesRef.current.length; i++) {
        const b = bubblesRef.current[i];
        b.y -= b.speed * dt;
        b.wobble += 0.05 * dt;
        const wobbleX = b.x + Math.sin(b.wobble) * 4;

        if (b.y < -10) {
          b.y = height + 10;
          b.x = Math.random() * width;
        }

        ctx.beginPath();
        ctx.arc(wobbleX, b.y, b.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha})`;
        ctx.fill();
      }

      // --- Water Ripples ---
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const r = ripplesRef.current[i];
        r.radius += 1.2 * dt;
        r.alpha -= 0.015 * dt;

        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          ripplesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // --- REEF MODE DIRECTOR: arrivals, waiting clients, departures ---
      const wrasseMouth = fishRef.current ? fishRef.current.getMouthPos() : null;
      const gobiMouth = gobiRef.current ? gobiRef.current.getMouthPos() : null;
      const cleanerHeads: { x: number; y: number }[] = [];
      if (fishRef.current) cleanerHeads.push(fishRef.current.headPos);
      if (gobiRef.current) cleanerHeads.push(gobiRef.current.headPos);

      const director = directorRef.current;
      // The player's selected cleaner bites (Space) / massages (M); the
      // other cleaner works the waiting queue in the background
      const wrasseSelected = selectedFishRef.current === 'wrasse';
      const selMouth = wrasseSelected ? wrasseMouth : gobiMouth;
      const offDutyMouth = wrasseSelected ? gobiMouth : wrasseMouth;
      if (director && isRunning) {
        director.update(
          width,
          height,
          dt,
          cleanerHeads,
          wrasseMouth,
          gobiMouth,
          wrasseScale,
          gobiScale,
          selMouth,
          biteHeldRef.current,
          massageHeldRef.current,
          offDutyMouth,
          wrasseSelected ? gobiScale : wrasseScale
        );
      }

      const lists = director
        ? director.renderLists()
        : { behindReef: [], openWater: [] };

      // The moray draws behind the reef wall it emerges from
      for (const slot of lists.behindReef) {
        ctx.save();
        ctx.globalAlpha *= slot.alpha;
        slot.fish.render(ctx);
        ctx.restore();
      }

      // Render Coral Reef Wall (sloping from bottom left)
      if (reefRef.current) {
        if (isRunning) {
          reefRef.current.update(dt);
        }
        reefRef.current.render(ctx, width, height);
      }

      // Open-water clients: far (small, translucent) first, near ones last
      for (const slot of lists.openWater) {
        ctx.save();
        ctx.globalAlpha *= slot.alpha;
        const fx = slot.fish.pos.x;
        const fy = slot.fish.pos.y;
        // Mirrored fish face right: flip the drawing around the fish's own x
        if (slot.mirrored) {
          ctx.translate(fx, fy);
          ctx.scale(-1, 1);
          ctx.translate(-fx, -fy);
        }
        // Wavey body while traveling: a speed-scaled flex (slight rotation +
        // shear oscillating at tail-beat rate) so a moving fish visibly
        // works its body instead of gliding like a cutout.
        const flex = Math.min(0.09, slot.lastSpeed * 0.012);
        if (flex > 0.004) {
          const beat = slot.bobPhase * 5;
          ctx.translate(fx, fy);
          ctx.rotate(Math.sin(beat) * flex * 0.6);
          ctx.transform(1, 0, Math.sin(beat + 1.2) * flex, 1, 0, 0);
          ctx.translate(-fx, -fy);
        }
        slot.fish.render(ctx);
        ctx.restore();
      }

      // Visitors carry a little suitcase (challenge mode)
      if (mode === 'challenge') {
        for (const slot of lists.openWater) {
          if (!slot.visitor || slot.phase === 'leaving') continue;
          const s = slot.fish.scale;
          const sw = Math.min(30, (9 + 4.5 * s) * 1.2);
          const sx = slot.pos.x - sw / 2;
          const sy = slot.pos.y + 20 * s + Math.sin(slot.bobPhase * 1.1) * 2.5;
          ctx.save();
          ctx.globalAlpha *= slot.alpha;
          // handle
          ctx.beginPath();
          ctx.arc(sx + sw / 2, sy, sw * 0.18, Math.PI, 0);
          ctx.strokeStyle = '#5c3d1e';
          ctx.lineWidth = 2;
          ctx.stroke();
          // case
          const sh = sw * 0.66;
          ctx.beginPath();
          ctx.roundRect(sx, sy, sw, sh, 3);
          ctx.fillStyle = '#a06b35';
          ctx.fill();
          ctx.strokeStyle = '#5c3d1e';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          // clasp band
          ctx.beginPath();
          ctx.moveTo(sx, sy + sh * 0.45);
          ctx.lineTo(sx + sw, sy + sh * 0.45);
          ctx.strokeStyle = 'rgba(92, 61, 30, 0.8)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        }
      }

      // Full-body sparkles over a fully-cleaned client during its happy pause
      for (const slot of [...lists.behindReef, ...lists.openWater]) {
        if (!(slot.phase === 'leaving' && slot.leaveReason === 'cleaned' && slot.shimmyT > 0)) continue;
        const s = slot.fish.scale;
        ctx.save();
        for (let i = 0; i < 11; i++) {
          const tw = (Math.sin(slot.bobPhase * 8 + i * 2.1) + 1) / 2;
          if (tw < 0.3) continue;
          const px = slot.pos.x + Math.sin(i * 3.7 + 1.3) * 48 * (0.4 + s * 0.14);
          const py = slot.pos.y + Math.cos(i * 2.9 + 0.7) * 20 * (0.4 + s * 0.14);
          const r = 2 + tw * 3;
          ctx.strokeStyle = `rgba(253, 230, 138, ${0.35 + tw * 0.6})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px - r, py);
          ctx.lineTo(px + r, py);
          ctx.moveTo(px, py - r);
          ctx.lineTo(px, py + r);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(px, py, 1.1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 251, 235, ${0.5 + tw * 0.5})`;
          ctx.fill();
        }
        ctx.restore();
      }

      // --- Gill flap + clamp comedy for the active client ---
      const activeSlot = director ? director.active() : null;
      // The grouper lifts its own drawn operculum; everyone else gets the
      // overlay flap
      if (
        activeSlot &&
        activeSlot.species !== 'grouper' &&
        activeSlot.cavGill.anchorLocal
      ) {
        const cav = activeSlot.cavGill;
        const fpx = activeSlot.fish.pos.x;
        const ax = fpx + (activeSlot.mirrored ? -cav.anchorLocal.x : cav.anchorLocal.x);
        const ay = activeSlot.fish.pos.y + cav.anchorLocal.y;
        const s = Math.min(4.5, Math.max(1.6, activeSlot.fish.scale));
        const r = 8 * s;
        const dir = activeSlot.mirrored ? -1 : 1;
        // Hinge at the flap's upper rear; opens by rotating up and back,
        // wiggles as the composure warning, flushes red before the clamp
        const lift = 0.05 + Math.max(0, cav.open) * 0.24; // a modest crack, rear edge lifting

        // Gill chamber revealed as the flap lifts: dark recess with red
        // filament combs - so there's something alive under the cover
        if (cav.open > 0.05) {
          // A narrow slit of gill peeking from under the flap's REAR edge -
          // a modest crack, not a wound
          ctx.save();
          ctx.globalAlpha *= activeSlot.alpha * Math.min(1, cav.open * 1.6);
          ctx.translate(ax, ay);
          ctx.scale(dir, 1);
          ctx.beginPath();
          ctx.ellipse(r * 0.38, r * 0.12, r * 0.3, r * 0.58, -0.18, 0, Math.PI * 2);
          ctx.fillStyle = '#38090e';
          ctx.fill();
          // Comb-like gill filaments: two arch rows of many fine strokes
          for (let row = 0; row < 2; row++) {
            ctx.strokeStyle = row === 1 ? '#d94550' : '#8f1f28';
            ctx.lineWidth = r * 0.05;
            ctx.lineCap = 'round';
            const rx = r * (0.24 + row * 0.16);
            for (let g = 0; g < 7; g++) {
              const t = -0.5 + g / 6;
              const cy0 = r * 0.12 + t * r * 0.9;
              const bow = (1 - Math.abs(t * 2)) * r * 0.08;
              ctx.beginPath();
              ctx.moveTo(rx + bow, cy0);
              ctx.lineTo(rx + bow + r * 0.2, cy0 + r * 0.05);
              ctx.stroke();
            }
          }
          ctx.restore();
        }

        // The flap cover: hinged at its FRONT-top edge like a real
        // operculum, so it swings up and toward the tail as it opens
        ctx.save();
        ctx.globalAlpha *= activeSlot.alpha * 0.92;
        ctx.translate(ax - dir * r * 0.5, ay - r * 0.7);
        ctx.scale(dir, 1); // +x now points toward the tail
        ctx.rotate(-lift);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 1.15, r * 0.1, r * 1.25, r * 0.85);
        ctx.quadraticCurveTo(r * 1.0, r * 1.5, r * 0.35, r * 1.55);
        ctx.quadraticCurveTo(-r * 0.15, r * 1.1, 0, 0);
        ctx.closePath();
        const flapCol = FLAP_COLOR[activeSlot.species];
        const flapGrad = ctx.createLinearGradient(0, 0, r * 1.25, r * 0.9);
        flapGrad.addColorStop(0, flapCol.base);
        flapGrad.addColorStop(1, flapCol.edge);
        ctx.fillStyle = flapGrad;
        ctx.fill();
        if (cav.open > 0.15 && cav.composure < 0.6) {
          ctx.fillStyle = `rgba(220, 38, 38, ${(0.6 - cav.composure) * 0.3})`;
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.restore();
      }

      // Clamp bubble bursts
      if (director) {
        for (const ev of director.drainMucusEvents()) {
          const fpx = activeSlot ? activeSlot.fish.pos.x : ev.x;
          const bx = activeSlot && activeSlot.mirrored ? 2 * fpx - ev.x : ev.x;
          burstsRef.current.push({ x: bx, y: ev.y, age: 0, golden: true });
          floatersRef.current.push({
            x: bx,
            y: ev.y - 14,
            text: `+${ev.value} mucus!`,
            color: '#fbbf24',
            age: 0,
          });
        }
        for (const ev of director.drainClampEvents()) {
          const fpx = activeSlot ? activeSlot.fish.pos.x : ev.x;
          const bx = activeSlot && activeSlot.mirrored ? 2 * fpx - ev.x : ev.x;
          burstsRef.current.push({ x: bx, y: ev.y, age: 0 });
          // The director already knows exactly who was caught in the snap
          if (ev.hitWrasse && fishRef.current) fishRef.current.spit({ x: bx, y: ev.y });
          if (ev.hitGoby && gobiRef.current) gobiRef.current.spit({ x: bx, y: ev.y });
        }
      }
      for (let i = burstsRef.current.length - 1; i >= 0; i--) {
        const b = burstsRef.current[i];
        b.age += dt / (b.mini ? 26 : 45);
        if (b.age >= 1) {
          burstsRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = 1 - b.age;
        const count = b.mini ? 5 : 8;
        for (let k = 0; k < count; k++) {
          const ang = (k / count) * Math.PI * 2 + (b.mini ? 0.5 : 0);
          const dist = (b.mini ? 3 : 6) + b.age * (b.mini ? 16 : 42);
          ctx.beginPath();
          ctx.arc(
            b.x + Math.cos(ang) * dist,
            b.y + Math.sin(ang) * dist * 0.7 - b.age * (b.mini ? 12 : 26),
            b.mini ? 1.4 + (k % 2) : 2.2 + (k % 3),
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = b.mini
            ? 'rgba(207, 233, 168, 0.9)'
            : b.golden
            ? 'rgba(251, 191, 36, 0.9)'
            : 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Floating score/event popups so cause and effect read instantly
      for (let i = floatersRef.current.length - 1; i >= 0; i--) {
        const f = floatersRef.current[i];
        f.age += dt / 80;
        if (f.age >= 1) {
          floatersRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = f.age < 0.7 ? 1 : 1 - (f.age - 0.7) / 0.3;
        ctx.font = 'bold 16px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0, 10, 25, 0.75)';
        ctx.strokeText(f.text, f.x, f.y - f.age * 34);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y - f.age * 34);
        ctx.restore();
      }

      // --- Active client drives cleaning targets + UI ---
      const active = activeSlot;
      let cleaningSpots: { id: string; name: string; pos: { x: number; y: number } }[] = [];
      let activeParasiteSpots: { x: number; y: number }[] = [];

      if (active && active.phase !== 'leaving') {
        cleaningSpots = active.fish.getCleaningStationSpots();
        activeParasiteSpots = active.fish.getActiveParasitePositions();
        // A mirrored client is drawn flipped, so reflect its reported spots
        // into true screen space for the cleaners' AI
        if (active.mirrored) {
          const px = active.fish.pos.x;
          cleaningSpots = cleaningSpots.map((sp) => ({
            ...sp,
            pos: { x: 2 * px - sp.pos.x, y: sp.pos.y },
          }));
          activeParasiteSpots = activeParasiteSpots.map((p) => ({ x: 2 * px - p.x, y: p.y }));
        }
      }

      if (onChallengeUpdate && director && time - lastStatsSyncRef.current > 150) {
        onChallengeUpdate(director.challengeInfo());
      }
      if (active && onParasiteStatsUpdate && time - lastStatsSyncRef.current > 150) {
        lastStatsSyncRef.current = time;
        onParasiteStatsUpdate(active.fish.getParasiteStats());
      }

      if (onClientFishUpdate) {
        if (active) {
          const metadata = getClientSpeciesMetadata(active.species);
          const state: ClientFishInfo['state'] =
            active.phase === 'leaving'
              ? 'exiting'
              : active.phase === 'entering'
              ? 'entering'
              : 'stationary';
          onClientFishUpdate({
            species: active.species,
            name: metadata.name,
            scientificName: metadata.scientificName,
            size: metadata.size,
            keyFeatures: metadata.keyFeatures,
            state,
            elapsedSeconds: Math.floor(active.ageSec),
            transitionCountdown: Math.max(0, Math.ceil(active.patience)),
            patienceFrac: active.patienceMax > 0 ? active.patience / active.patienceMax : 1,
            isVisitor: active.visitor,
            isVisible: true,
          });
        } else {
          onClientFishUpdate({
            species: 'grouper',
            name: '',
            scientificName: '',
            size: '',
            keyFeatures: [],
            state: 'waiting',
            elapsedSeconds: 0,
            transitionCountdown: 0,
            isVisible: false,
          });
        }
      }

      // Auto-cleaner targets: body and fin parasites only - gill flaps and
      // mouths are the player's work. If the player has been idle a while
      // (true screensaver), the auto cleaners may finish everything.
      const GATED_PARTS = ['operculum', 'upperTeeth', 'lowerTeeth'];
      const playerIdle = time - lastPointerTsRef.current > 25000;
      let autoTargets: { x: number; y: number }[] = [];
      if (active && active.phase !== 'leaving') {
        if (playerIdle) {
          autoTargets = activeParasiteSpots.slice();
        } else {
          const fpx = active.fish.pos.x;
          autoTargets = active.fish.parasites
            .filter((p) => !p.removed && !GATED_PARTS.includes(p.attachPart))
            .map((p) => {
              const lp = active.fish.getParasiteLocalPos(p);
              const x = active.fish.pos.x + lp.x;
              return { x: active.mirrored ? 2 * fpx - x : x, y: active.fish.pos.y + lp.y };
            });
        }
        if (autoTargets.length > 3) {
          const flank = cleaningSpots.find((sp) => /flank|torso|body/i.test(sp.id));
          if (flank) autoTargets.push(flank.pos);
        }
      }

      // The off-duty cleaner's beat: the waiting queue's body parasites
      let queueTargets: { x: number; y: number }[] = [];
      if (director && !playerIdle) {
        for (const slot of director.slots) {
          if (slot.role !== 'waiting' || slot.phase === 'leaving') continue;
          const fpx = slot.fish.pos.x;
          for (const p of slot.fish.parasites) {
            if (p.removed || GATED_PARTS.includes(p.attachPart)) continue;
            const lp = slot.fish.getParasiteLocalPos(p);
            const x = slot.fish.pos.x + lp.x;
            queueTargets.push({ x: slot.mirrored ? 2 * fpx - x : x, y: slot.fish.pos.y + lp.y });
          }
        }
      }
      if (queueTargets.length === 0) queueTargets = autoTargets;

      // Nibble juice: a soft green pop for every parasite eaten (plus its
      // score floating up during a challenge) - the old game's best feel
      if (active) {
        const sameClient = eatSeenRef.current && eatSeenRef.current.slot === active;
        const seen = sameClient ? eatSeenRef.current!.ids : new Set<number>();
        const fpx = active.fish.pos.x;
        for (const p of active.fish.parasites) {
          if (!p.removed || seen.has(p.id)) continue;
          seen.add(p.id);
          if (!sameClient) continue; // pre-existing removals, no pop
          const lp = active.fish.getParasiteLocalPos(p);
          const x0 = active.fish.pos.x + lp.x;
          const x = active.mirrored ? 2 * fpx - x0 : x0;
          const y = active.fish.pos.y + lp.y;
          burstsRef.current.push({ x, y, age: 0, mini: true });
          const chInfo = director ? director.challengeInfo() : null;
          if (mode === 'challenge' && chInfo && chInfo.running && !chInfo.over && chInfo.countdown <= 0) {
            const val = (GATED_PARTS.includes(p.attachPart) ? 20 : 10) * (active.visitor ? 2 : 1);
            floatersRef.current.push({ x, y: y - 10, text: `+${val}`, color: '#cfe9a8', age: 0 });
          }
        }
        eatSeenRef.current = { slot: active, ids: seen };
      }

      // Duty cycle: each auto cleaner works ~12s then drifts off ~8s,
      // offset so the two rarely rest at the same time
      const tSec = time / 1000;
      const wrasseWorking = tSec % 20 < 12;
      const gobiWorking = (tSec + 10) % 20 < 12;

      // --- 2. Sharknose Goby ---
      if (gobiRef.current) {
        const beat = wrasseSelected ? queueTargets : autoTargets;
        gobiRef.current.setCleaningSpots(gobiWorking ? beat : []);
        gobiRef.current.update(width, height, dt);
        gobiRef.current.render(ctx);
      }

      // --- 3. Cleaner Wrasse ---
      if (fishRef.current) {
        const beat = wrasseSelected ? autoTargets : queueTargets;
        fishRef.current.setCleaningSpots(wrasseWorking ? beat : []);
        fishRef.current.update(width, height, dt);
        fishRef.current.render(ctx);
      }

      ctx.restore();

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [
    dimensions,
    isRunning,
    mode,
    onChallengeUpdate,
    wrasseScale,
    wrasseSpeed,
    gobiScale,
    gobiSpeed,
    onParasiteStatsUpdate,
    onClientFishUpdate,
  ]);

  return (
    <div
      ref={containerRef}
      id="fish-canvas-container"
      className="relative w-full h-full select-none overflow-hidden touch-none"
    >
      <canvas
        ref={canvasRef}
        id="cleaner-wrasse-canvas"
        className="w-full h-full cursor-pointer"
        style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
};

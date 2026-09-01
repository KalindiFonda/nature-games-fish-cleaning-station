import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CleanerWrasse } from '../simulation/CleanerWrasse';
import { SharknoseGoby } from '../simulation/SharknoseGoby';
import { Grouper } from '../simulation/Grouper';
import { QueenParrotfish } from '../simulation/QueenParrotfish';
import { YellowtailGoatfish } from '../simulation/YellowtailGoatfish';
import { QueenTriggerfish } from '../simulation/QueenTriggerfish';
import { Trumpetfish } from '../simulation/Trumpetfish';
import { SpottedMoray } from '../simulation/SpottedMoray';
import { WhitespottedFilefish } from '../simulation/WhitespottedFilefish';
import { FrenchGrunt } from '../simulation/FrenchGrunt';
import { Reef } from '../simulation/Reef';
import { ControlledFish, ClientFishInfo, ClientFishSpecies } from '../types';

export type ActiveClientFish =
  | Grouper
  | QueenParrotfish
  | YellowtailGoatfish
  | QueenTriggerfish
  | Trumpetfish
  | SpottedMoray
  | WhitespottedFilefish
  | FrenchGrunt;

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

const CLIENT_SPECIES_SEQUENCE: ClientFishSpecies[] = [
  'grouper',
  'queen_parrotfish',
  'yellowtail_goatfish',
  'queen_triggerfish',
  'trumpetfish',
  'spotted_moray',
  'whitespotted_filefish',
  'french_grunt',
];

const CLIENT_VISIT_DURATION = 15.0; // 15 seconds per fish
const CLIENT_TRANSITION_PAUSE = 2.0; // 2 seconds between clients

function createClientFish(
  species: ClientFishSpecies,
  width: number,
  height: number
): ActiveClientFish {
  switch (species) {
    case 'grouper':
      return new Grouper(width, height);
    case 'queen_parrotfish':
      return new QueenParrotfish(width, height);
    case 'yellowtail_goatfish':
      return new YellowtailGoatfish(width, height);
    case 'queen_triggerfish':
      return new QueenTriggerfish(width, height);
    case 'trumpetfish':
      return new Trumpetfish(width, height);
    case 'spotted_moray':
      return new SpottedMoray(width, height);
    case 'whitespotted_filefish':
      return new WhitespottedFilefish(width, height);
    case 'french_grunt':
      return new FrenchGrunt(width, height);
  }
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fishRef = useRef<CleanerWrasse | null>(null);
  const gobiRef = useRef<SharknoseGoby | null>(null);

  // Single active client fish manager: strictly enforces that only ONE client fish exists at any time
  const activeClientRef = useRef<ActiveClientFish | null>(null);

  const reefRef = useRef<Reef | null>(null);
  const ripplesRef = useRef<WaterRipple[]>([]);
  const bubblesRef = useRef<MicroBubble[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const selectedFishRef = useRef<ControlledFish>(selectedFish);
  const isPointerDownRef = useRef<boolean>(false);
  const lastStatsSyncRef = useRef<number>(0);

  // Timeline & Species Rotation State (15s stay -> reverse exit -> 2s gap -> next species)
  const activeSpeciesIndexRef = useRef<number>(0);
  const activeClientSpeciesRef = useRef<ClientFishSpecies>('grouper');
  const clientVisitTimerRef = useRef<number>(0);
  const exitTriggeredRef = useRef<boolean>(false);
  const exitedTimestampRef = useRef<number | null>(null);
  const lastSkipTriggerRef = useRef<number | undefined>(skipTrigger);

  useEffect(() => {
    selectedFishRef.current = selectedFish;
  }, [selectedFish]);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // Handle Skip to Next Fish (Bypass 15 seconds)
  useEffect(() => {
    if (skipTrigger !== undefined && skipTrigger !== lastSkipTriggerRef.current) {
      lastSkipTriggerRef.current = skipTrigger;
      const client = activeClientRef.current;
      const { width, height } = dimensions;

      if (client && (client.state === 'entering' || client.state === 'stationary')) {
        // Trigger immediate exit
        clientVisitTimerRef.current = CLIENT_VISIT_DURATION;
        exitTriggeredRef.current = true;
        client.startExit();
      } else {
        // If already exiting or in gap, advance immediately to next species
        const nextIndex = (activeSpeciesIndexRef.current + 1) % CLIENT_SPECIES_SEQUENCE.length;
        activeSpeciesIndexRef.current = nextIndex;
        const nextSpecies = CLIENT_SPECIES_SEQUENCE[nextIndex];
        activeClientSpeciesRef.current = nextSpecies;

        activeClientRef.current = createClientFish(nextSpecies, width, height);
        clientVisitTimerRef.current = 0;
        exitTriggeredRef.current = false;
        exitedTimestampRef.current = null;
      }
    }
  }, [skipTrigger, dimensions]);

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

          if (!activeClientRef.current) {
            const species = CLIENT_SPECIES_SEQUENCE[activeSpeciesIndexRef.current];
            activeClientSpeciesRef.current = species;
            activeClientRef.current = createClientFish(species, width, height);
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

      if (isRunning) {
        clientVisitTimerRef.current += dtMs / 1000;
      }

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

      // --- TIMELINE CONTROLLER: 15 seconds visit duration, reverse exit, 2s gap -> next species ---
      const activeSpecies = CLIENT_SPECIES_SEQUENCE[activeSpeciesIndexRef.current];
      activeClientSpeciesRef.current = activeSpecies;
      const currentTimer = clientVisitTimerRef.current;
      const client = activeClientRef.current;

      // 1. After 15 seconds: trigger reverse exit for the current active fish
      if (currentTimer >= CLIENT_VISIT_DURATION && !exitTriggeredRef.current) {
        exitTriggeredRef.current = true;
        client?.startExit();
      }

      // 2. Check if active fish has finished exiting
      const activeFishExited = !client || client.state === 'exited' || !client.isVisible;

      if (activeFishExited && exitedTimestampRef.current === null && exitTriggeredRef.current) {
        exitedTimestampRef.current = currentTimer;
      }

      // 3. 2 seconds after exit completes: advance to next client species!
      if (
        exitedTimestampRef.current !== null &&
        currentTimer >= exitedTimestampRef.current + CLIENT_TRANSITION_PAUSE
      ) {
        clientVisitTimerRef.current = 0;
        exitTriggeredRef.current = false;
        exitedTimestampRef.current = null;

        const nextIndex = (activeSpeciesIndexRef.current + 1) % CLIENT_SPECIES_SEQUENCE.length;
        activeSpeciesIndexRef.current = nextIndex;
        const nextSpecies = CLIENT_SPECIES_SEQUENCE[nextIndex];
        activeClientSpeciesRef.current = nextSpecies;

        activeClientRef.current = createClientFish(nextSpecies, width, height);
      }

      // --- 1. Client Fish & Reef Rendering ---
      let cleaningSpots: { id: string; name: string; pos: { x: number; y: number } }[] = [];
      let activeParasiteSpots: { x: number; y: number }[] = [];
      const wrasseMouth = fishRef.current ? fishRef.current.getMouthPos() : null;
      const gobiMouth = gobiRef.current ? gobiRef.current.getMouthPos() : null;

      const isClientVisible = !!(
        activeClientRef.current &&
        activeClientRef.current.isVisible &&
        activeClientRef.current.state !== 'exited'
      );

      // Case A: Spotted Moray emerges from behind the coral reef wall (rendered BEFORE reef)
      if (activeSpecies === 'spotted_moray' && activeClientRef.current && isClientVisible) {
        if (isRunning) {
          activeClientRef.current.update(width, height, dt);
          activeClientRef.current.updateParasites(
            wrasseMouth,
            gobiMouth,
            dt,
            wrasseScale,
            gobiScale
          );
        }
        // Render moray behind the reef wall
        activeClientRef.current.render(ctx);

        cleaningSpots = activeClientRef.current.getCleaningStationSpots();
        activeParasiteSpots = activeClientRef.current.getActiveParasitePositions();

        if (onParasiteStatsUpdate && time - lastStatsSyncRef.current > 150) {
          lastStatsSyncRef.current = time;
          onParasiteStatsUpdate(activeClientRef.current.getParasiteStats());
        }
      }

      // Render Coral Reef Wall (sloping from bottom left)
      if (reefRef.current) {
        if (isRunning) {
          reefRef.current.update(dt);
        }
        reefRef.current.render(ctx, width, height);
      }

      // Case B: Open-water swimming client fish (Grouper, Parrotfish, Goatfish, Triggerfish, Trumpetfish, Filefish, Grunt)
      if (activeSpecies !== 'spotted_moray' && activeClientRef.current && isClientVisible) {
        if (isRunning) {
          activeClientRef.current.update(width, height, dt);
          activeClientRef.current.updateParasites(
            wrasseMouth,
            gobiMouth,
            dt,
            wrasseScale,
            gobiScale
          );
        }
        activeClientRef.current.render(ctx);

        cleaningSpots = activeClientRef.current.getCleaningStationSpots();
        activeParasiteSpots = activeClientRef.current.getActiveParasitePositions();

        if (onParasiteStatsUpdate && time - lastStatsSyncRef.current > 150) {
          lastStatsSyncRef.current = time;
          onParasiteStatsUpdate(activeClientRef.current.getParasiteStats());
        }
      }

      // Update Client Fish Info to Parent/UI
      if (onClientFishUpdate) {
        let currentClientState: ClientFishInfo['state'] = 'stationary';
        let countdown = 0;

        const currentClient = activeClientRef.current;
        if (currentClient?.state === 'exiting') {
          currentClientState = 'exiting';
          countdown = 0;
        } else if (currentClient?.state === 'exited' || !isClientVisible || exitedTimestampRef.current !== null) {
          currentClientState = 'waiting';
          countdown = Math.max(
            0,
            Math.ceil(
              (exitedTimestampRef.current || currentTimer) + CLIENT_TRANSITION_PAUSE - clientVisitTimerRef.current
            )
          );
        } else {
          currentClientState = currentClient?.state || 'stationary';
          countdown = Math.max(
            0,
            Math.ceil(CLIENT_VISIT_DURATION - clientVisitTimerRef.current)
          );
        }

        const metadata = getClientSpeciesMetadata(activeSpecies);

        onClientFishUpdate({
          species: activeSpecies,
          name: metadata.name,
          scientificName: metadata.scientificName,
          size: metadata.size,
          keyFeatures: metadata.keyFeatures,
          state: currentClientState,
          elapsedSeconds: Math.floor(clientVisitTimerRef.current),
          transitionCountdown: countdown,
          isVisible: isClientVisible,
        });
      }

      const allTargets = [
        ...cleaningSpots.map((s) => s.pos),
        ...activeParasiteSpots,
      ];

      // --- 2. Sharknose Goby ---
      if (gobiRef.current) {
        if (allTargets.length > 0) {
          gobiRef.current.setCleaningSpots(allTargets);
        }
        gobiRef.current.update(width, height, dt);
        gobiRef.current.render(ctx);
      }

      // --- 3. Cleaner Wrasse ---
      if (fishRef.current) {
        if (allTargets.length > 0) {
          fishRef.current.setCleaningSpots(allTargets);
        }
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

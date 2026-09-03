import React, { useEffect, useRef, useState } from 'react';
import { SpanishHogfish } from '../simulation/SpanishHogfish';
import { SharknoseGoby } from '../simulation/SharknoseGoby';
import { Reef } from '../simulation/Reef';
import { ClientDirector } from '../simulation/ClientDirector';
import { SPECIES } from '../data/species';
import { AmbientSchool } from '../simulation/AmbientSchool';
import { ControlledFish, ClientFishInfo } from '../types';
import { playNibbleSound, initAudioOnInteraction } from '../utils/audio';
import { EffectsLayer } from '../render/effects';
import { drawGillFlap } from '../render/gillFlap';
import { drawCleanedSparkles } from '../render/sparkles';
import { drawBehindReefClients, drawOpenWaterClients } from '../render/clientLayer';
import { computeCleanerTargets } from '../simulation/targeting';

interface FishCanvasProps {
  isRunning: boolean;
  selectedFish: ControlledFish;
  onSelectFish: (fish: ControlledFish) => void;
  hogfishScale: number;
  hogfishSpeed: number;
  gobyScale: number;
  gobySpeed: number;
  pausePatience?: boolean;
  onParasiteStatsUpdate?: (stats: {
    total: number;
    remaining: number;
    removed: number;
    teethRemaining: number;
    bodyRemaining: number;
  }) => void;
  onClientFishUpdate?: (info: ClientFishInfo) => void;
  onClientCleaned?: () => void;
}

const AMBIENT_SCHOOL_COUNT = 7;

export const FishCanvas: React.FC<FishCanvasProps> = ({
  isRunning,
  selectedFish,
  onSelectFish,
  hogfishScale,
  hogfishSpeed,
  gobyScale,
  gobySpeed,
  pausePatience = false,
  onParasiteStatsUpdate,
  onClientFishUpdate,
  onClientCleaned,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fishRef = useRef<SpanishHogfish | null>(null);
  const gobyRef = useRef<SharknoseGoby | null>(null);

  // Traffic controller: one active client + waiting clients
  const directorRef = useRef<ClientDirector | null>(null);
  const schoolsRef = useRef<AmbientSchool[]>([]);

  const reefRef = useRef<Reef | null>(null);
  // Ripples, micro-bubbles and clamp/nibble bursts
  const effectsRef = useRef<EffectsLayer>(new EffectsLayer());
  // Which parasite ids we've already popped for, per active client
  const eatSeenRef = useRef<{ slot: unknown; ids: Set<number> } | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const selectedFishRef = useRef<ControlledFish>(selectedFish);
  const lastStatsSyncRef = useRef<number>(0);
  const lastInfoSyncRef = useRef<number>(0);
  const lastPointerTsRef = useRef<number>(performance.now());

  const onClientCleanedRef = useRef<typeof onClientCleaned>(onClientCleaned);

  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  useEffect(() => {
    onClientCleanedRef.current = onClientCleaned;
    if (directorRef.current) {
      directorRef.current.onClientCleaned = () => onClientCleanedRef.current?.();
    }
  }, [onClientCleaned]);

  useEffect(() => {
    selectedFishRef.current = selectedFish;
  }, [selectedFish]);

  useEffect(() => {
    if (directorRef.current) {
      directorRef.current.patiencePaused = pausePatience;
    }
  }, [pausePatience]);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // Update cleaner fish configuration
  useEffect(() => {
    if (fishRef.current) {
      fishRef.current.setRunning(isRunning);
      fishRef.current.config.scale = hogfishScale;
      fishRef.current.config.baseSpeed = hogfishSpeed;
    }
    if (gobyRef.current) {
      gobyRef.current.setRunning(isRunning);
      gobyRef.current.config.scale = gobyScale;
      gobyRef.current.config.baseSpeed = gobySpeed;
    }
  }, [isRunning, hogfishScale, hogfishSpeed, gobyScale, gobySpeed]);

  // Reset pointer on window blur
  useEffect(() => {
    const handleBlur = () => {
      fishRef.current?.setPointer(null, false);
      gobyRef.current?.setPointer(null, false);
    };

    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
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
            fishRef.current = new SpanishHogfish(width * 0.35, height * 0.45);
            fishRef.current.config.scale = hogfishScale;
            fishRef.current.config.baseSpeed = hogfishSpeed;
            fishRef.current.setRunning(isRunning);
            effectsRef.current.initBubbles(width, height);
          }

          if (!gobyRef.current) {
            gobyRef.current = new SharknoseGoby(width, height);
            gobyRef.current.config.scale = gobyScale;
            gobyRef.current.config.baseSpeed = gobySpeed;
            gobyRef.current.setRunning(isRunning);
          }

          if (!directorRef.current) {
            // Dev/testing: ?first=spotted_moray makes that species arrive first
            const first = new URLSearchParams(window.location.search).get('first');
            directorRef.current = new ClientDirector(
              first && first in SPECIES ? (first as keyof typeof SPECIES) : null
            );
            directorRef.current.onClientCleaned = () => onClientCleanedRef.current?.();
            // Dev convenience: lets tests and the console inspect the tank
            (window as unknown as { __director?: ClientDirector }).__director =
              directorRef.current;
            (window as unknown as { __cleaners?: unknown[] }).__cleaners = [fishRef, gobyRef];
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
  }, [hogfishScale, hogfishSpeed, gobyScale, gobySpeed, isRunning]);

  // Pointer Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    initAudioOnInteraction();
    lastPointerTsRef.current = performance.now();

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursor({ x, y, visible: true });

    // Check hit tests to see if user clicked the Goby or the Hogfish to select them
    const hitGoby = gobyRef.current?.hitTest({ x, y });
    const hitHogfish = fishRef.current?.hitTest({ x, y });

    let active = selectedFishRef.current;
    let switchedCleaner = false;

    if (hitGoby && !hitHogfish && active !== 'goby') {
      active = 'goby';
      onSelectFish('goby');
      switchedCleaner = true;
    } else if (hitHogfish && !hitGoby && active !== 'hogfish') {
      active = 'hogfish';
      onSelectFish('hogfish');
      switchedCleaner = true;
    } else if (hitGoby && hitHogfish) {
      const distGoby = Math.hypot(
        x - (gobyRef.current?.headPos.x || 0),
        y - (gobyRef.current?.headPos.y || 0)
      );
      const distHogfish = Math.hypot(
        x - (fishRef.current?.headPos.x || 0),
        y - (fishRef.current?.headPos.y || 0)
      );
      const chosen = distGoby < distHogfish ? 'goby' : 'hogfish';
      if (chosen !== active) {
        active = chosen;
        onSelectFish(active);
        switchedCleaner = true;
      }
    }

    if (active === 'goby' && gobyRef.current) {
      gobyRef.current.setPointer({ x, y }, true);
      fishRef.current?.setPointer(null, false);
    } else if (active === 'hogfish' && fishRef.current) {
      fishRef.current.setPointer({ x, y }, true);
      gobyRef.current?.setPointer(null, false);
    }

    // Manual client invitation from queue: hover cleaner over queue fish + click
    const director = directorRef.current;
    if (!switchedCleaner && director) {
      const currentCleaner = active === 'hogfish' ? fishRef.current : gobyRef.current;
      const cleanerHead = currentCleaner ? currentCleaner.headPos : { x, y };
      // Only a click ON a waiting client counts, so ordinary clicks around
      // the water never accidentally call a fish over
      const targetSlot = director.findWaitingClientNear({ x, y });

      if (targetSlot) {
        // The cleaner sways for a couple of seconds; the client flutters and
        // sets off almost at once, brightening as it swims closer
        const DANCE_SECONDS = 2.0;
        const COME_OVER_AFTER = 0.4;
        currentCleaner?.triggerInviteDance(DANCE_SECONDS, targetSlot.fish.pos);
        director.invite(targetSlot, COME_OVER_AFTER, rect.width, rect.height);
        effectsRef.current.addInviteBurst(cleanerHead.x, cleanerHead.y);
        playNibbleSound();
      }
    }

    // Spawn water ripple
    effectsRef.current.addRipple(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    lastPointerTsRef.current = performance.now();
    initAudioOnInteraction();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursor({ x, y, visible: true });

    const active = selectedFishRef.current;
    if (active === 'goby' && gobyRef.current) {
      gobyRef.current.setPointer({ x, y }, true);
      fishRef.current?.setPointer(null, false);
    } else if (active === 'hogfish' && fishRef.current) {
      fishRef.current.setPointer({ x, y }, true);
      gobyRef.current?.setPointer(null, false);
    }
  };

  const handlePointerLeave = () => {
    fishRef.current?.setPointer(null, false);
    gobyRef.current?.setPointer(null, false);
    setCursor((prev) => ({ ...prev, visible: false }));
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
      const effects = effectsRef.current;

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

      // --- Micro-bubbles + water ripples ---
      effects.renderBackground(ctx, dt, width, height);

      // --- REEF MODE DIRECTOR: arrivals, waiting clients, departures ---
      const hogfishMouth = fishRef.current ? fishRef.current.getMouthPos() : null;
      const gobyMouth = gobyRef.current ? gobyRef.current.getMouthPos() : null;
      const director = directorRef.current;
      // The player's selected cleaner works the station; the other cleaner
      // preps the waiting queue in the background
      const hogfishSelected = selectedFishRef.current === 'hogfish';
      const offDutyMouth = hogfishSelected ? gobyMouth : hogfishMouth;
      if (director && isRunning) {
        director.update(
          width,
          height,
          dt,
          hogfishMouth,
          gobyMouth,
          hogfishScale,
          gobyScale,
          offDutyMouth,
          hogfishSelected ? gobyScale : hogfishScale
        );
      }

      const lists = director
        ? director.renderLists()
        : { behindReef: [], openWater: [] };

      // The moray draws behind the reef wall it emerges from
      drawBehindReefClients(ctx, lists.behindReef);

      // Render Coral Reef Wall (sloping from bottom left)
      if (reefRef.current) {
        if (isRunning) {
          reefRef.current.update(dt);
        }
        reefRef.current.render(ctx, width, height);
      }

      // Open-water clients: far (small, translucent) first, near ones last
      drawOpenWaterClients(ctx, lists.openWater);

      // Full-body sparkles over a fully-cleaned client during its happy pause
      for (const slot of [...lists.behindReef, ...lists.openWater]) {
        drawCleanedSparkles(ctx, slot);
      }

      // --- Gill flap + clamp comedy for the active client ---
      const activeSlot = director ? director.active() : null;
      if (activeSlot) drawGillFlap(ctx, activeSlot);

      // Clamp bubble bursts
      if (director) {
        for (const ev of director.drainClampEvents()) {
          const fpx = activeSlot ? activeSlot.fish.pos.x : ev.x;
          const bx = activeSlot && activeSlot.mirrored ? 2 * fpx - ev.x : ev.x;
          effects.addBurst(bx, ev.y);
          // The director already knows exactly who was caught in the snap
          if (ev.hitHogfish && fishRef.current) fishRef.current.spit({ x: bx, y: ev.y });
          if (ev.hitGoby && gobyRef.current) gobyRef.current.spit({ x: bx, y: ev.y });
        }
      }
      effects.renderBursts(ctx, dt);

      // --- Active client drives cleaning targets + UI ---
      const active = activeSlot;

      if (active && onParasiteStatsUpdate && time - lastStatsSyncRef.current > 150) {
        lastStatsSyncRef.current = time;
        onParasiteStatsUpdate(active.fish.getParasiteStats());
      }

      // Throttled: this feeds React state, and re-rendering the overlay every
      // frame is wasted work
      if (onClientFishUpdate && time - lastInfoSyncRef.current > 150) {
        lastInfoSyncRef.current = time;
        if (active) {
          const metadata = SPECIES[active.species];
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

      // Cleaner AI: what the on-duty and off-duty cleaners should work this frame
      const playerIdle = time - lastPointerTsRef.current > 25000;
      const { autoTargets, queueTargets } = computeCleanerTargets({ director, active, playerIdle });

      // Nibble juice: a soft green pop for every parasite eaten
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
          effects.addBurst(x, y, { mini: true });
          playNibbleSound();
        }
        eatSeenRef.current = { slot: active, ids: seen };
      }

      // Duty cycle: each auto cleaner works ~12s then drifts off ~8s,
      // offset so the two rarely rest at the same time
      const tSec = time / 1000;
      const hogfishWorking = tSec % 20 < 12;
      const gobyWorking = (tSec + 10) % 20 < 12;

      // --- 2. Sharknose Goby ---
      if (gobyRef.current) {
        const beat = hogfishSelected ? queueTargets : autoTargets;
        gobyRef.current.setCleaningSpots(gobyWorking ? beat : []);
        gobyRef.current.update(width, height, dt);
        gobyRef.current.render(ctx);
      }

      // --- 3. Cleaner Hogfish ---
      if (fishRef.current) {
        const beat = hogfishSelected ? autoTargets : queueTargets;
        fishRef.current.setCleaningSpots(hogfishWorking ? beat : []);
        fishRef.current.update(width, height, dt);
      }

      if (fishRef.current) {
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
    hogfishScale,
    hogfishSpeed,
    gobyScale,
    gobySpeed,
    onParasiteStatsUpdate,
    onClientFishUpdate,
  ]);

  return (
    <div
      ref={containerRef}
      id="fish-canvas-container"
      className="relative w-full h-full select-none overflow-hidden touch-none cursor-none"
      onPointerEnter={(e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true });
        }
      }}
    >
      <canvas
        ref={canvasRef}
        id="cleaner-hogfish-canvas"
        className="w-full h-full cursor-none"
        style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
      />

      {/* Custom Soothing Light Blue Pulsing Cursor */}
      {cursor.visible && (
        <div
          id="custom-soothing-cursor"
          className="pointer-events-none absolute z-40 w-[21px] h-[21px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.25px] border-sky-300/40 bg-transparent transition-opacity duration-150"
          style={{
            left: `${cursor.x}px`,
            top: `${cursor.y}px`,
            animation: 'cursorSoothingPulse 2.4s ease-in-out infinite',
          }}
        >
          {/* Subtle inner ambient ring */}
          <div className="absolute inset-0.5 rounded-full border border-cyan-200/15" />
        </div>
      )}
    </div>
  );
};

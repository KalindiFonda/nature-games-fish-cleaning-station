import { Grouper } from './Grouper';
import { QueenParrotfish } from './QueenParrotfish';
import { YellowtailGoatfish } from './YellowtailGoatfish';
import { QueenTriggerfish } from './QueenTriggerfish';
import { Trumpetfish } from './Trumpetfish';
import { SpottedMoray } from './SpottedMoray';
import { WhitespottedFilefish } from './WhitespottedFilefish';
import { FrenchGrunt } from './FrenchGrunt';
import { ClientFishSpecies, Vector2D, Parasite } from '../types';
import { SPECIES, ALL_SPECIES } from '../data/species';

export type ClientFish =
  | Grouper
  | QueenParrotfish
  | YellowtailGoatfish
  | QueenTriggerfish
  | Trumpetfish
  | SpottedMoray
  | WhitespottedFilefish
  | FrenchGrunt;

/**
 * Client traffic controller: one active client at the station plus a small
 * queue of waiting clients.
 *
 * The fish classes own their own animation (breath, fins, mouth) but the
 * director owns their position, scale and alpha: it stamps `pos` over the
 * fish after every update(). The moray is the exception - its native
 * emerge/retract from the reef crevice is exactly the entrance/exit we want,
 * so it keeps its own state machine and only switches between a half-emerged
 * "queue" pose and a fully-emerged "active" pose.
 *
 * Flow: clients spawn into the queue. A client reaches the station either
 * because the player invited it (invite(), after the cleaner's little dance)
 * or because the station sat empty for a couple of seconds (auto-promote).
 * A client leaves the station when it is fully cleaned or when its patience
 * runs out. If another client is invited over it, a client that still
 * carries parasites goes back to the queue when a spot is free; otherwise
 * it swims off. Leftover parasites are remembered for the next time that
 * species visits (only one fish per species is ever on screen).
 */

type Role = 'active' | 'waiting';
type Phase = 'entering' | 'settled' | 'leaving';
export type LeaveReason = 'cleaned' | 'impatient' | 'skipped';

export interface Cavity {
  open: number; // 0 closed .. 1 fully open
  composure: number; // drains while a cleaner works the zone; 0 = clamp
  lock: number; // seconds the zone stays clamped shut
  wiggle: number; // 0..1 warning intensity shortly before a clamp
  // Fixed anatomical position of the zone relative to fish.pos (unmirrored),
  // computed once at spawn - the flap is anatomy, it never moves or vanishes
  anchorLocal: Vector2D | null;
}

const freshCavity = (): Cavity => ({
  open: 0,
  composure: 1,
  lock: 0,
  wiggle: 0,
  anchorLocal: null,
});

const COMPOSURE_SECONDS = 7; // how long a zone tolerates being worked
const COMPOSURE_RECOVERY = 4; // seconds to fully recover once left alone
const CLAMP_LOCK_SECONDS = 4;
// Hysteresis: a cavity opens when a cleaner comes this close...
const CAVITY_REACH = 75;
// ...but once open it stays open within this much larger radius, so normal
// hover jitter doesn't slam it shut
const CAVITY_REACH_HOLD = 140;

export interface ClientSlot {
  fish: ClientFish;
  species: ClientFishSpecies;
  role: Role;
  phase: Phase;
  leaveReason: LeaveReason | null;
  pos: Vector2D; // director-owned position (except moray)
  target: Vector2D;
  baseScale: number; // species' natural full scale
  displayScale: number; // lerped: shrinks when waiting in the background
  targetScale: number;
  alpha: number;
  targetAlpha: number;
  patience: number;
  patienceMax: number;
  lastRemoved: number; // parasite-removed count last frame (for top-ups)
  bobPhase: number;
  waitSpot: number; // index into wait spots, -1 when active
  shimmyT: number; // happy-shimmy timer when leaving fully cleaned
  exitVel: number;
  ageSec: number;
  lastSpeed: number; // px/frame moved last frame; drives swim weave + tail beat
  // Scale/alpha transition anchors: set when a fish is sent to a new post so
  // growth/brightening track travel progress instead of elapsed time
  transFromScale: number;
  transFromAlpha: number;
  transDist: number;
  // Delicate-zone state: the gill flap and the mouth each open for a nearby
  // cleaner, tolerate it for a while (composure), telegraph with a wiggle,
  // then clamp shut for a few seconds.
  cavGill: Cavity;
  cavMouth: Cavity;
  joltT: number; // clamp jolt animation timer
  perkT: number; // invited: a burst of fin flutter and a brightening
  // Mouth service (gaper species): opens when a cleaner arrives, tolerates
  // ~7s of work, flutter-warns, chomps, rests briefly, reopens on return
  mouthWork: number;
  mouthLock: number;
  // Mirrored fish face RIGHT (the canvas flips them); they enter from the
  // left, wait on the left, and exit rightward. Fixed for the fish's whole
  // visit so it never snap-flips mid-water. The moray is never mirrored.
  mirrored: boolean;
}

const MAX_WAITING = 3; // up to 3 waiting in queue spots
const WAIT_SCALE = 0.5; // waiting clients read as "further back"
const WAIT_ALPHA = 0.45;
const STATION_PATIENCE = 10; // seconds on the timer when a client reaches the station
const PATIENCE_TOPUP = 3; // seconds refunded per parasite eaten
const SHIMMY_SECONDS = 2.0; // celebration sparkle time - the fish stays put, glittering
const PERK_SECONDS = 1.0; // an invited client flutters its fins
const AUTO_PROMOTE_SECONDS = 5; // an empty station calls the next client over after this - time enough to pick one yourself
const EMPTY_QUEUE_SECONDS = 10; // the queue never stays empty longer than this

function createClientFish(species: ClientFishSpecies, w: number, h: number): ClientFish {
  switch (species) {
    case 'grouper':
      return new Grouper(w, h);
    case 'queen_parrotfish':
      return new QueenParrotfish(w, h);
    case 'yellowtail_goatfish':
      return new YellowtailGoatfish(w, h);
    case 'queen_triggerfish':
      return new QueenTriggerfish(w, h);
    case 'trumpetfish':
      return new Trumpetfish(w, h);
    case 'spotted_moray':
      return new SpottedMoray(w, h);
    case 'whitespotted_filefish':
      return new WhitespottedFilefish(w, h);
    case 'french_grunt':
      return new FrenchGrunt(w, h);
  }
}

export interface ClampEvent {
  x: number;
  y: number;
  hitHogfish: boolean;
  hitGoby: boolean;
}

export class ClientDirector {
  slots: ClientSlot[] = [];

  /** `firstSpecies` (dev/testing) puts that species at the front of the first deck. */
  constructor(firstSpecies: ClientFishSpecies | null = null) {
    if (firstSpecies) {
      this.deck = [firstSpecies, ...ALL_SPECIES.filter((s) => s !== firstSpecies).sort(() => Math.random() - 0.5)];
    }
  }
  onClientCleaned: (() => void) | null = null;
  /** True while the player is reading a field note: patience timers hold. */
  patiencePaused = false;

  // Clamp events (unmirrored coords) for the canvas: where to burst
  // bubbles, and exactly which cleaners got caught and must be spat out
  private clampEvents: ClampEvent[] = [];

  private deck: ClientFishSpecies[] = [];
  private spawnCooldown = 1.0; // first client arrives almost immediately
  private emptyQueueSec = 0;
  private emptyStationSec = 0;
  private time = 0;
  private savedParasites = new Map<ClientFishSpecies, Parasite[]>();
  // A player invitation in progress: the cleaner dances for a moment, then
  // the chosen client is promoted. Auto-promotion holds off meanwhile.
  private pendingInvite: { slot: ClientSlot; remainingSec: number } | null = null;

  drainClampEvents(): ClampEvent[] {
    const ev = this.clampEvents;
    this.clampEvents = [];
    return ev;
  }

  /** The client currently active at the station, if any. */
  active(): ClientSlot | null {
    return this.slots.find((s) => s.role === 'active' && s.phase !== 'leaving') ?? null;
  }

  /** Waiting clients that are actually parked (not still arriving or leaving). */
  private settledWaiting(): ClientSlot[] {
    return this.slots.filter((s) => s.role === 'waiting' && s.phase === 'settled');
  }

  /**
   * Player invitation: the current station client is sent away (back to the
   * queue if it still has parasites and there is room), and `slot` is
   * promoted once the cleaner's dance is over.
   */
  invite(slot: ClientSlot, delaySec: number, w: number, h: number) {
    if (slot.role !== 'waiting' || slot.phase === 'leaving') return;
    const current = this.active();
    if (current) this.demote(current, w, h);
    // The invited client flutters its fins; it brightens as it swims closer
    // (promote() blends alpha with travel progress)
    slot.perkT = PERK_SECONDS;
    this.pendingInvite = { slot, remainingSec: delaySec };
  }

  /** Find a waiting client near a given world point (cleaner head or mouse). */
  findWaitingClientNear(point: Vector2D): ClientSlot | null {
    let bestSlot: ClientSlot | null = null;
    let minDist = Infinity;
    for (const slot of this.slots) {
      if (slot.role !== 'waiting' || slot.phase === 'leaving') continue;
      const s = slot.displayScale;
      let fx = slot.fish.pos.x;
      let fy = slot.fish.pos.y;
      let rx = Math.max(90, 50 * s);
      let ry = Math.max(50, 30 * s);
      if (slot.species === 'spotted_moray') {
        const cosH = Math.cos(-0.32);
        const sinH = Math.sin(-0.32);
        fx += 28 * s * cosH;
        fy += 28 * s * sinH;
        rx = 110;
        ry = 80;
      } else if (slot.species === 'french_grunt') {
        // Group of 3 grunts covers a wider school area
        rx = Math.max(120, 65 * s);
        ry = Math.max(85, 48 * s);
      }
      const dx = point.x - fx;
      const dy = point.y - fy;
      const dNorm = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (dNorm <= 1.0) {
        const d = Math.hypot(dx, dy);
        if (d < minDist) {
          minDist = d;
          bestSlot = slot;
        }
      }
    }
    return bestSlot;
  }

  // ---------------------------------------------------------------------
  // Spawning and placement
  // ---------------------------------------------------------------------

  // Waiting spots sit above and AHEAD of where the fish will swim next, so
  // a promoted client always moves forward into service: spots 0-1 (upper
  // right) hold normal left-facing fish, spots 2-3 (upper left) hold
  // mirrored right-facing fish.
  private waitSpots(w: number, h: number): Vector2D[] {
    return [
      { x: w * 0.64, y: h * 0.14 },
      { x: w * 0.84, y: h * 0.19 },
      { x: w * 0.16, y: h * 0.14 },
      { x: w * 0.36, y: h * 0.19 },
    ];
  }

  private freeWaitSpot(exclude: ClientSlot | null, side: 'any' | 'left' | 'right'): number {
    const used = new Set(this.slots.filter((s) => s !== exclude).map((s) => s.waitSpot));
    const candidates = side === 'right' ? [0, 1] : side === 'left' ? [2, 3] : [0, 1, 2, 3];
    const free = candidates.filter((i) => !used.has(i));
    if (free.length === 0) return -1;
    return free[Math.floor(Math.random() * free.length)];
  }

  // Each client gets its own service spot: anchored off the species' art
  // formula (tail inside the right edge) but nudged left and up/down so the
  // station isn't glued to the same right-mid position every visit.
  private stationPos(
    species: ClientFishSpecies,
    baseScale: number,
    w: number,
    h: number,
    mirrored: boolean
  ): Vector2D {
    const st = SPECIES[species].station;
    const anchor = st.C * baseScale + st.K + Math.random() * w * 0.14;
    return {
      // Clamped toward center so the station always sits FORWARD of the
      // waiting spots - a promoted fish never has to swim backwards.
      x: mirrored ? Math.max(anchor, w * 0.42) : Math.min(w - anchor, w * 0.58),
      y: h * (st.y + (Math.random() - 0.5) * 0.24),
    };
  }

  private drawSpecies(): ClientFishSpecies | null {
    if (this.deck.length === 0) {
      this.deck = [...ALL_SPECIES].sort(() => Math.random() - 0.5);
    }
    const onScreen = new Set(this.slots.map((s) => s.species));
    for (let i = 0; i < this.deck.length; i++) {
      const sp = this.deck[i];
      if (onScreen.has(sp)) continue;
      this.deck.splice(i, 1);
      return sp;
    }
    return null;
  }

  // Entries always start off the RIGHT edge in a horizontal lane near the
  // destination height, so the left-facing body swims in level - the lane
  // varies per fish (higher, lower) for arrival variety, and the vertical
  // remainder is closed gently after the fish is on screen.
  private entryPoint(w: number, h: number, target: Vector2D, mirrored: boolean): Vector2D {
    const lane = target.y + (Math.random() - 0.5) * h * 0.5;
    return {
      x: mirrored
        ? Math.min(target.x - 400, -250) - Math.random() * 200
        : Math.max(target.x + 400, w + 250) + Math.random() * 200,
      y: Math.min(h * 0.85, Math.max(h * 0.08, lane)),
    };
  }

  private spawn(w: number, h: number) {
    const waitingSlots = this.slots.filter((s) => s.role === 'waiting' && s.phase !== 'leaving');
    if (waitingSlots.length >= MAX_WAITING) return;

    const species = this.drawSpecies();
    if (!species) return;

    const info = SPECIES[species];
    const fish = createClientFish(species, w, h);
    const baseScale = fish.scale;
    const isMoray = species === 'spotted_moray';

    // Fixed cavity anchors from the species' FULL parasite layout - computed
    // before any saved (half-cleaned) layout replaces it, so the gill flap and
    // mouth are still there on a return visit even if their parasites are gone
    const anchorFor = (match: (ap: string) => boolean): Vector2D | null => {
      let cx = 0;
      let cy = 0;
      let n = 0;
      for (const par of fish.parasites) {
        if (!match(par.attachPart)) continue;
        const lp = fish.getParasiteLocalPos(par);
        cx += lp.x;
        cy += lp.y;
        n++;
      }
      return n > 0 ? { x: cx / n, y: cy / n } : null;
    };
    const cavGill = freshCavity();
    cavGill.anchorLocal = anchorFor((ap) => ap === 'operculum');
    const cavMouth = freshCavity();
    cavMouth.anchorLocal = info.hasMouthCavity
      ? anchorFor((ap) => ap === 'upperTeeth' || ap === 'lowerTeeth')
      : null;

    // A species that left half-cleaned comes back half-cleaned (the grunt
    // school re-rolls its parasites across members instead)
    const saved = species !== 'french_grunt' ? this.savedParasites.get(species) : undefined;
    if (saved && saved.length > 0) {
      fish.parasites = saved.map((p, idx) => ({
        ...p,
        id: idx + 1,
        removed: false,
        hoverTimer: 0,
      }));
    }

    if (isMoray) {
      const moray = fish as SpottedMoray;
      moray.setMode('queue');
      if (!saved || saved.length === 0) {
        // The moray's rear body trails behind the reef wall; drop parasites
        // that would render hidden inside the rock (same slope geometry as
        // Reef.render: ridge from (0, 0.68h) descending 30° to the floor).
        const startY = h * 0.68;
        const bottomX = (h - startY) * 1.732;
        moray.parasites = moray.parasites.filter((p) => {
          const lp = moray.getParasiteLocalPos(p);
          const x = moray.targetPos.x + lp.x;
          const y = moray.targetPos.y + lp.y;
          const ridgeY = startY + (h - startY) * (x / bottomX) - 14;
          return !(x < bottomX && y > ridgeY);
        });
      }
    }

    // The moray waits half-emerged in its crevice; everyone else takes a
    // wait spot in open water and swims in from off screen
    let waitSpot = -1;
    let mirrored = false;
    let pos = { ...fish.pos };
    let target = { ...fish.pos };
    if (!isMoray) {
      waitSpot = Math.max(0, this.freeWaitSpot(null, 'any'));
      mirrored = waitSpot >= 2;
      target = this.waitSpots(w, h)[waitSpot];
      pos = this.entryPoint(w, h, target, mirrored);
    }
    const startScale = isMoray ? baseScale : baseScale * WAIT_SCALE;
    const startAlpha = isMoray ? WAIT_ALPHA : 0.4;

    this.slots.push({
      fish,
      species,
      role: 'waiting',
      phase: 'entering',
      leaveReason: null,
      pos,
      target,
      baseScale,
      displayScale: startScale,
      targetScale: startScale,
      alpha: startAlpha,
      targetAlpha: WAIT_ALPHA,
      patience: info.patience,
      patienceMax: info.patience,
      lastRemoved: 0,
      bobPhase: Math.random() * Math.PI * 2,
      waitSpot,
      shimmyT: 0,
      exitVel: 0,
      ageSec: 0,
      lastSpeed: 0,
      mirrored,
      transFromScale: startScale,
      transFromAlpha: startAlpha,
      transDist: 0,
      cavGill,
      cavMouth,
      joltT: 0,
      perkT: 0,
      mouthWork: 0,
      mouthLock: 0,
    });
  }

  // ---------------------------------------------------------------------
  // Role transitions
  // ---------------------------------------------------------------------

  private beginLeave(slot: ClientSlot, reason: LeaveReason) {
    if (slot.phase === 'leaving') return;
    slot.phase = 'leaving';
    slot.leaveReason = reason;
    slot.shimmyT = reason === 'cleaned' ? SHIMMY_SECONDS : 0;
    slot.exitVel = 1.2;
    if (slot.species === 'spotted_moray' && slot.shimmyT <= 0) {
      slot.fish.startExit(); // native retract into the crevice
    }
    if (reason === 'cleaned' && slot.role === 'active' && this.onClientCleaned) {
      this.onClientCleaned();
    }
    if (this.pendingInvite?.slot === slot) this.pendingInvite = null;

    // Remember leftover parasites for this species' next visit
    const stats = slot.fish.getParasiteStats();
    if (stats.remaining > 0 && slot.species !== 'french_grunt') {
      this.savedParasites.set(
        slot.species,
        slot.fish.parasites.filter((p) => !p.removed).map((p) => ({ ...p, hoverTimer: 0 }))
      );
    } else {
      this.savedParasites.delete(slot.species);
    }
  }

  private promote(slot: ClientSlot, w: number, h: number) {
    // Invariant: only one fish is active at the station
    for (const s of this.slots) {
      if (s !== slot && s.role === 'active' && s.phase !== 'leaving') this.demote(s, w, h);
    }
    slot.role = 'active';
    slot.waitSpot = -1;
    if (slot.species === 'spotted_moray') {
      const moray = slot.fish as SpottedMoray;
      moray.setMode('active');
      slot.target = { ...moray.targetPos };
      slot.targetScale = slot.baseScale;
      slot.targetAlpha = 1;
      slot.phase = 'entering';
    } else {
      slot.target = this.stationPos(slot.species, slot.baseScale, w, h, slot.mirrored);
      slot.targetScale = slot.baseScale;
      slot.targetAlpha = 1;
      slot.transFromScale = slot.displayScale;
      slot.transFromAlpha = slot.alpha;
      slot.transDist = Math.hypot(slot.target.x - slot.pos.x, slot.target.y - slot.pos.y);
      if (slot.phase === 'settled') slot.phase = 'entering';
    }
    slot.patience = STATION_PATIENCE;
    slot.patienceMax = STATION_PATIENCE;
    slot.lastRemoved = slot.fish.getParasiteStats().removed;
  }

  /**
   * Bump the active client off the station because another client was
   * invited. If it still has parasites and a wait spot on its own side is
   * free it rejoins the queue; otherwise it swims off (its leftover
   * parasites are remembered by beginLeave).
   */
  private demote(slot: ClientSlot, w: number, h: number) {
    const stats = slot.fish.getParasiteStats();
    if (stats.remaining === 0) {
      this.beginLeave(slot, 'cleaned');
      return;
    }
    const isMoray = slot.species === 'spotted_moray';
    const spot = isMoray ? -1 : this.freeWaitSpot(slot, slot.mirrored ? 'left' : 'right');
    if (!isMoray && spot === -1) {
      this.beginLeave(slot, 'impatient');
      return;
    }
    slot.role = 'waiting';
    slot.waitSpot = spot;
    slot.patience = SPECIES[slot.species].patience;
    slot.patienceMax = slot.patience;
    slot.lastRemoved = stats.removed;
    slot.mouthWork = 0;
    slot.mouthLock = 0;
    if (isMoray) {
      (slot.fish as SpottedMoray).setMode('queue');
      slot.targetAlpha = WAIT_ALPHA;
      slot.phase = 'entering';
    } else {
      slot.target = this.waitSpots(w, h)[spot];
      slot.targetScale = slot.baseScale * WAIT_SCALE;
      slot.targetAlpha = WAIT_ALPHA;
      slot.transFromScale = slot.displayScale;
      slot.transFromAlpha = slot.alpha;
      slot.transDist = Math.hypot(slot.target.x - slot.pos.x, slot.target.y - slot.pos.y);
      slot.phase = 'entering';
    }
  }

  // ---------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------

  private updateCavity(
    slot: ClientSlot,
    cav: Cavity,
    rHogfish: Vector2D | null,
    rGoby: Vector2D | null,
    dtSec: number,
    dt: number
  ) {
    const fish = slot.fish;
    if (!cav.anchorLocal) return;
    const anchor = { x: fish.pos.x + cav.anchorLocal.x, y: fish.pos.y + cav.anchorLocal.y };
    const cleanerMouths = [rHogfish, rGoby].filter((m): m is Vector2D => m !== null);

    const reach = cav.open > 0.5 ? CAVITY_REACH_HOLD : CAVITY_REACH;
    const near = cleanerMouths.some((m) => Math.hypot(m.x - anchor.x, m.y - anchor.y) < reach);

    if (cav.lock > 0) {
      cav.lock -= dtSec;
      cav.open += (0 - cav.open) * Math.min(1, 0.3 * dt);
      cav.wiggle = 0;
      if (cav.lock <= 0) cav.composure = 0.7; // reopens warier, not fresh
      return;
    }

    cav.open += ((near ? 1 : 0) - cav.open) * Math.min(1, 0.06 * dt);
    const working = near && cav.open > 0.5;
    cav.composure = Math.max(
      0,
      Math.min(1, cav.composure + (working ? -dtSec / COMPOSURE_SECONDS : dtSec / COMPOSURE_RECOVERY))
    );
    cav.wiggle =
      working && cav.composure < 0.35
        ? (0.35 - cav.composure) / 0.35
        : Math.max(0, cav.wiggle - dtSec * 3);

    if (working && cav.composure <= 0) {
      cav.lock = CLAMP_LOCK_SECONDS;
      cav.wiggle = 0;
      // Only a cleaner actually at the flap gets caught in the snap (the
      // wider hold radius just keeps the flap open against hover jitter)
      const caught = (m: Vector2D | null) =>
        !!m && Math.hypot(m.x - anchor.x, m.y - anchor.y) < CAVITY_REACH;
      this.clampEvents.push({ ...anchor, hitHogfish: caught(rHogfish), hitGoby: caught(rGoby) });
    }
  }

  update(
    w: number,
    h: number,
    dt: number, // ~1 per 60th of a second (the app's frame unit)
    hogfishMouth: Vector2D | null,
    gobyMouth: Vector2D | null,
    hogfishScale: number,
    gobyScale: number,
    autoMouth: Vector2D | null = null, // the OTHER cleaner - preps the queue
    autoScale: number = 0.65
  ) {
    const dtSec = dt / 60;
    this.time += dtSec;

    // --- spawning & empty-queue guarantee ---
    const waitingCount = this.slots.filter(
      (s) => s.role === 'waiting' && s.phase !== 'leaving'
    ).length;
    this.emptyQueueSec = waitingCount === 0 ? this.emptyQueueSec + dtSec : 0;
    this.spawnCooldown -= dtSec;
    const forceSpawn = waitingCount === 0 && this.emptyQueueSec >= EMPTY_QUEUE_SECONDS;
    if ((this.spawnCooldown <= 0 || forceSpawn) && waitingCount < MAX_WAITING) {
      this.spawn(w, h);
      this.spawnCooldown = 4 + Math.random() * 5;
      this.emptyQueueSec = 0;
    }

    // --- station: a pending invitation, or auto-call after a short empty spell ---
    if (this.pendingInvite) {
      this.pendingInvite.remainingSec -= dtSec;
      if (this.pendingInvite.remainingSec <= 0) {
        const { slot } = this.pendingInvite;
        this.pendingInvite = null;
        if (slot.role === 'waiting' && slot.phase !== 'leaving') this.promote(slot, w, h);
      }
      this.emptyStationSec = 0;
    } else if (this.slots.some((s) => s.phase === 'leaving' && s.shimmyT > 0)) {
      // Let a cleaned client finish its sparkle before anyone is called over
      this.emptyStationSec = 0;
    } else if (!this.active()) {
      this.emptyStationSec += dtSec;
      if (this.emptyStationSec >= AUTO_PROMOTE_SECONDS) {
        const next = this.settledWaiting().sort((a, b) => b.ageSec - a.ageSec)[0];
        if (next) {
          this.promote(next, w, h);
          this.emptyStationSec = 0;
        }
      }
    } else {
      this.emptyStationSec = 0;
    }

    for (const slot of this.slots) {
      const { fish } = slot;
      const isMoray = slot.species === 'spotted_moray';
      slot.ageSec += dtSec;
      slot.bobPhase += 1.4 * dtSec;

      // Depth illusion + fades
      // Growth/brightening track travel progress: the fish is exactly as
      // big as its journey is complete, reaching full size on arrival.
      if (slot.phase === 'entering' && slot.transDist > 1) {
        const d = Math.hypot(slot.target.x - slot.pos.x, slot.target.y - slot.pos.y);
        const raw = 1 - Math.min(1, d / slot.transDist);
        const prog = raw * raw * (3 - 2 * raw); // smoothstep
        slot.displayScale = slot.transFromScale + (slot.targetScale - slot.transFromScale) * prog;
        slot.alpha = slot.transFromAlpha + (slot.targetAlpha - slot.transFromAlpha) * prog;
      } else {
        slot.displayScale += (slot.targetScale - slot.displayScale) * Math.min(1, 0.04 * dt);
        slot.alpha += (slot.targetAlpha - slot.alpha) * Math.min(1, 0.05 * dt);
      }
      if (!isMoray) fish.scale = slot.displayScale;

      // --- movement (director-owned, except the moray's native crevice rig) ---
      let moved = 0;
      if (slot.phase === 'leaving' && slot.shimmyT > 0) {
        // Happy pause on a fully-cleaned departure: sparkles glitter over the
        // fish while it stays put; then it swims away (or retracts).
        slot.shimmyT -= dtSec;
        if (isMoray && slot.shimmyT <= 0) slot.fish.startExit();
      } else if (slot.phase === 'leaving') {
        if (!isMoray) {
          // Forward exit: a smooth accelerating swim off screen
          slot.exitVel = Math.min(4.8, slot.exitVel + 0.035 * dt);
          slot.pos.x += (slot.mirrored ? 1 : -1) * slot.exitVel * dt;
          slot.pos.y += Math.sin(slot.bobPhase * 0.5) * 0.15 * dt;
          moved = slot.exitVel * dt;
        }
      } else {
        // Ease toward post - horizontally faster than vertically while
        // entering, so arrivals read as level swimming with a gentle rise or
        // sink onto the spot, plus soft buoyancy once settled
        const entering = slot.phase === 'entering';
        const kx = Math.min(1, (entering ? 0.028 : 0.05) * dt);
        const ky = Math.min(1, (entering ? 0.014 : 0.05) * dt);
        // Waiting clients patrol slowly around their spot instead of
        // hovering frozen: a wide, slow horizontal drift with a slight rise
        // and fall (~20s loop, offset per spot so they don't sync up).
        const patrol = slot.role === 'waiting' && !entering;
        const wx = patrol ? Math.sin(slot.bobPhase * 0.22 + slot.waitSpot * 2.4) * 46 : 0;
        const wy = patrol ? Math.sin(slot.bobPhase * 0.15 + slot.waitSpot * 1.7) * 14 : 0;
        const dx = (slot.target.x + wx - slot.pos.x) * kx;
        const dy = (slot.target.y + wy - slot.pos.y) * ky;
        slot.pos.x += dx;
        slot.pos.y += dy;
        moved = Math.hypot(dx, dy);
        if (slot.phase === 'entering') {
          const morayParked = isMoray && (fish as SpottedMoray).state === 'stationary';
          const arrived =
            !isMoray && Math.hypot(slot.target.x - slot.pos.x, slot.target.y - slot.pos.y) < 6;
          if (arrived || morayParked) {
            slot.phase = 'settled';
            if (slot.role === 'active') {
              slot.patience = STATION_PATIENCE;
              slot.patienceMax = STATION_PATIENCE;
              slot.lastRemoved = slot.fish.getParasiteStats().removed;
            }
          }
        }
      }
      slot.lastSpeed = dt > 0 ? moved / dt : 0;

      // Advance the fish's internal animation (breath, fins, mouth, moray extension)
      fish.update(w, h, dt);
      if (!isMoray && slot.lastSpeed > 1.2 && slot.phase !== 'leaving') {
        fish.update(w, h, dt * 0.4);
      }
      if (!isMoray) {
        // Idle bob while parked - waiting clients ride the water visibly,
        // the active client more gently (it's being worked on).
        const bob =
          slot.phase === 'settled'
            ? Math.sin(slot.bobPhase * 0.9) * (slot.role === 'waiting' ? 6 : 3.5)
            : 0;
        fish.pos.x = slot.pos.x + (slot.phase === 'settled' ? Math.cos(slot.bobPhase * 0.55) * 2 : 0);
        fish.pos.y = slot.pos.y + bob;
        // Invited: fins flutter fast for a moment
        if (slot.perkT > 0) {
          const k = Math.sin((slot.perkT / PERK_SECONDS) * Math.PI);
          fish.finPhase += 0.35 * k * dt;
          slot.perkT -= dtSec;
        }
        // Clamp jolt: a quick indignant full-body shudder
        if (slot.joltT > 0) {
          const k = slot.joltT / 0.55;
          fish.pos.x += Math.sin(slot.joltT * 60) * 12 * k;
          fish.pos.y += Math.sin(slot.joltT * 47) * 5 * k;
          slot.joltT -= dtSec;
        }
      } else {
        slot.pos.x = fish.pos.x;
        slot.pos.y = fish.pos.y;
      }

      // --- service: only the active client can be cleaned ---
      if (slot.role === 'active' && slot.phase !== 'leaving') {
        this.serviceActive(slot, hogfishMouth, gobyMouth, hogfishScale, gobyScale, dt, dtSec);
      } else {
        // Not being serviced: gill flap rests closed
        fish.gillOpen = 0;
      }

      // --- waiting clients: patience drains; the off-duty cleaner may pre-clean ---
      if (slot.role === 'waiting' && slot.phase !== 'leaving') {
        if (autoMouth && slot.phase === 'settled') {
          const rAuto = slot.mirrored
            ? { x: 2 * fish.pos.x - autoMouth.x, y: autoMouth.y }
            : autoMouth;
          fish.updateParasites(rAuto, null, dt, autoScale, autoScale);
          const wStats = fish.getParasiteStats();
          if (wStats.removed > slot.lastRemoved) {
            slot.patience = Math.min(
              slot.patienceMax,
              slot.patience + (wStats.removed - slot.lastRemoved) * PATIENCE_TOPUP
            );
          }
          slot.lastRemoved = wStats.removed;
        }
        if (slot.phase === 'settled' && !this.patiencePaused) slot.patience -= dtSec;
        if (slot.patience <= 0) this.beginLeave(slot, 'impatient');
      }
    }

    // --- despawn: fully off screen (or moray fully retracted) ---
    this.slots = this.slots.filter((slot) => {
      if (slot.species === 'spotted_moray') {
        return !(slot.phase === 'leaving' && (slot.fish.state === 'exited' || !slot.fish.isVisible));
      }
      const offscreen = slot.mirrored ? slot.pos.x > w + 450 : slot.pos.x < -450;
      return !(slot.phase === 'leaving' && slot.shimmyT <= 0 && offscreen);
    });
  }

  /** Cleaning, delicate zones, patience and departure for the station client. */
  private serviceActive(
    slot: ClientSlot,
    hogfishMouth: Vector2D | null,
    gobyMouth: Vector2D | null,
    hogfishScale: number,
    gobyScale: number,
    dt: number,
    dtSec: number
  ) {
    const { fish } = slot;
    const info = SPECIES[slot.species];

    // A mirrored fish is drawn flipped around its own x, so reflect the
    // cleaner mouths into its unflipped coordinate space for eat checks.
    const reflect = (m: Vector2D | null): Vector2D | null =>
      m && slot.mirrored ? { x: 2 * fish.pos.x - m.x, y: m.y } : m;

    // Anchor the delicate zones on the artist's own anatomy spots (the
    // drawn gill line / mouth) when the species defines them; the
    // spawn-time parasite centroid stays as the fallback.
    const spots = fish.getCleaningStationSpots();
    const bySpot = (re: RegExp): Vector2D | null => {
      const sp = spots.find((q) => re.test(q.id) || re.test(q.name));
      return sp ? { x: sp.pos.x - fish.pos.x, y: sp.pos.y - fish.pos.y } : null;
    };
    slot.cavGill.anchorLocal = bySpot(/gill|opercul/i) ?? slot.cavGill.anchorLocal;
    if (info.hasMouthCavity) {
      slot.cavMouth.anchorLocal = bySpot(/mouth|beak|oral/i) ?? slot.cavMouth.anchorLocal;
    }

    const rHogfish = reflect(hogfishMouth);
    const rGoby = reflect(gobyMouth);
    const mouths = [rHogfish, rGoby].filter((m): m is Vector2D => m !== null);

    // Gill flap: opens for a nearby cleaner, wears out (composure), telegraphs, clamps
    this.updateCavity(slot, slot.cavGill, rHogfish, rGoby, dtSec, dt);

    // Mouth service: a gaper opens as soon as a cleaner arrives at its
    // mouth and holds open while worked (~7s), flutters a warning, then
    // chomps (spit if you linger), rests ~3s, and reopens on return.
    if (info.hasMouthCavity && slot.phase === 'settled' && slot.cavMouth.anchorLocal) {
      const ma = {
        x: fish.pos.x + slot.cavMouth.anchorLocal.x,
        y: fish.pos.y + slot.cavMouth.anchorLocal.y,
      };
      const reach = slot.cavMouth.open > 0.5 ? CAVITY_REACH_HOLD : CAVITY_REACH;
      const nearMouth = mouths.some((m) => Math.hypot(m.x - ma.x, m.y - ma.y) < reach);
      let target = 0;
      if (slot.mouthLock > 0) {
        slot.mouthLock -= dtSec;
        slot.cavMouth.wiggle = 0;
        slot.mouthWork = 0;
      } else if (nearMouth) {
        target = 1;
        if (slot.cavMouth.open > 0.5) slot.mouthWork += dtSec;
        slot.cavMouth.wiggle = slot.mouthWork > 5.5 ? Math.min(1, (slot.mouthWork - 5.5) / 1.5) : 0;
        if (slot.mouthWork >= 7) {
          slot.mouthLock = 3;
          slot.mouthWork = 0;
          slot.cavMouth.wiggle = 0;
          slot.joltT = 0.4;
          const inMouth = (m: Vector2D | null) => !!m && Math.hypot(m.x - ma.x, m.y - ma.y) < 55;
          if (inMouth(rHogfish) || inMouth(rGoby)) {
            this.clampEvents.push({ ...ma, hitHogfish: inMouth(rHogfish), hitGoby: inMouth(rGoby) });
          }
        }
      } else {
        slot.cavMouth.wiggle = 0;
        slot.mouthWork = Math.max(0, slot.mouthWork - dtSec * 1.5);
      }
      slot.cavMouth.open += (target - slot.cavMouth.open) * Math.min(1, 0.12 * dt);
    }

    fish.gillOpen = slot.cavGill.lock > 0 ? 0 : slot.cavGill.open;
    // Small mouths: lip parasites always reachable, no gape/clamp
    fish.mouthGate = info.hasMouthCavity ? slot.cavMouth.open : 1;
    // The grouper animates its own drawn operculum, wiggle included
    if (fish instanceof Grouper) fish.gillWiggle = slot.cavGill.wiggle;
    if (info.hasMouthCavity && !(fish instanceof FrenchGrunt)) {
      // The mouth visibly gapes for service, flutters as the clamp warning,
      // and snaps near-shut while locked. Blend toward a steady per-species
      // gape instead of multiplying the breathing cycle.
      const flutter =
        slot.cavMouth.wiggle > 0 ? Math.sin(this.time * 24) * 0.09 * slot.cavMouth.wiggle : 0;
      const o = Math.min(1, slot.cavMouth.open * 1.15);
      fish.mouthAperture = fish.mouthAperture * (1 - o) + info.gapeTarget * o + flutter;
    }

    fish.updateParasites(rHogfish, rGoby, dt, hogfishScale, gobyScale);
    const stats = fish.getParasiteStats();

    // Every parasite eaten buys the client a few more seconds
    if (stats.removed > slot.lastRemoved) {
      slot.patience += (stats.removed - slot.lastRemoved) * PATIENCE_TOPUP;
      slot.patienceMax = Math.max(slot.patienceMax, slot.patience);
    }
    slot.lastRemoved = stats.removed;

    if (slot.phase === 'settled' && !this.patiencePaused) slot.patience -= dtSec;

    if (stats.remaining === 0) {
      this.beginLeave(slot, 'cleaned');
    } else if (slot.patience <= 0) {
      this.beginLeave(slot, 'impatient');
    }
  }

  /** Render lists: the moray draws behind the reef; everyone else in front,
   * small (far) fish before large (near) ones. */
  renderLists(): { behindReef: ClientSlot[]; openWater: ClientSlot[] } {
    const behindReef: ClientSlot[] = [];
    const openWater: ClientSlot[] = [];
    for (const s of this.slots) {
      if (s.species === 'spotted_moray') behindReef.push(s);
      else openWater.push(s);
    }
    openWater.sort((a, b) => a.displayScale / a.baseScale - b.displayScale / b.baseScale);
    return { behindReef, openWater };
  }
}

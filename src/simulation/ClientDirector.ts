import { Grouper } from './Grouper';
import { QueenParrotfish } from './QueenParrotfish';
import { YellowtailGoatfish } from './YellowtailGoatfish';
import { QueenTriggerfish } from './QueenTriggerfish';
import { Trumpetfish } from './Trumpetfish';
import { SpottedMoray } from './SpottedMoray';
import { WhitespottedFilefish } from './WhitespottedFilefish';
import { FrenchGrunt } from './FrenchGrunt';
import { ClientFishSpecies, Vector2D, Parasite } from '../types';

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
 * Reef-mode client traffic controller.
 *
 * The fish classes were written to own the whole tank: they overwrite their
 * `targetPos` from canvas size on every update() and their built-in exit
 * reverses out to the right. So the director drives each fish by overwriting
 * its public `pos` (and `scale`) AFTER update() runs — update() still
 * advances breathing/fin/mouth animation — and never calls startExit().
 * The one exception is the moray, whose native emerge/retract from the reef
 * crevice is exactly the entrance/exit we want; it keeps its own state
 * machine and is only ever an active client (its home is fixed to the reef).
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
// hover jitter doesn't slam it shut (cleaning-station's hard-won lesson)
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
  promoteHold: number; // seconds a cleaner has lingered on a waiting client
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
  // Mouth service (gaper species): opens when a cleaner arrives, tolerates
  // ~7s of work, flutter-warns, chomps, rests briefly, reopens on return
  mouthWork: number;
  mouthLock: number;
  // Mirrored fish face RIGHT (the canvas flips them); they enter from the
  // left, wait on the left, and exit rightward. Fixed for the fish's whole
  // visit so it never snap-flips mid-water. The moray is never mirrored.
  mirrored: boolean;
}

// Station parking: x = width - (C * scale + K), matching each class's own
// getProfileTargetX so the fish parks exactly where its art expects.
const STATION: Record<ClientFishSpecies, { C: number; K: number; y: number }> = {
  grouper: { C: 95, K: 24, y: 0.5 },
  queen_parrotfish: { C: 99, K: 24, y: 0.48 },
  queen_triggerfish: { C: 109, K: 24, y: 0.48 },
  yellowtail_goatfish: { C: 97, K: 24, y: 0.48 },
  french_grunt: { C: 64, K: 30, y: 0.47 },
  whitespotted_filefish: { C: 70, K: 30, y: 0.47 },
  trumpetfish: { C: 105, K: 24, y: 0.48 },
  spotted_moray: { C: 0, K: 0, y: 0 }, // unused: moray anchors to its crevice
};

const ALL_SPECIES: ClientFishSpecies[] = [
  'grouper',
  'queen_parrotfish',
  'yellowtail_goatfish',
  'queen_triggerfish',
  'trumpetfish',
  'spotted_moray',
  'whitespotted_filefish',
  'french_grunt',
];

const MAX_WAITING = 3; // up to 3 waiting in queue spots
const WAIT_SCALE = 0.5; // waiting clients read as "further back"
const WAIT_ALPHA = 0.45;
const PATIENCE_TOPUP = 3; // seconds refunded per parasite eaten (partial)

// Reef-mode temperaments (relaxed cousins of cleaning-station's tuning):
// big predators wait calmly, twitchy reef fish drift off sooner.
const SPECIES_PATIENCE: Record<ClientFishSpecies, number> = {
  grouper: 60,
  spotted_moray: 70,
  whitespotted_filefish: 50,
  queen_parrotfish: 45,
  yellowtail_goatfish: 45,
  trumpetfish: 40,
  french_grunt: 40,
  queen_triggerfish: 35,
};
// Absolute mouthAperture when fully gaping for a cleaner (resting values
// run ~0.65-0.92; the trumpetfish's tiny terminal mouth needs the most help)
const GAPE_TARGET: Record<ClientFishSpecies, number> = {
  grouper: 2.0,
  queen_parrotfish: 1.6,
  queen_triggerfish: 1.6,
  yellowtail_goatfish: 1.6,
  french_grunt: 1.9,
  whitespotted_filefish: 1.8,
  trumpetfish: 2.3,
  spotted_moray: 1.9,
};
// Only big-mouthed gapers hold their mouth open for a cleaner (and clamp);
// small puckered mouths get their lips picked from outside, ungated.
const MOUTH_CAVITY_SPECIES = new Set<ClientFishSpecies>([
  'grouper',
  'spotted_moray',
  'french_grunt',
]);
const PROMOTE_HOLD = 0.7; // seconds a cleaner must linger to call a client over
const SHIMMY_SECONDS = 2.6; // Doubled celebration sparkle time - fish stays in place celebrating

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

export class ClientDirector {
  slots: ClientSlot[] = [];
  onClientCleaned: (() => void) | null = null;
  public patiencePaused: boolean = false;
  // Clamp events (unmirrored coords) for the canvas: where to burst
  // bubbles, and exactly which cleaners got caught and must be spat out
  private clampEvents: { x: number; y: number; hitWrasse: boolean; hitGoby: boolean }[] = [];

  drainClampEvents(): { x: number; y: number; hitWrasse: boolean; hitGoby: boolean }[] {
    const ev = this.clampEvents;
    this.clampEvents = [];
    return ev;
  }

  private updateCavity(
    slot: ClientSlot,
    cav: Cavity,
    rWrasse: Vector2D | null,
    rGobi: Vector2D | null,
    dtSec: number,
    dt: number
  ) {
    const fish = slot.fish;
    if (!cav.anchorLocal) return;
    const anchor = { x: fish.pos.x + cav.anchorLocal.x, y: fish.pos.y + cav.anchorLocal.y };
    const cleanerMouths = [rWrasse, rGobi].filter((m): m is Vector2D => m !== null);

    const reach = cav.open > 0.5 ? CAVITY_REACH_HOLD : CAVITY_REACH;
    const near = cleanerMouths.some(
      (m) => Math.hypot(m.x - anchor.x, m.y - anchor.y) < reach
    );

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
    cav.wiggle = working && cav.composure < 0.35 ? (0.35 - cav.composure) / 0.35 : Math.max(0, cav.wiggle - dtSec * 3);

    if (working && cav.composure <= 0) {
      cav.lock = CLAMP_LOCK_SECONDS;
      cav.wiggle = 0;
      const caught = (m: Vector2D | null) =>
        !!m && Math.hypot(m.x - anchor.x, m.y - anchor.y) < CAVITY_REACH_HOLD;
      this.clampEvents.push({
        ...anchor,
        hitWrasse: caught(rWrasse),
        hitGoby: caught(rGobi),
      });
    }
  }

  private deck: ClientFishSpecies[] = [];
  private spawnCooldown = 1.0; // first client arrives almost immediately
  private emptyQueueTimer = 0;
  private time = 0;
  private savedParasites = new Map<ClientFishSpecies, Parasite[]>();

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
    const st = STATION[species];
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

    const fish = createClientFish(species, w, h);
    const baseScale = fish.scale;
    const isMoray = species === 'spotted_moray';

    if (species === 'french_grunt') {
      this.savedParasites.delete('french_grunt');
    }
    const saved = species !== 'french_grunt' ? this.savedParasites.get(species) : undefined;
    if (saved && saved.length > 0) {
      fish.parasites = saved.map((p, idx) => ({
        ...p,
        id: idx + 1,
        removed: false,
        hoverTimer: 0,
      }));
    }

    // Helper for fixed cavity anchors from the species' full parasite layout
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

    if (isMoray) {
      const moray = fish as SpottedMoray;
      moray.setMode('queue');

      // The moray's rear body trails behind the reef wall; drop parasites
      // that would render hidden inside the rock (same slope geometry as
      // Reef.render: ridge from (0, 0.68h) descending 30° to the floor).
      if (!saved || saved.length === 0) {
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

      const cavGill = freshCavity();
      cavGill.anchorLocal = anchorFor((ap) => ap === 'operculum');
      const cavMouth = freshCavity();
      cavMouth.anchorLocal = anchorFor((ap) => ap === 'upperTeeth' || ap === 'lowerTeeth');

      this.slots.push({
        fish,
        species,
        role: 'waiting',
        phase: 'entering',
        leaveReason: null,
        pos: { ...fish.pos },
        target: { ...fish.pos },
        baseScale,
        displayScale: baseScale,
        targetScale: baseScale,
        alpha: WAIT_ALPHA,
        targetAlpha: WAIT_ALPHA,
        patience: SPECIES_PATIENCE[species],
        patienceMax: SPECIES_PATIENCE[species],
        lastRemoved: 0,
        bobPhase: Math.random() * Math.PI * 2,
        waitSpot: -1,
        promoteHold: 0,
        shimmyT: 0,
        exitVel: 0,
        ageSec: 0,
        lastSpeed: 0,
        mirrored: false,
        transFromScale: baseScale,
        transFromAlpha: WAIT_ALPHA,
        transDist: 0,
        cavGill,
        cavMouth,
        joltT: 0,
        mouthWork: 0,
        mouthLock: 0,
      });
      return;
    }

    // All other spawned fish enter the queue as waiting clients
    const role: Role = 'waiting';
    const used = new Set(this.slots.map((s) => s.waitSpot));
    const free = [0, 1, 2, 3].filter((i) => !used.has(i));
    const waitSpot = free.length > 0 ? free[Math.floor(Math.random() * free.length)] : 0;
    const mirrored = waitSpot >= 2;
    const target = this.waitSpots(w, h)[waitSpot];
    const pos = this.entryPoint(w, h, target, mirrored);

    const cavGill = freshCavity();
    cavGill.anchorLocal = anchorFor((ap) => ap === 'operculum');
    const cavMouth = freshCavity();
    cavMouth.anchorLocal = MOUTH_CAVITY_SPECIES.has(species)
      ? anchorFor((ap) => ap === 'upperTeeth' || ap === 'lowerTeeth')
      : null;

    this.slots.push({
      fish,
      species,
      role,
      phase: 'entering',
      leaveReason: null,
      pos,
      target,
      baseScale,
      displayScale: baseScale * WAIT_SCALE,
      targetScale: baseScale * WAIT_SCALE,
      alpha: 0.4,
      targetAlpha: WAIT_ALPHA,
      patience: SPECIES_PATIENCE[species],
      patienceMax: SPECIES_PATIENCE[species],
      lastRemoved: 0,
      bobPhase: Math.random() * Math.PI * 2,
      waitSpot,
      promoteHold: 0,
      shimmyT: 0,
      exitVel: 0,
      ageSec: 0,
      lastSpeed: 0,
      mirrored,
      transFromScale: baseScale * WAIT_SCALE,
      transFromAlpha: 0.4,
      transDist: 0,
      cavGill,
      cavMouth,
      joltT: 0,
      mouthWork: 0,
      mouthLock: 0,
    });
  }

  public beginLeave(slot: ClientSlot, reason: LeaveReason) {
    if (slot.phase === 'leaving') return;
    slot.phase = 'leaving';
    slot.leaveReason = reason;
    slot.shimmyT = reason === 'cleaned' ? SHIMMY_SECONDS : 0;
    slot.exitVel = 1.2;
    if (slot.species === 'spotted_moray') {
      if (slot.shimmyT <= 0) {
        slot.fish.startExit(); // native retract into the crevice
      }
    }
    if (reason === 'cleaned' && slot.role === 'active') {
      if (this.onClientCleaned) this.onClientCleaned();
    }

    // Persist unremoved parasites or clear when completely cleaned
    const stats = slot.fish.getParasiteStats();
    if (stats.remaining > 0 && slot.species !== 'french_grunt') {
      const remainingParasites = slot.fish.parasites
        .filter((p) => !p.removed)
        .map((p) => ({ ...p, hoverTimer: 0 }));
      this.savedParasites.set(slot.species, remainingParasites);
    } else {
      this.savedParasites.delete(slot.species);
    }
  }

  public promote(slot: ClientSlot, w: number, h: number) {
    // Invariant: only one fish can be active at the cleaning station
    for (const s of this.slots) {
      if (s !== slot && s.role === 'active' && s.phase !== 'leaving') {
        this.beginLeave(s, 'skipped');
      }
    }
    slot.role = 'active';
    slot.waitSpot = -1;
    slot.promoteHold = 0;
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
    slot.patience = 10;
    slot.patienceMax = 10;
    slot.lastRemoved = slot.fish.getParasiteStats().removed;
  }

  /** Send active client away - does NOT return to queue */
  public dismissActive(reason: LeaveReason = 'skipped') {
    const a = this.active();
    if (a) this.beginLeave(a, reason);
  }

  /** Find waiting client near a given world point (cleaner position or mouse) */
  public findWaitingClientNear(point: Vector2D): ClientSlot | null {
    let bestSlot: ClientSlot | null = null;
    let minDist = Infinity;
    for (const slot of this.slots) {
      if (slot.role !== 'waiting' || slot.phase === 'leaving') continue;
      const isMoray = slot.species === 'spotted_moray';
      const isGrunt = slot.species === 'french_grunt';
      const s = slot.displayScale;
      let fx = slot.fish.pos.x;
      let fy = slot.fish.pos.y;
      let rx = Math.max(90, 50 * s);
      let ry = Math.max(50, 30 * s);
      if (isMoray) {
        const cosH = Math.cos(-0.32);
        const sinH = Math.sin(-0.32);
        fx += 28 * s * cosH;
        fy += 28 * s * sinH;
        rx = 110;
        ry = 80;
      } else if (isGrunt) {
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

  private demote(slot: ClientSlot, w: number, h: number) {
    // Bumped from the station, fish always leaves (never goes to queue)
    this.beginLeave(slot, 'impatient');
  }

  /** The client currently active at the station, if any. */
  active(): ClientSlot | null {
    return this.slots.find((s) => s.role === 'active' && s.phase !== 'leaving') ?? null;
  }

  /** Send the active client on its way (the Next Fish button). */
  skipActive() {
    const a = this.active();
    if (a) this.beginLeave(a, 'skipped');
    this.spawnCooldown = Math.min(this.spawnCooldown, 1.2);
  }

  update(
    w: number,
    h: number,
    dt: number, // ~1 per 60th of a second (the app's frame unit)
    cleanerHeads: Vector2D[],
    wrasseMouth: Vector2D | null,
    gobiMouth: Vector2D | null,
    wrasseScale: number,
    gobiScale: number,
    autoMouth: Vector2D | null = null, // the OTHER cleaner - preps the queue
    autoScale: number = 0.65
  ) {
    const dtSec = dt / 60;
    this.time += dtSec;

    // --- spawning & empty queue guarantee ---
    const waitingSlots = this.slots.filter((s) => s.role === 'waiting' && s.phase !== 'leaving');
    const waitingCount = waitingSlots.length;

    if (waitingCount === 0) {
      this.emptyQueueTimer += dtSec;
    } else {
      this.emptyQueueTimer = 0;
    }

    this.spawnCooldown -= dtSec;

    // Guaranteed: queue must never remain empty for more than 10 seconds
    const forceEmptyQueueSpawn = waitingCount === 0 && this.emptyQueueTimer >= 10;

    if ((this.spawnCooldown <= 0 || forceEmptyQueueSpawn) && waitingCount < MAX_WAITING) {
      this.spawn(w, h);
      this.spawnCooldown = 4 + Math.random() * 5;
      if (waitingCount === 0) {
        this.emptyQueueTimer = 0;
      }
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
        // Happy pause on a fully-cleaned departure - sparkles glitter all over the fish.
        // The fish stays in place until celebration finishes, then swims away or retracts.
        slot.shimmyT -= dtSec;
        if (isMoray && slot.shimmyT <= 0) {
          slot.fish.startExit();
        }
      } else if (slot.phase === 'leaving') {
        if (!isMoray) {
          // Forward exit: smoothly swim off screen without jerky distortion
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
          const isMorayStationary = isMoray && (fish as SpottedMoray).state === 'stationary';
          const arrived = !isMoray && Math.hypot(slot.target.x - slot.pos.x, slot.target.y - slot.pos.y) < 6;
          if (arrived || isMorayStationary) {
            slot.phase = 'settled';
            if (slot.role === 'active') {
              slot.patience = 10;
              slot.patienceMax = 10;
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
        if (MOUTH_CAVITY_SPECIES.has(slot.species)) {
          slot.cavMouth.anchorLocal = bySpot(/mouth|beak|oral/i) ?? slot.cavMouth.anchorLocal;
        }

        // Delicate zones: gill flap and mouth open for a nearby cleaner,
        // wear out (composure), telegraph, and clamp
        const mouths: Vector2D[] = [];
        const rWrasse = reflect(wrasseMouth);
        const rGobi = reflect(gobiMouth);
        if (rWrasse) mouths.push(rWrasse);
        if (rGobi) mouths.push(rGobi);
        this.updateCavity(slot, slot.cavGill, rWrasse, rGobi, dtSec, dt);

        // Mouth service: a gaper opens as soon as a cleaner arrives at its
        // mouth and holds open while worked (~7s), flutters a warning, then
        // chomps (spit if you linger), rests ~3s, and reopens on return.
        // Runs whether or not any teeth parasites remain.
        if (
          MOUTH_CAVITY_SPECIES.has(slot.species) &&
          slot.phase === 'settled' &&
          slot.cavMouth.anchorLocal
        ) {
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
            slot.cavMouth.wiggle =
              slot.mouthWork > 5.5 ? Math.min(1, (slot.mouthWork - 5.5) / 1.5) : 0;
            if (slot.mouthWork >= 7) {
              slot.mouthLock = 3;
              slot.mouthWork = 0;
              slot.cavMouth.wiggle = 0;
              slot.joltT = 0.4;
              const inMouth = (m: Vector2D | null) =>
                !!m && Math.hypot(m.x - ma.x, m.y - ma.y) < 55;
              if (inMouth(rWrasse) || inMouth(rGobi)) {
                this.clampEvents.push({
                  ...ma,
                  hitWrasse: inMouth(rWrasse),
                  hitGoby: inMouth(rGobi),
                });
              }
            }
          } else {
            slot.cavMouth.wiggle = 0;
            slot.mouthWork = Math.max(0, slot.mouthWork - dtSec * 1.5);
          }
          slot.cavMouth.open += (target - slot.cavMouth.open) * Math.min(1, 0.12 * dt);
        }

        fish.gillOpen = slot.cavGill.lock > 0 ? 0 : slot.cavGill.open;
        fish.mouthGate = MOUTH_CAVITY_SPECIES.has(slot.species)
          ? slot.cavMouth.open
          : 1; // small mouths: lip parasites always reachable, no gape/clamp
        // The grouper animates its own drawn operculum, wiggle included
        if (fish instanceof Grouper) fish.gillWiggle = slot.cavGill.wiggle;
        // The mouth visibly gapes for service, flutters as the clamp warning,
        // and snaps near-shut while locked
        const flutter =
          slot.cavMouth.wiggle > 0 ? Math.sin(this.time * 24) * 0.09 * slot.cavMouth.wiggle : 0;
        if (!MOUTH_CAVITY_SPECIES.has(slot.species)) {
          // natural breathing only
        } else {
          // Blend toward a steady per-species gape instead of multiplying the
          // breathing cycle - an open mouth holds open, calmly
          const gape = GAPE_TARGET[slot.species];
          const o = Math.min(1, slot.cavMouth.open * 1.15);
          fish.mouthAperture = fish.mouthAperture * (1 - o) + gape * o + flutter;
        }

        fish.updateParasites(rWrasse, rGobi, dt, wrasseScale, gobiScale);
        const stats = fish.getParasiteStats();

        // If either cleaner fish eats a parasite, add three seconds to the timer
        if (stats.removed > slot.lastRemoved) {
          const eaten = stats.removed - slot.lastRemoved;
          slot.patience += eaten * 3;
          slot.patienceMax = Math.max(slot.patienceMax, slot.patience);
        }
        slot.lastRemoved = stats.removed;

        if (slot.phase === 'settled' && !this.patiencePaused) slot.patience -= dtSec;

        if (stats.remaining === 0) {
          this.beginLeave(slot, 'cleaned');
        } else if (slot.patience <= 0) {
          this.beginLeave(slot, 'impatient');
        }
      } else {
        // Not being serviced: gill flap rests closed
        fish.gillOpen = 0;
      }

      // --- waiting clients: patience drains; a lingering cleaner calls them over ---
      if (slot.role === 'waiting' && slot.phase !== 'leaving') {
        // The off-duty cleaner pre-cleans the queue in the background
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
        if (slot.patience <= 0) {
          this.beginLeave(slot, 'impatient');
        }
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

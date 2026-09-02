import { Grouper } from './Grouper';
import { QueenParrotfish } from './QueenParrotfish';
import { YellowtailGoatfish } from './YellowtailGoatfish';
import { QueenTriggerfish } from './QueenTriggerfish';
import { Trumpetfish } from './Trumpetfish';
import { SpottedMoray } from './SpottedMoray';
import { WhitespottedFilefish } from './WhitespottedFilefish';
import { FrenchGrunt } from './FrenchGrunt';
import { ClientFishSpecies, Vector2D } from '../types';

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

export interface ChallengeInfo {
  running: boolean;
  over: boolean;
  countdown: number; // 3..0 pre-shift countdown; 0 = live
  timeLeft: number; // seconds
  score: number; // nutrition points
  cleanedClients: number;
  parasitesEaten: number;
  mucusBites: number;
}

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
  // Challenge mode: visitors are passing trade - impatient, worth double
  visitor: boolean;
  lastTeethRem: number; // teeth-parasite count last frame (zone scoring)
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

const MAX_CLIENTS = 3; // 1 active + up to 2 waiting
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
const SHIMMY_SECONDS = 1.3;

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

const CHALLENGE_SECONDS = 180;
const SCORE_BODY = 10; // flank/fin parasite
const SCORE_DELICATE = 20; // teeth (and other gated) parasites
const SCORE_MUCUS = 50; // one stolen mouthful of mucus
const MUCUS_HOLD = 0.35; // seconds of holding Space on the flank to bite
const MUCUS_PATIENCE_COST = 9;

export class ClientDirector {
  slots: ClientSlot[] = [];
  onClientCleaned: (() => void) | null = null;
  mode: 'reef' | 'challenge' = 'reef';
  private ch: ChallengeInfo = {
    running: false,
    over: false,
    countdown: 0,
    timeLeft: CHALLENGE_SECONDS,
    score: 0,
    cleanedClients: 0,
    parasitesEaten: 0,
    mucusBites: 0,
  };
  private biteCharge = 0;
  private biteCooldown = 0;
  private primeSpawns = 0; // spawns forced during the challenge countdown
  // Clamp events (unmirrored coords) for the canvas: where to burst
  // bubbles, and exactly which cleaners got caught and must be spat out
  private clampEvents: { x: number; y: number; hitWrasse: boolean; hitGoby: boolean }[] = [];
  // Mucus-bite events (unmirrored) for the canvas's golden burst + popup
  private mucusEvents: { x: number; y: number; value: number }[] = [];

  startChallenge() {
    this.mode = 'challenge';
    this.ch = {
      running: true,
      over: false,
      countdown: 3,
      timeLeft: CHALLENGE_SECONDS,
      score: 0,
      cleanedClients: 0,
      parasitesEaten: 0,
      mucusBites: 0,
    };
    this.biteCharge = 0;
    this.biteCooldown = 0;
    // The client being serviced swims off while the countdown runs -
    // the shift starts with a fresh station, and the next client is
    // already on its way in
    this.skipActive();
    // Fresh clients swim in DURING the countdown so the shift starts staffed
    this.primeSpawns = 2;
    this.spawnCooldown = 0;
  }

  stopChallenge() {
    this.mode = 'reef';
    this.ch.running = false;
  }

  challengeInfo(): ChallengeInfo {
    return { ...this.ch };
  }

  drainMucusEvents(): { x: number; y: number; value: number }[] {
    const ev = this.mucusEvents;
    this.mucusEvents = [];
    return ev;
  }

  private get scoring(): boolean {
    return this.mode === 'challenge' && this.ch.running && !this.ch.over && this.ch.countdown <= 0;
  }

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
  private spawnCooldown = 1.5; // first client arrives almost immediately
  private time = 0;

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

  private drawSpecies(activeBusy: boolean): ClientFishSpecies | null {
    if (this.deck.length === 0) {
      this.deck = [...ALL_SPECIES].sort(() => Math.random() - 0.5);
    }
    const onScreen = new Set(this.slots.map((s) => s.species));
    for (let i = 0; i < this.deck.length; i++) {
      const sp = this.deck[i];
      if (onScreen.has(sp)) continue;
      // The moray can only appear when the station itself is free: it rises
      // from its crevice straight into service and never waits in open water.
      if (sp === 'spotted_moray' && activeBusy) continue;
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
    const hasActive = this.slots.some((s) => s.role === 'active');
    const waitingCount = this.slots.filter((s) => s.role === 'waiting').length;
    if (hasActive && waitingCount >= MAX_CLIENTS - 1) return;

    const species = this.drawSpecies(hasActive);
    if (!species) return;

    const fish = createClientFish(species, w, h);
    const baseScale = fish.scale;
    const isMoray = species === 'spotted_moray';

    const role: Role = hasActive ? 'waiting' : 'active';
    let waitSpot = -1;
    let mirrored = false;
    let target: Vector2D;
    if (role === 'active') {
      mirrored = !isMoray && Math.random() < 0.45;
      target = isMoray ? { ...fish.pos } : this.stationPos(species, baseScale, w, h, mirrored);
    } else {
      const used = new Set(this.slots.map((s) => s.waitSpot));
      const free = [0, 1, 2, 3].filter((i) => !used.has(i));
      waitSpot = free[Math.floor(Math.random() * free.length)];
      mirrored = waitSpot >= 2;
      target = this.waitSpots(w, h)[waitSpot];
    }

    if (isMoray) {
      // The moray's rear body trails behind the reef wall; drop parasites
      // that would render hidden inside the rock (same slope geometry as
      // Reef.render: ridge from (0, 0.68h) descending 30° to the floor).
      const startY = h * 0.68;
      const bottomX = (h - startY) * 1.732;
      const moray = fish as SpottedMoray;
      moray.parasites = moray.parasites.filter((p) => {
        const lp = moray.getParasiteLocalPos(p);
        const x = moray.targetPos.x + lp.x;
        const y = moray.targetPos.y + lp.y;
        const ridgeY = startY + (h - startY) * (x / bottomX) - 14;
        return !(x < bottomX && y > ridgeY);
      });
    }

    const pos = isMoray ? { ...fish.pos } : this.entryPoint(w, h, target, mirrored);

    // Fixed cavity anchors from the species' full parasite layout
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
    cavMouth.anchorLocal = MOUTH_CAVITY_SPECIES.has(species)
      ? anchorFor((ap) => ap === 'upperTeeth' || ap === 'lowerTeeth')
      : null;

    // Visitors (challenge only): passing trade - 40% less patience, double
    // nutrition value, first in your triage thinking
    const visitor = this.mode === 'challenge' && Math.random() < 0.35;

    this.slots.push({
      fish,
      species,
      role,
      phase: 'entering',
      leaveReason: null,
      pos,
      target,
      baseScale,
      displayScale: role === 'active' ? baseScale : baseScale * WAIT_SCALE,
      targetScale: role === 'active' ? baseScale : baseScale * WAIT_SCALE,
      alpha: role === 'active' ? 1 : 0.4,
      targetAlpha: role === 'active' ? 1 : WAIT_ALPHA,
      patience: SPECIES_PATIENCE[species] * (visitor ? 0.6 : 1),
      patienceMax: SPECIES_PATIENCE[species] * (visitor ? 0.6 : 1),
      lastRemoved: 0,
      bobPhase: Math.random() * Math.PI * 2,
      waitSpot,
      promoteHold: 0,
      shimmyT: 0,
      exitVel: 0,
      ageSec: 0,
      lastSpeed: 0,
      mirrored,
      transFromScale: role === 'active' ? baseScale : baseScale * WAIT_SCALE,
      transFromAlpha: role === 'active' ? 1 : 0.4,
      transDist: 0,
      cavGill,
      cavMouth,
      joltT: 0,
      mouthWork: 0,
      mouthLock: 0,
      visitor,
      lastTeethRem: fish.getParasiteStats().teethRemaining,
    });
  }

  private beginLeave(slot: ClientSlot, reason: LeaveReason) {
    if (slot.phase === 'leaving') return;
    slot.phase = 'leaving';
    slot.leaveReason = reason;
    slot.shimmyT = reason === 'cleaned' ? SHIMMY_SECONDS : 0;
    slot.exitVel = 1.2;
    if (slot.species === 'spotted_moray') {
      slot.fish.startExit(); // native retract into the crevice
    }
    if (reason === 'cleaned' && slot.role === 'active') {
      if (this.scoring) this.ch.cleanedClients++;
      if (this.onClientCleaned) this.onClientCleaned();
    }
  }

  private promote(slot: ClientSlot, w: number, h: number) {
    slot.role = 'active';
    slot.waitSpot = -1;
    slot.promoteHold = 0;
    slot.target = this.stationPos(slot.species, slot.baseScale, w, h, slot.mirrored);
    slot.targetScale = slot.baseScale;
    slot.targetAlpha = 1;
    slot.transFromScale = slot.displayScale;
    slot.transFromAlpha = slot.alpha;
    slot.transDist = Math.hypot(slot.target.x - slot.pos.x, slot.target.y - slot.pos.y);
    if (slot.phase === 'settled') slot.phase = 'entering';
  }

  private demote(slot: ClientSlot, w: number, h: number) {
    // The moray cannot wait in open water - bumped from the station, it
    // simply retracts into its crevice.
    if (slot.species === 'spotted_moray') {
      this.beginLeave(slot, 'impatient');
      return;
    }
    // A demoted fish keeps facing the way it faces, so it may only take a
    // waiting spot on its own side; with none free it just leaves.
    const used = new Set(this.slots.filter((s) => s !== slot).map((s) => s.waitSpot));
    const side = slot.mirrored ? [2, 3] : [0, 1];
    const spot = side.find((i) => !used.has(i)) ?? -1;
    if (spot === -1) {
      this.beginLeave(slot, 'impatient');
      return;
    }
    slot.role = 'waiting';
    slot.waitSpot = spot;
    slot.target = this.waitSpots(w, h)[spot];
    slot.targetScale = slot.baseScale * WAIT_SCALE;
    slot.targetAlpha = WAIT_ALPHA;
    slot.transFromScale = slot.displayScale;
    slot.transFromAlpha = slot.alpha;
    slot.transDist = Math.hypot(slot.target.x - slot.pos.x, slot.target.y - slot.pos.y);
    slot.phase = 'entering';
  }

  /** The client currently at the station, if any. */
  active(): ClientSlot | null {
    return this.slots.find((s) => s.role === 'active') ?? null;
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
    biteMouth: Vector2D | null = null, // the player's selected cleaner mouth
    biteHeld: boolean = false, // Space held = trying to bite mucus
    massageHeld: boolean = false, // M held = massaging
    autoMouth: Vector2D | null = null, // the OTHER cleaner - preps the queue
    autoScale: number = 0.65
  ) {
    const dtSec = dt / 60;
    this.time += dtSec;

    if (this.mode === 'challenge' && this.ch.running && !this.ch.over) {
      if (this.ch.countdown > 0) {
        this.ch.countdown = Math.max(0, this.ch.countdown - dtSec);
      } else {
        this.ch.timeLeft -= dtSec;
        if (this.ch.timeLeft <= 0) {
          this.ch.timeLeft = 0;
          this.ch.over = true;
        }
      }
    }
    this.biteCooldown = Math.max(0, this.biteCooldown - dtSec);

    // --- spawning ---
    this.spawnCooldown -= dtSec;
    if (this.primeSpawns > 0 && this.slots.length < MAX_CLIENTS) {
      this.spawn(w, h);
      this.primeSpawns--;
      this.spawnCooldown = 2;
    }
    if (this.spawnCooldown <= 0 && this.slots.length < MAX_CLIENTS) {
      this.spawn(w, h);
      // Challenge shifts run a busier reef
      this.spawnCooldown =
        this.mode === 'challenge' ? 4 + Math.random() * 5 : 7 + Math.random() * 9;
    }

    // If the station is free, call over whoever has waited longest.
    if (!this.slots.some((s) => s.role === 'active' && s.phase !== 'leaving')) {
      const waiting = this.slots
        .filter((s) => s.role === 'waiting' && s.phase !== 'leaving')
        .sort((a, b) => b.ageSec - a.ageSec)[0];
      if (waiting) this.promote(waiting, w, h);
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
        // Brief happy pause on a fully-cleaned departure - the canvas draws
        // eye sparkles over it - then off it swims.
        slot.shimmyT -= dtSec;
      } else if (slot.phase === 'leaving') {
        if (!isMoray) {
          // Forward exit: the fish continues the way it faces and off screen.
          slot.exitVel = Math.min(6.5, slot.exitVel + 0.05 * dt);
          slot.pos.x += (slot.mirrored ? 1 : -1) * slot.exitVel * dt;
          slot.pos.y += Math.sin(slot.bobPhase) * 0.4 * dt;
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
          const d = Math.hypot(slot.target.x - slot.pos.x, slot.target.y - slot.pos.y);
          if (d < 6) slot.phase = 'settled';
        }
      }
      slot.lastSpeed = dt > 0 ? moved / dt : 0;

      // Advance the fish's internal animation (breath, fins, mouth, moray
      // extension), then stamp the director's position over its own. While
      // actually traveling, run the animation double-speed so tail and fins
      // visibly beat with the effort.
      fish.update(w, h, dt);
      if (!isMoray && slot.lastSpeed > 1.2) fish.update(w, h, dt);
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

        // Each parasite eaten tops patience back up a little (not fully)
        if (stats.removed > slot.lastRemoved) {
          const eaten = stats.removed - slot.lastRemoved;
          slot.patience = Math.min(slot.patienceMax, slot.patience + eaten * PATIENCE_TOPUP);
          if (this.scoring) {
            const teethEaten = Math.max(0, slot.lastTeethRem - stats.teethRemaining);
            const bodyEaten = Math.max(0, eaten - teethEaten);
            const mult = slot.visitor ? 2 : 1;
            this.ch.score += (teethEaten * SCORE_DELICATE + bodyEaten * SCORE_BODY) * mult;
            this.ch.parasitesEaten += eaten;
          }
        }
        slot.lastRemoved = stats.removed;
        slot.lastTeethRem = stats.teethRemaining;

        // Mucus temptation (challenge): hold your cleaner against the
        // client's body to steal a mouthful - big points, big jolt
        if (this.scoring && biteMouth && biteHeld && !massageHeld && this.biteCooldown <= 0) {
          const rBite = slot.mirrored
            ? { x: 2 * fish.pos.x - biteMouth.x, y: biteMouth.y }
            : biteMouth;
          if (fish.hitTest(rBite)) {
            this.biteCharge += dtSec;
            if (this.biteCharge >= MUCUS_HOLD) {
              this.biteCharge = 0;
              this.biteCooldown = 1.6;
              const mult = slot.visitor ? 2 : 1;
              this.ch.score += SCORE_MUCUS * mult;
              this.ch.mucusBites++;
              slot.patience -= MUCUS_PATIENCE_COST;
              slot.joltT = 0.55;
              this.mucusEvents.push({ x: rBite.x, y: rBite.y, value: SCORE_MUCUS * mult });
            }
          } else {
            this.biteCharge = Math.max(0, this.biteCharge - dtSec * 2);
          }
        } else if (!biteHeld) {
          this.biteCharge = Math.max(0, this.biteCharge - dtSec * 2);
        }

        // Massage (challenge): soothe the client to rebuild its patience -
        // costs you clock, earns you nothing... directly
        if (this.mode === 'challenge' && massageHeld && biteMouth) {
          const rTouch = slot.mirrored
            ? { x: 2 * fish.pos.x - biteMouth.x, y: biteMouth.y }
            : biteMouth;
          if (fish.hitTest(rTouch)) {
            slot.patience = Math.min(slot.patienceMax, slot.patience + dtSec * 3);
          }
        }

        if (slot.phase === 'settled') slot.patience -= dtSec;

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
          slot.lastTeethRem = wStats.teethRemaining;
        }
        if (slot.phase === 'settled') slot.patience -= dtSec;
        if (slot.patience <= 0) {
          this.beginLeave(slot, 'impatient');
        } else {
          const near = cleanerHeads.some(
            (c) => Math.hypot(c.x - slot.pos.x, c.y - slot.pos.y) < 60 + 40 * (slot.displayScale / slot.baseScale)
          );
          slot.promoteHold = near ? slot.promoteHold + dtSec : Math.max(0, slot.promoteHold - dtSec * 2);
          if (slot.promoteHold >= PROMOTE_HOLD) {
            const current = this.active();
            if (current && current.phase !== 'leaving') this.demote(current, w, h);
            this.promote(slot, w, h);
          }
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

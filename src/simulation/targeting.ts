import { ClientDirector, ClientSlot } from './ClientDirector';

interface Point {
  x: number;
  y: number;
}

export interface CleaningSpot {
  id: string;
  name: string;
  pos: Point;
}

/**
 * Body parts the auto cleaners leave alone: gill flaps and mouths are the
 * player's work (unless the player has gone idle for a true screensaver).
 */
export const GATED_PARTS = ['operculum', 'upperTeeth', 'lowerTeeth'];

export interface CleanerTargetsInput {
  director: ClientDirector | null;
  /** The station's active client, if any. */
  active: ClientSlot | null;
  /** True once the pointer has been still long enough that the auto cleaners may finish everything. */
  playerIdle: boolean;
}

export interface CleanerTargets {
  /** The active client's named cleaning spots, in screen space. */
  cleaningSpots: CleaningSpot[];
  /** Every remaining parasite on the active client, in screen space. */
  activeParasiteSpots: Point[];
  /** What the on-duty auto cleaner should work. */
  autoTargets: Point[];
  /** What the off-duty cleaner should work: the waiting queue's body parasites, else `autoTargets`. */
  queueTargets: Point[];
}

/** Reflect a fish-reported x into screen space when the fish is drawn mirrored. */
function screenX(slot: ClientSlot, x: number): number {
  return slot.mirrored ? 2 * slot.fish.pos.x - x : x;
}

/** World positions of a slot's remaining non-gated parasites, in screen space. */
function ungatedParasiteTargets(slot: ClientSlot): Point[] {
  const out: Point[] = [];
  for (const p of slot.fish.parasites) {
    if (p.removed || GATED_PARTS.includes(p.attachPart)) continue;
    const lp = slot.fish.getParasiteLocalPos(p);
    out.push({ x: screenX(slot, slot.fish.pos.x + lp.x), y: slot.fish.pos.y + lp.y });
  }
  return out;
}

/**
 * Cleaner-AI target selection for one frame. Pure: reads the director and the
 * active slot, mutates nothing.
 */
export function computeCleanerTargets({
  director,
  active,
  playerIdle,
}: CleanerTargetsInput): CleanerTargets {
  let cleaningSpots: CleaningSpot[] = [];
  let activeParasiteSpots: Point[] = [];

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

  // Auto-cleaner targets: body and fin parasites only - gill flaps and
  // mouths are the player's work. If the player has been idle a while
  // (true screensaver), the auto cleaners may finish everything.
  let autoTargets: Point[] = [];
  if (active && active.phase !== 'leaving') {
    autoTargets = playerIdle ? activeParasiteSpots.slice() : ungatedParasiteTargets(active);
    if (autoTargets.length > 3) {
      const flank = cleaningSpots.find((sp) => /flank|torso|body/i.test(sp.id));
      if (flank) autoTargets.push(flank.pos);
    }
  }

  // The off-duty cleaner's beat: the waiting queue's body parasites
  let queueTargets: Point[] = [];
  if (director && !playerIdle) {
    for (const slot of director.slots) {
      if (slot.role !== 'waiting' || slot.phase === 'leaving') continue;
      queueTargets.push(...ungatedParasiteTargets(slot));
    }
  }
  if (queueTargets.length === 0) queueTargets = autoTargets;

  return { cleaningSpots, activeParasiteSpots, autoTargets, queueTargets };
}

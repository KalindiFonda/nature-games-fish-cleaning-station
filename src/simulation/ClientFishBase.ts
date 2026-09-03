import { Vector2D, Parasite, ParasiteStats } from '../types';
import { parasiteUnit, drawParasite, drawEatRing } from './parasiteFx';

/** A named anatomical spot a cleaner can be sent to inspect or clean. */
export interface CleaningTargetSpot {
  id: string;
  name: string;
  pos: Vector2D;
}

export type ClientFishState = 'entering' | 'stationary' | 'exiting' | 'exited';

/** Body extent for the default hitTest, in unscaled fish-local units. */
export interface HitBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Shared skeleton of every client fish that visits the cleaning station.
 *
 * The ClientDirector owns position and scale: it stamps `pos` (and `scale`)
 * onto the fish after every update(), so a species' update() only advances
 * its own animation (breath, fins, mouth). The SpottedMoray is the one
 * exception - it keeps its native crevice emerge/retract state machine and
 * the director reads its `state` and `targetPos` instead.
 *
 * Parasite bookkeeping (world positions, eat checks against the two cleaner
 * mouths, stats, drawing) is identical across species and lives here; each
 * species supplies its own parasite layout, anatomy-driven local positions,
 * cleaning spots and artwork.
 */
export abstract class ClientFishBase {
  public pos: Vector2D = { x: 0, y: 0 };
  public scale: number = 1;
  public heading: number = Math.PI; // Facing left toward the cleaning station in profile

  // Only the moray drives this; ordinary species sit at 'stationary' and let
  // the director move them. Kept on the base so the ClientFish union agrees.
  public state: ClientFishState = 'stationary';

  public animTime: number = 0;
  public breathPhase: number = 0;
  public finPhase: number = 0;
  public mouthAperture: number = 1;

  public isVisible: boolean = true;

  // Parasites to be cleaned
  public parasites: Parasite[] = [];

  // Cavity gates driven by the ClientDirector (1 = open/eatable):
  // gill parasites hide under the operculum flap, teeth behind the lips.
  public gillOpen: number = 1;
  public mouthGate: number = 1;

  protected hitBox: HitBox = { minX: -45, maxX: 45, minY: -40, maxY: 36 };

  /** Populate `parasites` with this species' full layout (before subsampling). */
  protected abstract initParasites(): void;

  /** Parasite offset from `pos`, following scale and the anatomy it sits on. */
  public abstract getParasiteLocalPos(p: Parasite): Vector2D;

  /** Named spots a cleaner can be sent to; the director anchors the gill/mouth cavities on them. */
  public abstract getCleaningStationSpots(): CleaningTargetSpot[];

  /** Advance animation phases. `dt` is ~1 per 60th of a second (the app's frame unit). */
  public abstract update(w: number, h: number, dt: number): void;

  public abstract render(ctx: CanvasRenderingContext2D): void;

  public getParasiteWorldPos(p: Parasite): Vector2D {
    const local = this.getParasiteLocalPos(p);
    return {
      x: this.pos.x + local.x,
      y: this.pos.y + local.y,
    };
  }

  /**
   * Eat check: a parasite is removed the moment either cleaner's mouth passes
   * over it, unless it sits in a cavity the director has gated shut.
   */
  public updateParasites(
    hogfishMouth: Vector2D | null,
    gobyMouth: Vector2D | null,
    _dt: number,
    hogfishScale: number = 0.9,
    gobyScale: number = 0.65
  ) {
    // Generous mouth touch radius so swimming over/near the parasite eats it instantly
    const hogfishEatDist = 20 * hogfishScale;
    const gobyEatDist = 18 * gobyScale;

    for (const p of this.parasites) {
      if (p.removed) continue;
      if (p.attachPart === 'operculum' && this.gillOpen < 0.6) continue;
      if ((p.attachPart === 'upperTeeth' || p.attachPart === 'lowerTeeth') && this.mouthGate < 0.6) continue;

      const wPos = this.getParasiteWorldPos(p);
      let isEaten = false;

      if (hogfishMouth) {
        const d = Math.hypot(wPos.x - hogfishMouth.x, wPos.y - hogfishMouth.y);
        if (d <= hogfishEatDist) isEaten = true;
      }

      if (!isEaten && gobyMouth) {
        const d = Math.hypot(wPos.x - gobyMouth.x, wPos.y - gobyMouth.y);
        if (d <= gobyEatDist) isEaten = true;
      }

      if (isEaten) {
        p.removed = true;
        p.hoverTimer = 1;
      }
    }
  }

  /** World positions of every parasite still attached (cleaner AI targets). */
  public getActiveParasitePositions(): Vector2D[] {
    const spots: Vector2D[] = [];
    for (const p of this.parasites) {
      if (!p.removed) {
        spots.push(this.getParasiteWorldPos(p));
      }
    }
    return spots;
  }

  public getParasiteStats(): ParasiteStats {
    let teethTotal = 0;
    let teethRemoved = 0;
    let bodyTotal = 0;
    let bodyRemoved = 0;

    for (const p of this.parasites) {
      if (p.type === 'teeth') {
        teethTotal++;
        if (p.removed) teethRemoved++;
      } else {
        bodyTotal++;
        if (p.removed) bodyRemoved++;
      }
    }

    const total = teethTotal + bodyTotal;
    const removed = teethRemoved + bodyRemoved;

    return {
      total,
      remaining: total - removed,
      removed,
      teethRemaining: teethTotal - teethRemoved,
      bodyRemaining: bodyTotal - bodyRemoved,
    };
  }

  /** Ordinary species are swum off screen by the director; the moray overrides this. */
  public startExit(): void {}

  /** Axis-aligned body test against `hitBox` scaled by `scale`. */
  public hitTest(pt: Vector2D): boolean {
    const s = this.scale;
    const dx = pt.x - this.pos.x;
    const dy = pt.y - this.pos.y;
    const b = this.hitBox;
    return dx >= b.minX * s && dx <= b.maxX * s && dy >= b.minY * s && dy <= b.maxY * s;
  }

  /**
   * Draw every attached parasite at its local position (ctx already
   * translated to `pos`), plus the fading eat ring of a just-removed one.
   */
  protected renderParasites(ctx: CanvasRenderingContext2D) {
    const unit = parasiteUnit(this.scale);
    for (const p of this.parasites) {
      const local = this.getParasiteLocalPos(p);
      if (p.removed) {
        if (p.hoverTimer > 0) {
          ctx.save();
          ctx.translate(local.x, local.y);
          drawEatRing(ctx, unit, p.hoverTimer);
          ctx.restore();
          p.hoverTimer -= 0.02;
        }
        continue;
      }
      ctx.save();
      ctx.translate(local.x, local.y);
      drawParasite(ctx, unit, this.animTime, p.id, p.type === 'teeth');
      ctx.restore();
    }
  }
}

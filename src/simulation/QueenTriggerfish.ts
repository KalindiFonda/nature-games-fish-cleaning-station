import { Vector2D, Parasite } from '../types';
import { lerp, clamp } from '../utils/math';
import { parasiteUnit, drawParasite, drawEatRing, subsampleParasites } from './parasiteFx';

export interface CleaningTargetSpot {
  id: string;
  name: string;
  pos: Vector2D;
}

/**
 * Queen Triggerfish (Balistes vetula)
 * "Smooth Low-Poly" Style Guide Implementation:
 * - Deep, chunky, highly compressed diamond/rhomboidal body (~30–50 cm)
 * - Small puckered mouth with robust chisel-like teeth
 * - Large expressive eye high on head with radiant iridescent blue orbital lines
 * - Tall anterior dorsal trigger spine (first spine can lock erect)
 * - Strong angular, falcate dorsal and anal fins with blue-violet and gold striping
 * - Vibrant turquoise, blue-green, and emerald body with warm yellow/orange throat and chin
 * - Two iconic curved electric-blue facial bands across snout and cheek
 * - Elaborate scalloped caudal tail with long streaming upper and lower filament extensions
 */
export class QueenTriggerfish {
  public pos: Vector2D = { x: 0, y: 0 };
  public targetPos: Vector2D = { x: 0, y: 0 };
  public heading: number = Math.PI; // Facing left toward cleaning station

  // Scaled up by 20% (from 2.8 to 3.36)
  public scale: number = 3.36;

  public state: 'entering' | 'stationary' | 'exiting' | 'exited' = 'entering';
  public entrySpeed: number = 2.7;
  public exitSpeed: number = 3.3;

  public animTime: number = 0;
  public breathPhase: number = 0;
  public finPhase: number = 0;
  public spinePhase: number = 0;
  public mouthAperture: number = 0.85;

  public isVisible: boolean = true;

  // Procedural Turn & Perspective Facing State
  public facingPlayer: boolean = false;
  public turnProgress: number = 0; // 0.0 = Profile, 1.0 = Facing Player
  public turnSpeed: number = 0.0075;

  // Parasites on puckered mouth, facial stripes, and body
  public parasites: Parasite[] = [];

  // Cavity gates driven by the ClientDirector (1 = open/eatable):
  // gill parasites hide under the operculum flap, teeth behind the lips.
  public gillOpen: number = 1;
  public mouthGate: number = 1;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.pos = {
      x: canvasWidth + 450,
      y: canvasHeight * 0.48,
    };
    this.targetPos = {
      x: this.getProfileTargetX(canvasWidth),
      y: canvasHeight * 0.48,
    };

    this.initParasites();
    this.parasites = subsampleParasites(this.parasites, 18);
  }

  /**
   * Initialize parasites over the puckered mouth, facial bands, and diamond flanks
   */
  private initParasites() {
    this.parasites = [];
    let id = 300;

    // 1. Parasites on puckered mouth and lips
    const mouthCoords = [
      { x: -36.0, y: 3.5, part: 'upperTeeth' as const },
      { x: -34.0, y: 5.5, part: 'lowerTeeth' as const },
      { x: -38.0, y: 4.5, part: 'upperTeeth' as const },
      { x: -35.0, y: 2.0, part: 'upperTeeth' as const },
      { x: -33.0, y: 6.5, part: 'lowerTeeth' as const },
      { x: -37.0, y: 6.0, part: 'lowerTeeth' as const },
      { x: -31.0, y: 4.0, part: 'upperTeeth' as const },
      { x: -39.0, y: 3.8, part: 'upperTeeth' as const },
      { x: -35.5, y: 7.0, part: 'lowerTeeth' as const },
      { x: -32.5, y: 5.0, part: 'lowerTeeth' as const },
    ];

    for (const c of mouthCoords) {
      this.parasites.push({
        id: id++,
        type: 'teeth',
        localX: c.x,
        localY: c.y,
        attachPart: c.part,
        hoverTimer: 0,
        removed: false,
      });
    }

    // 2. Body Parasites along the radiant blue facial bands, throat, and diamond body
    const bodyCoords = [
      // Facial Blue Bands & Snout
      { x: -28.0, y: 1.0, part: 'body' as const },
      { x: -22.0, y: 3.0, part: 'body' as const },
      { x: -26.0, y: -4.0, part: 'body' as const },
      { x: -18.0, y: -2.0, part: 'body' as const },
      // Radiant eye margin & forehead
      { x: -16.0, y: -16.0, part: 'body' as const },
      { x: -12.0, y: -20.0, part: 'body' as const },
      { x: -8.0, y: -12.0, part: 'body' as const },
      // Yellow-Orange Throat & Chin
      { x: -28.0, y: 8.0, part: 'belly' as const },
      { x: -20.0, y: 12.0, part: 'belly' as const },
      { x: -12.0, y: 14.0, part: 'belly' as const },
      // Diamond Dorsal Ridge & Trigger Base
      { x: -2.0, y: -24.0, part: 'body' as const },
      { x: 8.0, y: -22.0, part: 'body' as const },
      { x: 18.0, y: -18.0, part: 'body' as const },
      { x: 28.0, y: -14.0, part: 'body' as const },
      // Mid-Body Turquoise Flanks
      { x: -4.0, y: -2.0, part: 'body' as const },
      { x: 6.0, y: -4.0, part: 'body' as const },
      { x: 16.0, y: -2.0, part: 'body' as const },
      { x: 26.0, y: 0.0, part: 'body' as const },
      { x: 36.0, y: -2.0, part: 'body' as const },
      // Ventral Keel & Belly
      { x: -2.0, y: 16.0, part: 'belly' as const },
      { x: 8.0, y: 14.0, part: 'belly' as const },
      { x: 18.0, y: 12.0, part: 'belly' as const },
      { x: 28.0, y: 8.0, part: 'belly' as const },
      { x: 38.0, y: 4.0, part: 'body' as const },
      // Opercular zone
      { x: -14.0, y: 2.0, part: 'operculum' as const },
      { x: -10.0, y: 4.0, part: 'operculum' as const },
      { x: -7.0, y: 1.0, part: 'operculum' as const },
      { x: -4.0, y: 6.0, part: 'operculum' as const },
      { x: -2.0, y: 3.5, part: 'operculum' as const },
    ];

    for (const c of bodyCoords) {
      this.parasites.push({
        id: id++,
        type: 'body',
        localX: c.x,
        localY: c.y,
        attachPart: c.part,
        hoverTimer: 0,
        removed: false,
      });
    }
  }

  public getParasiteLocalPos(p: Parasite): Vector2D {
    const s = this.scale;
    let lx = p.localX * s;
    let ly = p.localY * s;

    if (p.attachPart === 'lowerTeeth') {
      ly = (p.localY * s) + (this.mouthAperture - 0.85) * (4 * s);
    } else if (p.attachPart === 'upperTeeth') {
      ly = (p.localY * s) - (this.mouthAperture - 0.85) * (2 * s);
    } else if (p.attachPart === 'belly') {
      ly = (p.localY * s) + (Math.sin(this.breathPhase) * 1.3);
    } else if (p.attachPart === 'operculum') {
      lx = (p.localX * s) - (Math.sin(this.breathPhase) * 1.5);
    }

    return { x: lx, y: ly };
  }

  public getParasiteWorldPos(p: Parasite): Vector2D {
    const local = this.getParasiteLocalPos(p);
    return {
      x: this.pos.x + local.x,
      y: this.pos.y + local.y,
    };
  }

  public updateParasites(
    wrasseMouth: Vector2D | null,
    gobiMouth: Vector2D | null,
    _dt: number,
    wrasseScale: number = 0.9,
    gobiScale: number = 0.65
  ) {
    if (this.turnProgress > 0.4) return;

    const wrasseEatDist = 20 * wrasseScale;
    const gobiEatDist = 18 * gobiScale;

    for (const p of this.parasites) {
      if (p.removed) continue;
      if (p.attachPart === 'operculum' && this.gillOpen < 0.6) continue;
      if ((p.attachPart === 'upperTeeth' || p.attachPart === 'lowerTeeth') && this.mouthGate < 0.6) continue;

      const wPos = this.getParasiteWorldPos(p);
      let isEaten = false;

      if (wrasseMouth) {
        const d = Math.hypot(wPos.x - wrasseMouth.x, wPos.y - wrasseMouth.y);
        if (d <= wrasseEatDist) isEaten = true;
      }

      if (!isEaten && gobiMouth) {
        const d = Math.hypot(wPos.x - gobiMouth.x, wPos.y - gobiMouth.y);
        if (d <= gobiEatDist) isEaten = true;
      }

      if (isEaten) {
        p.removed = true;
        p.hoverTimer = 1;
      }
    }
  }

  public getActiveParasitePositions(): Vector2D[] {
    const spots: Vector2D[] = [];
    for (const p of this.parasites) {
      if (!p.removed) {
        spots.push(this.getParasiteWorldPos(p));
      }
    }
    return spots;
  }

  public getParasiteStats() {
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

  /**
   * Calculate target X so the entire fish (from puckered mouth to streaming filament tail tips) is fully visible,
   * anchored cleanly on the right side of the screen.
   */
  private getProfileTargetX(canvasWidth: number): number {
    const s = this.scale;
    // Whole body length from mouth (-40 * s) to filament tail streamer tips (+108 * s) is ~148 * s.
    return canvasWidth - (109 * s + 24);
  }

  private getFacingTargetX(canvasWidth: number): number {
    return Math.max(canvasWidth * 0.72, canvasWidth - 280);
  }

  public toggleFacingPlayer(): boolean {
    return false;
  }

  public setFacingPlayer(_facing: boolean) {
    this.facingPlayer = false;
  }

  public startExit() {
    if (this.state !== 'exited') {
      this.state = 'exiting';
      this.facingPlayer = false;
    }
  }

  public hitTest(pos: Vector2D): boolean {
    const s = this.scale;
    const dx = pos.x - this.pos.x;
    const dy = pos.y - this.pos.y;
    const minX = -45 * s;
    const maxX = 55 * s;
    const minY = -32 * s;
    const maxY = 30 * s;
    return dx >= minX && dx <= maxX && dy >= minY && dy <= maxY;
  }

  public update(width: number, height: number, dt: number = 1) {
    const safeDt = clamp(dt, 0.2, 2.0);
    this.animTime += 0.03 * safeDt;
    this.breathPhase += 0.035 * safeDt;
    this.finPhase += 0.055 * safeDt;
    this.spinePhase += 0.025 * safeDt;

    this.turnProgress = 0;
    this.facingPlayer = false;

    const profileX = this.getProfileTargetX(width);
    const desiredTargetY = height * 0.48;

    this.targetPos.x = profileX;
    this.targetPos.y = desiredTargetY;

    if (this.state === 'entering') {
      const dx = this.targetPos.x - this.pos.x;
      const dy = this.targetPos.y - this.pos.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 4) {
        this.pos.x += (dx / dist) * this.entrySpeed * safeDt;
        this.pos.y += (dy / dist) * this.entrySpeed * safeDt;
      } else {
        this.pos.x = this.targetPos.x;
        this.pos.y = this.targetPos.y;
        this.state = 'stationary';
      }
    } else if (this.state === 'exiting') {
      this.pos.x += this.exitSpeed * 1.5 * safeDt;
      if (this.pos.x > width + 450) {
        this.state = 'exited';
        this.isVisible = false;
      }
    } else if (this.state === 'stationary') {
      const buoyancyY = Math.sin(this.breathPhase * 0.7) * 2.8;
      const buoyancyX = Math.cos(this.breathPhase * 0.45) * 1.2;

      this.pos.x = lerp(this.pos.x, this.targetPos.x + buoyancyX, 0.035 * safeDt);
      this.pos.y = lerp(this.pos.y, this.targetPos.y + buoyancyY, 0.035 * safeDt);
    }

    this.mouthAperture = 0.85 + Math.sin(this.breathPhase) * 0.04;
  }

  public getCleaningStationSpots(): CleaningTargetSpot[] {
    const s = this.scale;

    const profMouth: Vector2D = {
      x: this.pos.x - 36 * s,
      y: this.pos.y + 4 * s,
    };
    const profSpine: Vector2D = {
      x: this.pos.x - 4 * s,
      y: this.pos.y - 28 * s,
    };
    const profFlank: Vector2D = {
      x: this.pos.x + 12 * s,
      y: this.pos.y,
    };

    return [
      {
        id: 'puckered-mouth',
        name: 'Puckered Mouth & Chisel Teeth',
        pos: profMouth,
      },
      {
        id: 'trigger-spine',
        name: 'Dorsal Trigger Spines',
        pos: profSpine,
      },
      {
        id: 'turquoise-flank',
        name: 'Turquoise Diamond Body & Tail',
        pos: profFlank,
      },
    ];
  }

  public render(ctx: CanvasRenderingContext2D) {
    if (!this.isVisible || this.state === 'exited') return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    const s = this.scale;
    const breath = Math.sin(this.breathPhase);
    const finFlutter = Math.sin(this.finPhase);
    const spineFlex = Math.sin(this.spinePhase);

    this.renderProfile(ctx, s, breath, finFlutter, spineFlex, 1.0);

    ctx.restore();
  }

  // =========================================================================
  // PROFILE VIEW RENDERING (Queen Triggerfish - Balistes vetula)
  // Deep, chunky, highly compressed body; small puckered mouth; radiant blue eye lines;
  // tall trigger spines; strong angular dorsal/anal fins; and elaborate filament tail.
  // =========================================================================

  private renderProfile(
    ctx: CanvasRenderingContext2D,
    s: number,
    breath: number,
    finFlutter: number,
    spineFlex: number,
    alpha: number = 1.0
  ) {
    ctx.save();
    if (alpha < 1.0) {
      ctx.globalAlpha = ctx.globalAlpha * alpha;
    }

    // 1. Tall Anterior Trigger Spines (Spiny dorsal fin with locking spine)
    this.renderSmoothTriggerSpines(ctx, s, spineFlex);

    // 2. Falcate Angular Soft Second Dorsal Fin
    this.renderSmoothSecondDorsalFin(ctx, s, finFlutter);

    // 3. Falcate Angular Anal Fin
    this.renderSmoothAnalFin(ctx, s, finFlutter);

    // 4. Elaborate Scalloped Caudal Tail with Long Streaming Filaments
    this.renderSmoothElaborateTail(ctx, s, finFlutter);

    // 5. Deep Diamond Body with Turquoise/Green/Gold Shading
    this.renderSmoothDiamondBody(ctx, s, breath);

    // 6. Iconic Curved Electric-Blue Snout & Cheek Bands
    this.renderSmoothFacialBands(ctx, s);

    // 7. Small Puckered Mouth with Chisel Teeth
    this.renderSmoothPuckeredMouth(ctx, s);

    // 8. Large Expressive Eye with Radiant Blue Lines
    this.renderSmoothRadiantEye(ctx, s);

    // 9. Angular Translucent Pectoral Fin & Pelvic Keel
    this.renderSmoothPectoralFin(ctx, s, finFlutter);

    // 10. Parasites
    this.renderParasites(ctx);

    ctx.restore();
  }

  private renderParasites(ctx: CanvasRenderingContext2D) {
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

  /**
   * Deep, chunky, highly compressed rhomboidal/diamond body
   */
  private renderSmoothDiamondBody(ctx: CanvasRenderingContext2D, s: number, breath: number) {
    const bShift = breath * 1.0;

    // 1. Diamond Silhouette
    ctx.save();
    ctx.beginPath();
    // Puckered snout tip
    ctx.moveTo(-36 * s, 1.5 * s);
    // Steep straight forehead slope to dorsal trigger base
    ctx.bezierCurveTo(-30 * s, -8 * s, -18 * s, -20 * s, -6 * s, -25 * s);
    // Trigger spine ridge to soft dorsal origin
    ctx.bezierCurveTo(8 * s, -25 * s, 20 * s, -20 * s, 34 * s, -14 * s);
    // Caudal peduncle top
    ctx.lineTo(46 * s, -5 * s);
    // Caudal peduncle rear
    ctx.lineTo(46 * s, 5 * s);
    // Caudal peduncle bottom
    ctx.lineTo(34 * s, 14 * s);
    // Steep ventral keel (belly)
    ctx.bezierCurveTo(18 * s, 22 * s + bShift, 0, 24 * s + bShift, -16 * s, 18 * s + bShift);
    // Throat to lower jaw
    ctx.quadraticCurveTo(-28 * s, 12 * s, -34 * s, 6 * s);
    // Lower lip notch
    ctx.lineTo(-36 * s, 3.5 * s);
    ctx.closePath();

    // Vibrant body gradient: Emerald turquoise to royal blue-green with warm golden underbelly
    const bodyGrad = ctx.createLinearGradient(-30 * s, -22 * s, 40 * s, 18 * s);
    bodyGrad.addColorStop(0, '#065f46');   // Deep emerald olive nape
    bodyGrad.addColorStop(0.25, '#0d9488'); // Vivid teal
    bodyGrad.addColorStop(0.55, '#0284c7'); // Vibrant azure turquoise
    bodyGrad.addColorStop(0.85, '#0369a1'); // Ocean blue flanks
    bodyGrad.addColorStop(1, '#0f766e');   // Teal caudal base
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.restore();

    // 2. Warm Yellow/Orange Throat and Chin Accent
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-34 * s, 6 * s);
    ctx.quadraticCurveTo(-28 * s, 12 * s, -16 * s, 18 * s + bShift);
    ctx.quadraticCurveTo(0, 16 * s + bShift, 10 * s, 8 * s);
    ctx.quadraticCurveTo(-8 * s, 4 * s, -26 * s, 3 * s);
    ctx.closePath();

    const throatGrad = ctx.createLinearGradient(-30 * s, 3 * s, 0, 18 * s);
    throatGrad.addColorStop(0, 'rgba(251, 146, 60, 0.9)'); // Vivid warm orange
    throatGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.75)'); // Golden yellow
    throatGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = throatGrad;
    ctx.fill();
    ctx.restore();

    // 3. Turquoise and Chartreuse Upper Dorsal Shimmer
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-28 * s, -10 * s);
    ctx.quadraticCurveTo(-14 * s, -22 * s, -4 * s, -24 * s);
    ctx.quadraticCurveTo(16 * s, -22 * s, 32 * s, -13 * s);
    ctx.lineTo(24 * s, -4 * s);
    ctx.quadraticCurveTo(0, -10 * s, -18 * s, -4 * s);
    ctx.closePath();

    const dorsalShimmer = ctx.createLinearGradient(-10 * s, -24 * s, 10 * s, -4 * s);
    dorsalShimmer.addColorStop(0, 'rgba(52, 211, 153, 0.45)'); // Emerald chartreuse
    dorsalShimmer.addColorStop(0.6, 'rgba(34, 211, 238, 0.35)'); // Bright cyan
    dorsalShimmer.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = dorsalShimmer;
    ctx.fill();
    ctx.restore();

    // 4. Subtle Stylized Low-Poly Facet Planes
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-20 * s, -18 * s); ctx.lineTo(-6 * s, -4 * s); ctx.lineTo(12 * s, -18 * s);
    ctx.moveTo(-6 * s, -4 * s); ctx.lineTo(6 * s, 14 * s + bShift);
    ctx.moveTo(14 * s, -4 * s); ctx.lineTo(28 * s, -12 * s);
    ctx.moveTo(14 * s, -4 * s); ctx.lineTo(24 * s, 12 * s);
    ctx.moveTo(-6 * s, -4 * s); ctx.lineTo(-18 * s, 14 * s + bShift);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Iconic Curved Electric-Blue Facial Bands across snout and cheek
   */
  private renderSmoothFacialBands(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    ctx.lineWidth = 2.2 * s;
    ctx.lineCap = 'round';

    // 1. Upper Blue Stripe: Running from cheek forward over snout above mouth
    ctx.beginPath();
    ctx.moveTo(-6 * s, -2 * s);
    ctx.quadraticCurveTo(-18 * s, 2 * s, -33 * s, 1.5 * s);
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-6 * s, -2 * s);
    ctx.quadraticCurveTo(-18 * s, 2 * s, -33 * s, 1.5 * s);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8 * s;
    ctx.stroke();

    // 2. Lower Blue Stripe: Running parallel beneath, curving around the lower cheek
    ctx.beginPath();
    ctx.moveTo(-10 * s, 6 * s);
    ctx.quadraticCurveTo(-20 * s, 7 * s, -31 * s, 4.5 * s);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.0 * s;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-10 * s, 6 * s);
    ctx.quadraticCurveTo(-20 * s, 7 * s, -31 * s, 4.5 * s);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 0.8 * s;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Tall Anterior Trigger Spines (1st erect locking spine + 2nd & 3rd locking spines)
   */
  private renderSmoothTriggerSpines(ctx: CanvasRenderingContext2D, s: number, spineFlex: number) {
    const erectAngle = spineFlex * 0.08;

    ctx.save();
    ctx.translate(-6 * s, -24 * s);
    ctx.rotate(erectAngle);

    // Main 1st Trigger Spine (Stout, tall, sharp spine)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2 * s, -14 * s, 4 * s, -22 * s);
    ctx.quadraticCurveTo(6 * s, -12 * s, 5 * s, 0);
    ctx.closePath();

    const spineGrad = ctx.createLinearGradient(0, 0, 4 * s, -22 * s);
    spineGrad.addColorStop(0, '#047857');
    spineGrad.addColorStop(0.6, '#0284c7');
    spineGrad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = spineGrad;
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Spine Membrane & 2nd/3rd Locking Spines
    ctx.beginPath();
    ctx.moveTo(4 * s, -18 * s);
    ctx.quadraticCurveTo(8 * s, -12 * s, 14 * s, 0);
    ctx.lineTo(2 * s, 0);
    ctx.closePath();

    const memGrad = ctx.createLinearGradient(0, 0, 10 * s, -15 * s);
    memGrad.addColorStop(0, 'rgba(13, 148, 136, 0.7)');
    memGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.5)');
    memGrad.addColorStop(1, 'rgba(251, 146, 60, 0.6)');
    ctx.fillStyle = memGrad;
    ctx.fill();

    // 2nd Locking spine rib
    ctx.beginPath();
    ctx.moveTo(2 * s, 0);
    ctx.lineTo(9 * s, -9 * s);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Falcate Angular Soft Second Dorsal Fin
   */
  private renderSmoothSecondDorsalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 2.2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(10 * s, -22 * s);
    // Tall falcate anterior lobe extending high and back
    ctx.bezierCurveTo(14 * s, -34 * s + wave * 0.6, 20 * s, -42 * s + wave, 24 * s, -44 * s + wave);
    // Scalloped trailing fin margin
    ctx.quadraticCurveTo(28 * s, -30 * s + wave * 0.5, 38 * s, -12 * s);
    ctx.lineTo(10 * s, -22 * s);
    ctx.closePath();

    const dGrad = ctx.createLinearGradient(12 * s, -22 * s, 22 * s, -44 * s);
    dGrad.addColorStop(0, '#0369a1');
    dGrad.addColorStop(0.3, '#0284c7');
    dGrad.addColorStop(0.7, '#38bdf8');
    dGrad.addColorStop(1, '#fbbf24'); // Golden yellow fin tip
    ctx.fillStyle = dGrad;
    ctx.fill();

    // Fin rays with blue & gold bands
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Falcate Angular Anal Fin
   */
  private renderSmoothAnalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 2.0;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(10 * s, 20 * s);
    // Tall falcate anterior lobe extending low and back
    ctx.bezierCurveTo(14 * s, 32 * s + wave * 0.6, 20 * s, 40 * s + wave, 24 * s, 42 * s + wave);
    // Scalloped trailing margin
    ctx.quadraticCurveTo(28 * s, 28 * s + wave * 0.5, 38 * s, 12 * s);
    ctx.lineTo(10 * s, 20 * s);
    ctx.closePath();

    const aGrad = ctx.createLinearGradient(12 * s, 20 * s, 22 * s, 42 * s);
    aGrad.addColorStop(0, '#0369a1');
    aGrad.addColorStop(0.3, '#0284c7');
    aGrad.addColorStop(0.7, '#38bdf8');
    aGrad.addColorStop(1, '#fbbf24'); // Golden yellow tip
    ctx.fillStyle = aGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Elaborate Scalloped Caudal Tail with Long Streaming Filaments
   */
  private renderSmoothElaborateTail(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 3.0;

    ctx.save();
    // 1. Tail Main Webbing
    ctx.beginPath();
    ctx.moveTo(46 * s, -5 * s);
    // Upper lobe curve
    ctx.bezierCurveTo(58 * s, -14 * s + wave * 0.4, 70 * s, -22 * s + wave * 0.8, 86 * s, -26 * s + wave);
    // Long streaming upper filament tip
    ctx.quadraticCurveTo(98 * s, -30 * s + wave * 1.2, 108 * s, -34 * s + wave * 1.4);
    ctx.quadraticCurveTo(94 * s, -22 * s + wave, 76 * s, -8 * s + wave * 0.5);
    // Crescent inner tail margin
    ctx.quadraticCurveTo(68 * s, 0, 76 * s, 8 * s + wave * 0.5);
    // Lower lobe and long streaming lower filament tip
    ctx.quadraticCurveTo(94 * s, 22 * s + wave, 108 * s, 34 * s + wave * 1.4);
    ctx.quadraticCurveTo(98 * s, 30 * s + wave * 1.2, 86 * s, 26 * s + wave);
    ctx.bezierCurveTo(70 * s, 22 * s + wave * 0.8, 58 * s, 14 * s + wave * 0.4, 46 * s, 5 * s);
    ctx.closePath();

    const tailGrad = ctx.createLinearGradient(46 * s, 0, 108 * s, 0);
    tailGrad.addColorStop(0, '#0369a1');   // Deep ocean turquoise root
    tailGrad.addColorStop(0.35, '#0284c7'); // Electric cyan
    tailGrad.addColorStop(0.7, '#38bdf8');  // Brilliant sky turquoise
    tailGrad.addColorStop(0.9, '#facc15');  // Golden amber inner crescent
    tailGrad.addColorStop(1, '#fbbf24');   // Streamer filament tips
    ctx.fillStyle = tailGrad;
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Streamer Highlights
    ctx.beginPath();
    ctx.moveTo(76 * s, -8 * s);
    ctx.quadraticCurveTo(92 * s, -22 * s, 108 * s, -34 * s + wave * 1.4);
    ctx.moveTo(76 * s, 8 * s);
    ctx.quadraticCurveTo(92 * s, 22 * s, 108 * s, 34 * s + wave * 1.4);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Small Puckered Mouth with Chisel Teeth
   */
  private renderSmoothPuckeredMouth(ctx: CanvasRenderingContext2D, s: number) {
    const mouthOpen = this.mouthAperture;

    ctx.save();
    // Fleshy puckered lips
    ctx.beginPath();
    ctx.moveTo(-36 * s, 1.5 * s);
    ctx.quadraticCurveTo(-40 * s, 2.5 * s, -38 * s, 4.5 * mouthOpen * s);
    ctx.quadraticCurveTo(-35 * s, 6.0 * mouthOpen * s, -33 * s, 5.0 * s);
    ctx.quadraticCurveTo(-34 * s, 2.5 * s, -36 * s, 1.5 * s);
    ctx.closePath();

    const lipGrad = ctx.createLinearGradient(-40 * s, 1 * s, -33 * s, 5 * s);
    lipGrad.addColorStop(0, '#f97316'); // Warm coral orange
    lipGrad.addColorStop(0.7, '#fbbf24'); // Golden yellow
    lipGrad.addColorStop(1, '#38bdf8'); // Cyan base
    ctx.fillStyle = lipGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.8)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Chisel-like dental plate visible inside
    ctx.beginPath();
    ctx.moveTo(-37 * s, 3.0 * s);
    ctx.lineTo(-35 * s, 3.0 * s);
    ctx.lineTo(-36 * s, 4.2 * s);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Large Expressive Eye with Radiant Blue Lines
   */
  private renderSmoothRadiantEye(ctx: CanvasRenderingContext2D, s: number) {
    const eyeX = -14 * s;
    const eyeY = -14 * s;
    const eyeRadius = 4.4 * s;

    ctx.save();
    // Radiant Iridescent Blue Lines (Hallmark of Balistes vetula)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    // Lines radiating outward towards forehead and cheek
    ctx.moveTo(eyeX - 3.5 * s, eyeY - 2.5 * s); ctx.lineTo(eyeX - 9 * s, eyeY - 6 * s);
    ctx.moveTo(eyeX - 4.0 * s, eyeY + 1.0 * s); ctx.lineTo(eyeX - 10 * s, eyeY + 2.5 * s);
    ctx.moveTo(eyeX - 1.5 * s, eyeY - 4.0 * s); ctx.lineTo(eyeX - 3 * s, eyeY - 9 * s);
    ctx.moveTo(eyeX + 2.0 * s, eyeY - 4.0 * s); ctx.lineTo(eyeX + 5 * s, eyeY - 8 * s);
    ctx.moveTo(eyeX + 3.5 * s, eyeY - 1.5 * s); ctx.lineTo(eyeX + 8 * s, eyeY - 3 * s);
    ctx.stroke();

    // Outer Orange/Gold Orbital Ring
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius + 1.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // Blue Orbital Inner Trim
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius + 0.3 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();

    // Golden-Amber Iris
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(eyeX, eyeY, 0.8 * s, eyeX, eyeY, eyeRadius);
    irisGrad.addColorStop(0, '#fef08a');
    irisGrad.addColorStop(0.5, '#f59e0b');
    irisGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Deep Dark Pupil
    ctx.beginPath();
    ctx.arc(eyeX - 0.2 * s, eyeY, eyeRadius * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();

    // Specular Highlight
    ctx.beginPath();
    ctx.arc(eyeX - 1.2 * s, eyeY - 1.2 * s, 1.3 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeX + 1.0 * s, eyeY + 1.0 * s, 0.6 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Angular Translucent Pectoral Fin
   */
  private renderSmoothPectoralFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const scullAngle = finFlutter * 0.35;

    ctx.save();
    const rootX = -4 * s;
    const rootY = 4 * s;
    ctx.translate(rootX, rootY);
    ctx.rotate(scullAngle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(8 * s, -8 * s, 18 * s, -6 * s, 20 * s, 0);
    ctx.bezierCurveTo(22 * s, 6 * s, 14 * s, 12 * s, 4 * s, 8 * s);
    ctx.closePath();

    const pecGrad = ctx.createLinearGradient(0, 0, 20 * s, 4 * s);
    pecGrad.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
    pecGrad.addColorStop(0.6, 'rgba(250, 204, 21, 0.75)');
    pecGrad.addColorStop(1, 'rgba(251, 146, 60, 0.65)');
    ctx.fillStyle = pecGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  // =========================================================================
  // FRONT-FACING VIEW RENDERING (Queen Triggerfish)
  // Highly compressed diamond keel, puckered mouth, erect trigger spine,
  // radiant blue eye markings, and symmetrical angular fin crests.
  // =========================================================================

  private renderFrontFacing(
    ctx: CanvasRenderingContext2D,
    s: number,
    breath: number,
    finFlutter: number,
    spineFlex: number,
    alpha: number = 1.0
  ) {
    ctx.save();
    if (alpha < 1.0) {
      ctx.globalAlpha = ctx.globalAlpha * alpha;
    }

    const mouthOpen = this.mouthAperture;
    const breathShift = breath * 1.5;
    const flare = breath * 2.2;

    // 1. Symmetrical Pectoral Fins
    this.renderFrontSmoothPectoralFins(ctx, s, finFlutter);

    // 2. Erect Dorsal Trigger Spine Tip
    this.renderFrontSmoothTriggerSpine(ctx, s, spineFlex);

    // 3. Tall Angular Second Dorsal & Anal Fin Crests
    this.renderFrontSmoothFinCrests(ctx, s, finFlutter);

    // 4. Highly Compressed Diamond Head Vault & Keel
    this.renderFrontSmoothHeadVault(ctx, s, breathShift, flare);

    // 5. Puckered Mouth & Chisel Teeth
    this.renderFrontSmoothPuckeredMouth(ctx, s, mouthOpen);

    // 6. High-Set Radiant Eyes
    this.renderFrontSmoothEyes(ctx, s);

    ctx.restore();
  }

  private renderFrontSmoothPectoralFins(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const scullLeft = finFlutter * 0.30;
    const scullRight = -finFlutter * 0.30;

    for (const side of [-1, 1]) {
      ctx.save();
      const rootX = side * 14 * s;
      const rootY = 4 * s;
      ctx.translate(rootX, rootY);
      ctx.rotate(side === -1 ? scullLeft : scullRight);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(side * 10 * s, -8 * s, side * 22 * s, -4 * s, side * 24 * s, 3 * s);
      ctx.bezierCurveTo(side * 20 * s, 10 * s, side * 8 * s, 12 * s, 0, 0);
      ctx.closePath();

      const fGrad = ctx.createLinearGradient(0, 0, side * 24 * s, 3 * s);
      fGrad.addColorStop(0, 'rgba(56, 189, 248, 0.8)');
      fGrad.addColorStop(0.6, 'rgba(250, 204, 21, 0.7)');
      fGrad.addColorStop(1, 'rgba(251, 146, 60, 0.6)');
      ctx.fillStyle = fGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderFrontSmoothTriggerSpine(ctx: CanvasRenderingContext2D, s: number, spineFlex: number) {
    const wave = spineFlex * 1.0;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, -22 * s);
    ctx.bezierCurveTo(-4 * s, -30 * s + wave, -2 * s, -38 * s + wave, 0, -40 * s + wave);
    ctx.bezierCurveTo(2 * s, -38 * s + wave, 4 * s, -30 * s + wave, 0, -22 * s);
    ctx.closePath();

    const sGrad = ctx.createLinearGradient(0, -22 * s, 0, -40 * s);
    sGrad.addColorStop(0, '#0d9488');
    sGrad.addColorStop(0.6, '#0284c7');
    sGrad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = sGrad;
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  private renderFrontSmoothFinCrests(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.5;

    ctx.save();
    // Second Dorsal Crest Tip
    ctx.beginPath();
    ctx.moveTo(0, -24 * s);
    ctx.lineTo(-6 * s, -42 * s + wave);
    ctx.lineTo(6 * s, -42 * s + wave);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.fill();

    // Anal Fin Crest Tip
    ctx.beginPath();
    ctx.moveTo(0, 22 * s);
    ctx.lineTo(-6 * s, 40 * s + wave);
    ctx.lineTo(6 * s, 40 * s + wave);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.fill();
    ctx.restore();
  }

  private renderFrontSmoothHeadVault(ctx: CanvasRenderingContext2D, s: number, breathShift: number, flare: number) {
    ctx.save();
    ctx.beginPath();
    // High narrow dorsal ridge
    ctx.moveTo(0, -24 * s);
    // Steep diamond slope to high-set eyes & cheeks
    ctx.bezierCurveTo(-10 * s, -20 * s, -16 * s - flare * 0.5, -10 * s, -18 * s - flare, 0);
    // Narrowing to ventral keel
    ctx.bezierCurveTo(-16 * s - flare, 10 * s, -8 * s, 20 * s + breathShift, 0, 22 * s + breathShift);
    // Symmetrical right side
    ctx.bezierCurveTo(8 * s, 20 * s + breathShift, 16 * s + flare, 10 * s, 18 * s + flare, 0);
    ctx.bezierCurveTo(16 * s + flare * 0.5, -10 * s, 10 * s, -20 * s, 0, -24 * s);
    ctx.closePath();

    const vaultGrad = ctx.createRadialGradient(0, -4 * s, 2 * s, 0, 0, 26 * s);
    vaultGrad.addColorStop(0, '#0d9488'); // Emerald teal center
    vaultGrad.addColorStop(0.45, '#0284c7'); // Turquoise
    vaultGrad.addColorStop(0.8, '#0369a1'); // Ocean blue
    vaultGrad.addColorStop(1, '#065f46');  // Deep emerald outer rim
    ctx.fillStyle = vaultGrad;
    ctx.fill();

    // Electric-blue facial stripe bands glowing on the sides
    ctx.beginPath();
    ctx.ellipse(-12 * s, 2 * s, 3.5 * s, 1.5 * s, -0.2, 0, Math.PI * 2);
    ctx.ellipse(12 * s, 2 * s, 3.5 * s, 1.5 * s, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();

    // Warm orange throat glow on lower keel
    ctx.beginPath();
    ctx.ellipse(0, 14 * s, 7 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 146, 60, 0.7)';
    ctx.fill();

    ctx.restore();
  }

  private renderFrontSmoothPuckeredMouth(ctx: CanvasRenderingContext2D, s: number, mouthOpen: number) {
    const rx = 6.5 * s;
    const ry = 4.2 * mouthOpen * s;
    const cy = 6 * s;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
    const mouthGrad = ctx.createRadialGradient(0, cy, 1 * s, 0, cy, rx);
    mouthGrad.addColorStop(0, '#0f172a');
    mouthGrad.addColorStop(0.6, '#f97316');
    mouthGrad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = mouthGrad;
    ctx.fill();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Front chisel teeth
    ctx.beginPath();
    ctx.rect(-1.5 * s, cy - 1.5 * s, 3.0 * s, 1.5 * s);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  private renderFrontSmoothEyes(ctx: CanvasRenderingContext2D, s: number) {
    for (const side of [-1, 1]) {
      const eyeX = side * 15 * s;
      const eyeY = -12 * s;
      const eyeRadius = 3.6 * s;

      ctx.save();
      // Radiant lines
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(eyeX + side * 3 * s, eyeY - 2 * s); ctx.lineTo(eyeX + side * 6 * s, eyeY - 4 * s);
      ctx.moveTo(eyeX + side * 3 * s, eyeY + 2 * s); ctx.lineTo(eyeX + side * 6 * s, eyeY + 4 * s);
      ctx.stroke();

      // Gold orbital ring
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeRadius + 0.8 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      // Iris
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ca8a04';
      ctx.fill();

      // Pupil
      ctx.beginPath();
      ctx.arc(eyeX - side * 0.6 * s, eyeY, eyeRadius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#020617';
      ctx.fill();

      // Specular
      ctx.beginPath();
      ctx.arc(eyeX - side * 1.1 * s, eyeY - 1.0 * s, 1.2 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  }
}

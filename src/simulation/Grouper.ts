import { Vector2D, Parasite } from '../types';
import { lerp, clamp } from '../utils/math';
import { parasiteUnit, drawParasite, drawEatRing, subsampleParasites } from './parasiteFx';

export interface CleaningTargetSpot {
  id: string;
  name: string;
  pos: Vector2D;
}

export class Grouper {
  public pos: Vector2D = { x: 0, y: 0 };
  public targetPos: Vector2D = { x: 0, y: 0 };
  public heading: number = Math.PI; // Facing left toward the cleaner wrasse in profile
  
  // Scale 7.52 (1.6x relative to Queen Triggerfish baseline 4.7)
  public scale: number = 4.5;
  
  public state: 'entering' | 'stationary' | 'exiting' | 'exited' = 'entering';
  public entrySpeed: number = 2.4;
  public exitSpeed: number = 3.2;
  
  public animTime: number = 0;
  public breathPhase: number = 0;
  public finPhase: number = 0;
  public mouthAperture: number = 1.0; // Wide open mouth
  
  public isVisible: boolean = true;

  // Procedural Turn & Perspective Facing State
  public facingPlayer: boolean = false;
  public turnProgress: number = 0; // 0.0 = Profile (side view), 1.0 = Facing Player (looking into mouth)
  public turnSpeed: number = 0.0075; // Slow, majestic, realistic turning speed (~2.5s duration)
  public turnVelocity: number = 0;

  // Parasites to be cleaned
  public parasites: Parasite[] = [];

  // Cavity gates driven by the ClientDirector (1 = open/eatable):
  // gill parasites hide under the operculum flap, teeth behind the lips.
  public gillOpen: number = 1;
  public mouthGate: number = 1;
  public gillWiggle: number = 0; // pre-clamp warning tremor on the flap

  constructor(canvasWidth: number, canvasHeight: number) {
    // Start offscreen to the right
    this.pos = {
      x: canvasWidth + 400,
      y: canvasHeight * 0.50,
    };
    this.targetPos = {
      x: this.getProfileTargetX(canvasWidth),
      y: canvasHeight * 0.50,
    };

    this.initParasites();
    this.parasites = subsampleParasites(this.parasites, 16);
  }

  /**
   * Initialize 1-pixel brown parasite marks all over the teeth and scattered across the body
   */
  private initParasites() {
    this.parasites = [];
    let id = 1;

    // --- 1. Parasites all over the teeth in profile view ---
    // Upper teeth & upper dental margin
    const upperTeethCoords = [
      { x: -42.8, y: -6.8 },
      { x: -41.5, y: -5.2 },
      { x: -40.2, y: -7.5 },
      { x: -43.2, y: -8.5 },
      { x: -39.0, y: -7.0 },
      { x: -37.8, y: -5.5 },
      { x: -36.2, y: -4.2 },
      { x: -35.0, y: -6.0 },
      { x: -38.2, y: -6.8 },
      { x: -33.8, y: -5.0 },
      { x: -32.5, y: -4.5 },
      { x: -31.0, y: -3.2 },
      { x: -29.8, y: -4.8 },
      { x: -34.2, y: -6.2 },
      { x: -28.2, y: -6.5 },
      { x: -42.0, y: -6.0 },
      { x: -36.8, y: -4.8 },
      { x: -31.8, y: -3.8 },
    ];

    for (const c of upperTeethCoords) {
      this.parasites.push({
        id: id++,
        type: 'teeth',
        localX: c.x,
        localY: c.y,
        attachPart: 'upperTeeth',
        hoverTimer: 0,
        removed: false,
      });
    }

    // Lower teeth & lower dental margin (moves dynamically with mouthAperture)
    const lowerTeethCoords = [
      { x: -44.8, y: 10.2 },
      { x: -43.2, y: 7.5 },
      { x: -41.8, y: 9.8 },
      { x: -45.8, y: 11.2 },
      { x: -40.5, y: 9.2 },
      { x: -38.8, y: 8.2 },
      { x: -37.2, y: 5.5 },
      { x: -35.6, y: 7.8 },
      { x: -39.2, y: 9.0 },
      { x: -34.2, y: 7.0 },
      { x: -32.6, y: 6.5 },
      { x: -31.0, y: 4.5 },
      { x: -29.5, y: 6.2 },
      { x: -33.5, y: 5.8 },
      { x: -27.5, y: 8.5 },
      { x: -44.0, y: 8.5 },
      { x: -36.5, y: 6.0 },
      { x: -30.5, y: 5.0 },
    ];

    for (const c of lowerTeethCoords) {
      this.parasites.push({
        id: id++,
        type: 'teeth',
        localX: c.x,
        localY: c.y,
        attachPart: 'lowerTeeth',
        hoverTimer: 0,
        removed: false,
      });
    }

    // --- 2. Parasites scattered across the grouper's body ---
    // Snout, Brow & Cranium
    const headCoords = [
      { x: -40.5, y: -14.0, part: 'body' as const },
      { x: -37.0, y: -16.5, part: 'body' as const },
      { x: -34.5, y: -18.2, part: 'body' as const },
      { x: -30.0, y: -19.5, part: 'body' as const },
      { x: -32.5, y: -14.5, part: 'body' as const },
      { x: -26.5, y: -22.0, part: 'body' as const },
      { x: -22.0, y: -23.5, part: 'body' as const },
      { x: -18.5, y: -25.5, part: 'body' as const },
      { x: -14.0, y: -26.5, part: 'body' as const },
      { x: -24.5, y: -16.0, part: 'body' as const },
      { x: -20.0, y: -13.0, part: 'body' as const },
    ];

    for (const c of headCoords) {
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

    // Operculum & Cheek
    const operculumCoords = [
      { x: -16.0, y: 4.0, part: 'operculum' as const },
      { x: -12.5, y: -2.0, part: 'operculum' as const },
      { x: -8.0, y: -8.0, part: 'operculum' as const },
      { x: -6.0, y: 2.0, part: 'operculum' as const },
      { x: -14.5, y: 8.0, part: 'operculum' as const },
      { x: -10.0, y: 6.0, part: 'operculum' as const },
      { x: -4.5, y: 8.0, part: 'operculum' as const },
      { x: -18.0, y: 9.5, part: 'body' as const },
    ];

    for (const c of operculumCoords) {
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

    // Dorsal Crest & Upper Flank
    const dorsalCoords = [
      { x: -6.0, y: -26.0, part: 'body' as const },
      { x: 0.0, y: -27.5, part: 'body' as const },
      { x: 6.0, y: -28.0, part: 'body' as const },
      { x: 12.0, y: -25.5, part: 'body' as const },
      { x: 18.0, y: -26.0, part: 'body' as const },
      { x: 24.0, y: -24.5, part: 'body' as const },
      { x: 30.0, y: -22.5, part: 'body' as const },
      { x: 36.0, y: -20.0, part: 'body' as const },
      { x: 42.0, y: -16.0, part: 'body' as const },
    ];

    for (const c of dorsalCoords) {
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

    // Mid Torso & Lateral Line
    const midTorsoCoords = [
      { x: 0.0, y: -10.0, part: 'body' as const },
      { x: 6.0, y: -8.0, part: 'body' as const },
      { x: 12.0, y: -6.0, part: 'body' as const },
      { x: 18.0, y: -4.0, part: 'body' as const },
      { x: 24.0, y: -6.0, part: 'body' as const },
      { x: 30.0, y: -4.0, part: 'body' as const },
      { x: 36.0, y: -2.0, part: 'body' as const },
      { x: 42.0, y: -4.0, part: 'body' as const },
      { x: 48.0, y: -2.0, part: 'body' as const },
    ];

    for (const c of midTorsoCoords) {
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

    // Lower Flank & Belly (moves with breathing flex)
    const bellyCoords = [
      { x: -4.0, y: 16.0, part: 'belly' as const },
      { x: 2.0, y: 20.0, part: 'belly' as const },
      { x: 8.0, y: 22.0, part: 'belly' as const },
      { x: 14.0, y: 23.5, part: 'belly' as const },
      { x: 20.0, y: 21.0, part: 'belly' as const },
      { x: 26.0, y: 19.0, part: 'belly' as const },
      { x: 32.0, y: 16.5, part: 'belly' as const },
      { x: 38.0, y: 14.0, part: 'belly' as const },
      { x: 44.0, y: 10.0, part: 'body' as const },
      { x: 50.0, y: 6.0, part: 'body' as const },
    ];

    for (const c of bellyCoords) {
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

  /**
   * Get the local position of a parasite taking into account scale and anatomical animation
   */
  public getParasiteLocalPos(p: Parasite): Vector2D {
    const s = this.scale;
    const mouthOpen = this.mouthAperture;
    let lx = p.localX * s;
    let ly = p.localY * s;

    if (p.attachPart === 'lowerTeeth') {
      ly = p.localY * mouthOpen * s;
    } else if (p.attachPart === 'belly') {
      ly = (p.localY * s) + (Math.sin(this.breathPhase) * 1.5);
    } else if (p.attachPart === 'operculum') {
      lx = (p.localX * s) - (Math.sin(this.breathPhase) * 2.2);
    }

    return { x: lx, y: ly };
  }

  /**
   * Get the world position of a parasite
   */
  public getParasiteWorldPos(p: Parasite): Vector2D {
    const local = this.getParasiteLocalPos(p);
    return {
      x: this.pos.x + local.x,
      y: this.pos.y + local.y,
    };
  }

  /**
   * Update parasite eating logic:
   * Parasite is eaten immediately whenever either fish's mouth goes over it.
   */
  public updateParasites(
    wrasseMouth: Vector2D | null,
    gobiMouth: Vector2D | null,
    _dt: number,
    wrasseScale: number = 0.9,
    gobiScale: number = 0.65
  ) {

    // Generous mouth touch radius so swimming over/near the parasite pixel eats it instantly
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
        if (d <= wrasseEatDist) {
          isEaten = true;
        }
      }

      if (!isEaten && gobiMouth) {
        const d = Math.hypot(wPos.x - gobiMouth.x, wPos.y - gobiMouth.y);
        if (d <= gobiEatDist) {
          isEaten = true;
        }
      }

      if (isEaten) {
        p.removed = true;
        p.hoverTimer = 1;
      }
    }
  }

  /**
   * Get positions of all active (unremoved) parasites to allow fish AI to naturally target them
   */
  public getActiveParasitePositions(): Vector2D[] {
    const spots: Vector2D[] = [];
    for (const p of this.parasites) {
      if (!p.removed) {
        spots.push(this.getParasiteWorldPos(p));
      }
    }
    return spots;
  }

  /**
   * Get parasite summary statistics
   */
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
    const remaining = total - removed;

    return {
      total,
      remaining,
      removed,
      teethRemaining: teethTotal - teethRemoved,
      bodyRemaining: bodyTotal - bodyRemoved,
    };
  }

  /**
   * Calculate target X so the entire fish (from snout to caudal tail tip) is fully visible,
   * anchored cleanly on the right side of the screen.
   */
  private getProfileTargetX(canvasWidth: number): number {
    const s = this.scale;
    // Whole body length from snout (-47 * s) to caudal fin tip (+94 * s) is ~141 * s.
    // Anchoring pos.x so the tail is comfortably inside the right margin of the canvas.
    return canvasWidth - (95 * s + 24);
  }

  private getFacingTargetX(canvasWidth: number): number {
    // In front-facing view, position near the right-third of the screen for prominent framing
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
    // Profile view hit box
    const minX = -48 * s;
    const maxX = 45 * s;
    const minY = -42 * s;
    const maxY = 36 * s;
    return dx >= minX && dx <= maxX && dy >= minY && dy <= maxY;
  }

  public update(width: number, height: number, dt: number = 1) {
    const safeDt = clamp(dt, 0.2, 2.0);
    this.animTime += 0.03 * safeDt;
    this.breathPhase += 0.035 * safeDt;
    this.finPhase += 0.05 * safeDt;

    this.turnProgress = 0;
    this.facingPlayer = false;

    // Target positions based on profile state
    const profileX = this.getProfileTargetX(width);
    const desiredTargetY = height * 0.50;

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
      // Reversing backwards to the right off screen
      this.pos.x += this.exitSpeed * 1.5 * safeDt;
      const buoyancyY = Math.sin(this.breathPhase * 0.7) * 2.0;
      this.pos.y = lerp(this.pos.y, this.targetPos.y + buoyancyY, 0.035 * safeDt);
      if (this.pos.x > width + 500) {
        this.state = 'exited';
        this.isVisible = false;
      }
    } else if (this.state === 'stationary') {
      // Stationary floating hover with subtle organic buoyancy bobbing
      const buoyancyY = Math.sin(this.breathPhase * 0.7) * 3.5;
      const buoyancyX = Math.cos(this.breathPhase * 0.45) * 1.5;
      
      this.pos.x = lerp(this.pos.x, this.targetPos.x + buoyancyX, 0.035 * safeDt);
      this.pos.y = lerp(this.pos.y, this.targetPos.y + buoyancyY, 0.035 * safeDt);
    }

    // Rhythmic breathing jaw aperture flex
    this.mouthAperture = 0.92 + Math.sin(this.breathPhase) * 0.07;
  }

  /**
   * Returns positions where the cleaner wrasse / goby can come to inspect/clean
   */
  public getCleaningStationSpots(): CleaningTargetSpot[] {
    const s = this.scale;

    // Profile positions
    const profMouth: Vector2D = {
      x: this.pos.x - 39 * s,
      y: this.pos.y + 4 * s,
    };
    const profGill: Vector2D = {
      x: this.pos.x - 18 * s,
      y: this.pos.y - 5 * s,
    };
    const profFlank: Vector2D = {
      x: this.pos.x + 8 * s,
      y: this.pos.y - 10 * s,
    };

    return [
      {
        id: 'mouth',
        name: 'Oral Cavity',
        pos: profMouth,
      },
      {
        id: 'gill-left',
        name: 'Opercular Slit',
        pos: profGill,
      },
      {
        id: 'flank',
        name: 'Dorsal Flank',
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

    // Always pure profile view
    this.renderProfile(ctx, s, breath, finFlutter, 1.0);

    ctx.restore();
  }

  /**
   * Helper to draw a single faceted low-poly triangle
   */
  private drawPoly(
    ctx: CanvasRenderingContext2D,
    pts: Vector2D[],
    fillColor: string,
    strokeColor: string = 'rgba(255,255,255,0.14)',
    alpha: number = 1.0
  ) {
    if (pts.length < 3) return;
    ctx.save();
    if (alpha < 1.0) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ctx.globalAlpha * alpha));
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    if (strokeColor && strokeColor !== 'transparent') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }
    ctx.restore();
  }

  // =========================================================================
  // PROFILE VIEW RENDERING (Smooth Rounded Low-Poly Aesthetic)
  // =========================================================================

  private renderProfile(
    ctx: CanvasRenderingContext2D,
    s: number,
    breath: number,
    finFlutter: number,
    alpha: number = 1.0
  ) {
    ctx.save();
    if (alpha < 1.0) {
      ctx.globalAlpha = ctx.globalAlpha * alpha;
    }

    // 1. Smooth Spiny & Soft Dorsal Fin (Behind Body)
    this.renderSmoothDorsalFin(ctx, s, finFlutter);

    // 2. Smooth Anal Fin & Pelvic Fin (Behind Body)
    this.renderSmoothAnalFin(ctx, s, finFlutter);
    this.renderSmoothPelvicFin(ctx, s, finFlutter);

    // 3. Smooth Broad Rounded Caudal Tail Fin
    this.renderSmoothCaudalFin(ctx, s, finFlutter);

    // 4. Smooth Oral Cavity & Throat (Inner Dark Layer)
    this.renderSmoothOralCavity(ctx, s);

    // 5. Main Smooth Low-Poly Predatory Body (Coral Amber / Vermilion)
    this.renderSmoothMainBody(ctx, s, breath);

    // 6. Smooth Jaws, Fleshy Lips & Conical Teeth
    this.renderSmoothJawsAndTeeth(ctx, s);

    // 7. Smooth Opercular Gill Flap & Breathing Flare
    this.renderSmoothOperculum(ctx, s, breath);

    // 8. Bioluminescent Cyan Jewel Spots
    this.renderBioluminescentSpots(ctx, s);

    // 9. Large Round Expressive Predatory Eye
    this.renderSmoothEye(ctx, s);

    // 10. Translucent Smooth Pectoral Fin (Foreground Fan)
    this.renderSmoothPectoralFin(ctx, s, finFlutter);

    // 11. Parasites
    this.renderParasites(ctx);

    ctx.restore();
  }

  /**
   * Render 2-pixel brown parasite marks across teeth and body
   */
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
   * Deep cavernous oral cavity interior with realistic depth gradient
   */
  private renderSmoothOralCavity(ctx: CanvasRenderingContext2D, s: number) {
    const mouthOpen = this.mouthAperture;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-34 * s, -6 * s);
    ctx.quadraticCurveTo(-44 * s, -10 * s, -42 * s, -9 * s);
    ctx.quadraticCurveTo(-30 * s, 0, -22 * s, 2 * s);
    ctx.quadraticCurveTo(-26 * s, 10 * s, -38 * s, 15 * mouthOpen * s);
    ctx.quadraticCurveTo(-44 * s, 14 * mouthOpen * s, -47 * s, 12 * mouthOpen * s);
    ctx.quadraticCurveTo(-36 * s, 6 * mouthOpen * s, -28 * s, 0);
    ctx.closePath();

    const mouthGrad = ctx.createRadialGradient(-26 * s, 2 * s, 2 * s, -34 * s, 2 * s, 20 * s);
    mouthGrad.addColorStop(0, '#030102'); // Pitch black gullet center
    mouthGrad.addColorStop(0.5, '#1e0407'); // Deep dark throat
    mouthGrad.addColorStop(0.85, '#5c0a18'); // Pharyngeal walls
    mouthGrad.addColorStop(1, '#881337'); // Fleshy oral mucosa edge
    ctx.fillStyle = mouthGrad;
    ctx.fill();

    // Soft tongue / floor arch
    ctx.beginPath();
    ctx.moveTo(-38 * s, 13 * mouthOpen * s);
    ctx.quadraticCurveTo(-30 * s, 8 * mouthOpen * s, -24 * s, 6 * s);
    ctx.quadraticCurveTo(-28 * s, 12 * s, -36 * s, 15 * mouthOpen * s);
    ctx.closePath();
    ctx.fillStyle = '#9f1239';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Main muscular, robust predatory body silhouette with smooth organic contours,
   * multi-stop coral-vermilion gradients, and soft low-poly anatomical planes.
   */
  private renderSmoothMainBody(ctx: CanvasRenderingContext2D, s: number, breath: number) {
    const bShift = breath * 1.5;
    const mouthOpen = this.mouthAperture;

    // 1. Overall Muscular Predatory Silhouette
    ctx.save();
    ctx.beginPath();
    // Snout tip / upper lip base
    ctx.moveTo(-44 * s, -10 * s);
    // Smooth nasal bridge & brow slope
    ctx.bezierCurveTo(-38 * s, -18 * s, -26 * s, -24 * s, -10 * s, -28 * s);
    // Powerful arched muscular nape & dorsal line
    ctx.bezierCurveTo(8 * s, -30 * s, 30 * s, -27 * s, 48 * s, -18 * s);
    // Caudal peduncle top
    ctx.quadraticCurveTo(58 * s, -12 * s, 64 * s, -8 * s);
    // Peduncle rear
    ctx.lineTo(64 * s, 7 * s);
    // Peduncle bottom
    ctx.quadraticCurveTo(56 * s, 11 * s, 44 * s, 14 * s);
    // Deep rounded ventral belly curve
    ctx.bezierCurveTo(28 * s, 22 * s + bShift, 8 * s, 23 * s + bShift, -8 * s, 16 * s + bShift);
    // Lower cheek / throat junction
    ctx.quadraticCurveTo(-24 * s, 18 * s, -34 * s, 14 * mouthOpen * s);
    // Lower mandible underbite tip
    ctx.lineTo(-47 * s, 12 * mouthOpen * s);
    // Inside mouth shelf
    ctx.quadraticCurveTo(-36 * s, 6 * mouthOpen * s, -28 * s, 0);
    ctx.quadraticCurveTo(-34 * s, -5 * s, -44 * s, -10 * s);
    ctx.closePath();

    // Rich Coral-Vermilion to Deep Mahogany Rust Gradient
    const bodyGrad = ctx.createLinearGradient(-35 * s, -25 * s, 50 * s, 20 * s);
    bodyGrad.addColorStop(0, '#f97316');   // Vibrant coral orange at snout
    bodyGrad.addColorStop(0.25, '#ef4444'); // Vivid coral red cranium
    bodyGrad.addColorStop(0.55, '#dc2626'); // Rich crimson mid-flank
    bodyGrad.addColorStop(0.8, '#b91c1c');  // Deep vermilion rear
    bodyGrad.addColorStop(1, '#7f1d1d');   // Dark mahogany peduncle
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.restore();

    // 2. Soft Anatomical Planes (Smooth Low-Poly Character)
    // Cranium & Forehead Dome (Warm coral highlight)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-44 * s, -10 * s);
    ctx.quadraticCurveTo(-34 * s, -20 * s, -10 * s, -28 * s);
    ctx.quadraticCurveTo(-14 * s, -16 * s, -20 * s, -8 * s);
    ctx.quadraticCurveTo(-32 * s, -6 * s, -44 * s, -10 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(251, 146, 60, 0.45)'; // Bright coral amber sheen
    ctx.fill();
    ctx.restore();

    // Upper Muscular Dorsal Slope
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-10 * s, -28 * s);
    ctx.bezierCurveTo(8 * s, -30 * s, 30 * s, -27 * s, 48 * s, -18 * s);
    ctx.quadraticCurveTo(26 * s, -12 * s, 6 * s, -11 * s);
    ctx.quadraticCurveTo(-6 * s, -16 * s, -10 * s, -28 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(153, 27, 27, 0.55)'; // Deep rich rust shadow
    ctx.fill();
    ctx.restore();

    // Mid-Torso Lateral Shimmer Plane
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-16 * s, -6 * s);
    ctx.quadraticCurveTo(10 * s, -10 * s, 38 * s, -6 * s);
    ctx.quadraticCurveTo(52 * s, 0, 38 * s, 8 * s);
    ctx.quadraticCurveTo(12 * s, 10 * s, -10 * s, 6 * s);
    ctx.quadraticCurveTo(-2 * s, 0, -16 * s, -6 * s);
    ctx.closePath();

    const midGrad = ctx.createRadialGradient(12 * s, 0, 4 * s, 12 * s, 0, 34 * s);
    midGrad.addColorStop(0, 'rgba(239, 68, 68, 0.6)');   // Luminous vermilion
    midGrad.addColorStop(0.6, 'rgba(234, 88, 12, 0.35)'); // Amber mid
    midGrad.addColorStop(1, 'rgba(185, 28, 28, 0.1)');
    ctx.fillStyle = midGrad;
    ctx.fill();
    ctx.restore();

    // Soft Rounded Belly Undercarriage Plane
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-8 * s, 16 * s + bShift);
    ctx.bezierCurveTo(8 * s, 23 * s + bShift, 28 * s, 22 * s + bShift, 44 * s, 14 * s);
    ctx.quadraticCurveTo(24 * s, 10 * s, 6 * s, 8 * s);
    ctx.quadraticCurveTo(-6 * s, 10 * s, -8 * s, 16 * s + bShift);
    ctx.closePath();

    const bellyGrad = ctx.createLinearGradient(0, 8 * s, 0, 24 * s);
    bellyGrad.addColorStop(0, 'rgba(220, 38, 38, 0.2)');
    bellyGrad.addColorStop(1, 'rgba(252, 165, 165, 0.7)'); // Soft pinkish-salmon warm belly
    ctx.fillStyle = bellyGrad;
    ctx.fill();
    ctx.restore();

    // Suborbital Cheek & Muscular Jaw Hinge
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-34 * s, -6 * s);
    ctx.quadraticCurveTo(-24 * s, -6 * s, -16 * s, -4 * s);
    ctx.quadraticCurveTo(-14 * s, 6 * s, -22 * s, 12 * s);
    ctx.quadraticCurveTo(-30 * s, 14 * s, -34 * s, 8 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(234, 88, 12, 0.4)';
    ctx.fill();
    ctx.restore();

    // Subtle, soft polygonal facet lines to maintain stylized low-poly character
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(-36 * s, -16 * s); ctx.lineTo(-20 * s, -8 * s);
    ctx.moveTo(-20 * s, -8 * s); ctx.lineTo(-8 * s, -14 * s);
    ctx.moveTo(-8 * s, -14 * s); ctx.lineTo(12 * s, -10 * s);
    ctx.moveTo(12 * s, -10 * s); ctx.lineTo(32 * s, -7 * s);
    ctx.moveTo(32 * s, -7 * s); ctx.lineTo(50 * s, -5 * s);
    ctx.moveTo(-16 * s, -4 * s); ctx.lineTo(-4 * s, 2 * s);
    ctx.moveTo(-4 * s, 2 * s); ctx.lineTo(16 * s, 2 * s);
    ctx.moveTo(16 * s, 2 * s); ctx.lineTo(36 * s, 2 * s);
    ctx.moveTo(-8 * s, 16 * s + bShift); ctx.lineTo(6 * s, 8 * s);
    ctx.moveTo(6 * s, 8 * s); ctx.lineTo(24 * s, 10 * s);
    ctx.moveTo(24 * s, 10 * s); ctx.lineTo(44 * s, 14 * s);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Predatory Jaws, Fleshy Coral Lips & Sharp Conical Predator Teeth
   */
  private renderSmoothJawsAndTeeth(ctx: CanvasRenderingContext2D, s: number) {
    const mouthOpen = this.mouthAperture;

    // --- Upper Maxilla Lip Arch ---
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-45 * s, -10.5 * s);
    ctx.quadraticCurveTo(-38 * s, -16 * s, -32 * s, -6 * s);
    ctx.quadraticCurveTo(-38 * s, -5 * s, -44 * s, -8.5 * s);
    ctx.closePath();
    const upperLipGrad = ctx.createLinearGradient(-45 * s, -14 * s, -32 * s, -5 * s);
    upperLipGrad.addColorStop(0, '#f97316');
    upperLipGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = upperLipGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
    ctx.restore();

    // Upper Conical Teeth
    const upperTeeth: Vector2D[][] = [
      [{ x: -43 * s, y: -9 * s }, { x: -41.2 * s, y: -4.8 * s }, { x: -39.2 * s, y: -8 * s }],
      [{ x: -38.5 * s, y: -7.2 * s }, { x: -36.5 * s, y: -3.8 * s }, { x: -34.5 * s, y: -6.2 * s }],
      [{ x: -33.5 * s, y: -5.8 * s }, { x: -31.5 * s, y: -2.8 * s }, { x: -29.5 * s, y: -5 * s }],
    ];
    for (const t of upperTeeth) {
      this.drawPoly(ctx, t, '#fef08a', 'rgba(255,255,255,0.4)');
    }

    // --- Lower Mandible Underbite Jaw Arch ---
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-48 * s, 12 * mouthOpen * s);
    ctx.quadraticCurveTo(-38 * s, 19 * s, -26 * s, 16 * s);
    ctx.quadraticCurveTo(-24 * s, 12 * s, -34 * s, 6 * mouthOpen * s);
    ctx.quadraticCurveTo(-42 * s, 9 * mouthOpen * s, -48 * s, 12 * mouthOpen * s);
    ctx.closePath();
    const lowerJawGrad = ctx.createLinearGradient(-48 * s, 8 * s, -26 * s, 18 * s);
    lowerJawGrad.addColorStop(0, '#ea580c');
    lowerJawGrad.addColorStop(0.6, '#c2410c');
    lowerJawGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = lowerJawGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
    ctx.restore();

    // Lower Conical Teeth
    const lowerTeeth: Vector2D[][] = [
      [
        { x: -46 * s, y: 12 * mouthOpen * s },
        { x: -43.8 * s, y: 6.8 * mouthOpen * s },
        { x: -41.8 * s, y: 11 * mouthOpen * s },
      ],
      [
        { x: -39.8 * s, y: 10 * mouthOpen * s },
        { x: -37.8 * s, y: 4.8 * mouthOpen * s },
        { x: -35.8 * s, y: 9 * mouthOpen * s },
      ],
      [
        { x: -33.8 * s, y: 8 * mouthOpen * s },
        { x: -31.8 * s, y: 3.8 * mouthOpen * s },
        { x: -29.8 * s, y: 7 * mouthOpen * s },
      ],
    ];
    for (const t of lowerTeeth) {
      this.drawPoly(ctx, t, '#fef08a', 'rgba(255,255,255,0.4)');
    }
  }

  /**
   * Opercular Gill Flap with organic curved margin, breathing flare, and inner crimson gill shadow
   */
  private renderSmoothOperculum(ctx: CanvasRenderingContext2D, s: number, breath: number) {
    const flare = breath * 2.2;

    ctx.save();
    // Inner dark gill filament cavity behind operculum
    ctx.beginPath();
    ctx.moveTo(-10 * s - flare, -16 * s);
    ctx.quadraticCurveTo(-1 * s - flare, -4 * s, -3 * s - flare, 8 * s);
    ctx.lineTo(1 * s, 0);
    ctx.closePath();
    ctx.fillStyle = '#450a0a';
    ctx.fill();

    // Two crimson gill arches inside the slit - a darker one deeper in,
    // a brighter one in front (real gills stack in rows)
    ctx.beginPath();
    ctx.moveTo(-5 * s - flare * 0.5, -11 * s);
    ctx.quadraticCurveTo(0 * s - flare * 0.7, -3 * s, -2 * s - flare * 0.5, 5 * s);
    ctx.strokeStyle = '#9f1a24';
    ctx.lineWidth = 1.6 * (s / 3.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7 * s - flare * 0.6, -12 * s);
    ctx.quadraticCurveTo(-2 * s - flare * 0.8, -3 * s, -4 * s - flare * 0.6, 6 * s);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.8 * (s / 3.6);
    ctx.stroke();

    // Smooth Opercular Flap Outer Plate - hinged at its top rear so the
    // director can lift it open (gillOpen), with the warning wiggle
    const lift = Math.max(0, this.gillOpen) * 0.25;
    ctx.save();
    ctx.translate(-19 * s, -13 * s);
    ctx.rotate(-Math.max(0, lift));
    ctx.translate(19 * s, 13 * s);
    ctx.beginPath();
    ctx.moveTo(-18 * s, -14 * s);
    ctx.quadraticCurveTo(-8 * s - flare * 0.8, -14 * s, -3 * s - flare, -4 * s);
    ctx.quadraticCurveTo(-4 * s - flare, 6 * s, -12 * s, 10 * s);
    ctx.quadraticCurveTo(-18 * s, 4 * s, -20 * s, -6 * s);
    ctx.closePath();

    const opGrad = ctx.createLinearGradient(-18 * s, -14 * s, -3 * s, 10 * s);
    opGrad.addColorStop(0, '#f97316'); // Coral orange
    opGrad.addColorStop(0.5, '#ea580c');
    opGrad.addColorStop(1, '#dc2626'); // Crimson
    ctx.fillStyle = opGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /**
   * Signature Bioluminescent Cyan Jewel Spots scattered across cranium, cheek and flank
   */
  private renderBioluminescentSpots(ctx: CanvasRenderingContext2D, s: number) {
    const spots = [
      { x: -33 * s, y: -16 * s, r: 2.0 * s },
      { x: -28 * s, y: -19 * s, r: 2.2 * s },
      { x: -20 * s, y: -21 * s, r: 2.1 * s },
      { x: -14 * s, y: -23 * s, r: 2.3 * s },
      { x: -24 * s, y: -3 * s, r: 2.0 * s },
      { x: -18 * s, y: 0 * s, r: 2.2 * s },
      { x: -12 * s, y: 4 * s, r: 1.9 * s },
      { x: 4 * s, y: -18 * s, r: 2.2 * s },
      { x: 14 * s, y: -17 * s, r: 2.4 * s },
      { x: 26 * s, y: -15 * s, r: 2.2 * s },
      { x: 38 * s, y: -12 * s, r: 2.0 * s },
      { x: 8 * s, y: -5 * s, r: 2.1 * s },
      { x: 20 * s, y: -3 * s, r: 2.3 * s },
      { x: 32 * s, y: -1 * s, r: 2.0 * s },
      { x: 44 * s, y: 2 * s, r: 1.9 * s },
      { x: 12 * s, y: 6 * s, r: 2.1 * s },
      { x: 24 * s, y: 8 * s, r: 2.0 * s },
    ];

    ctx.save();
    // Coral-hind style freckling: each anchor becomes a small cluster of
    // flat two-tone dots - patterned skin, not raised beads (and clearly
    // distinct from the parasites, which are ellipses with pale halos).
    let i = 0;
    for (const spot of spots) {
      i++;
      const jit = Math.sin(i * 12.9898) * 43758.5453;
      const j = jit - Math.floor(jit);
      // Satellites stay within ~one bead-radius of the anchor so the
      // cluster never spills past the body silhouette.
      const cluster = [
        { x: spot.x, y: spot.y, r: spot.r * 0.5 },
        { x: spot.x + (0.55 + j * 0.35) * spot.r, y: spot.y + (0.3 - j * 0.75) * spot.r, r: spot.r * 0.3 },
        { x: spot.x - (0.45 + j * 0.3) * spot.r, y: spot.y - (0.2 + j * 0.55) * spot.r, r: spot.r * 0.34 },
      ];
      for (const d of cluster) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(3, 105, 161, 0.8)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(125, 211, 252, 0.9)';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Large Round Expressive Predatory Eye with layered amber iris and luminous glints
   */
  private renderSmoothEye(ctx: CanvasRenderingContext2D, s: number) {
    const eyeX = -26 * s;
    const eyeY = -12 * s;
    const eyeRadius = 5.8 * s;

    ctx.save();
    // Orbital socket bevel
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius + 1.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#450a0a';
    ctx.fill();

    // Sclera / Outer Iris Ring (Deep amber)
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#d97706';
    ctx.fill();

    // Luminous Golden Amber Iris
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius * 0.85, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(eyeX, eyeY, 0.5 * s, eyeX, eyeY, eyeRadius * 0.85);
    irisGrad.addColorStop(0, '#fef08a'); // Bright gold center
    irisGrad.addColorStop(0.6, '#f59e0b'); // Golden amber
    irisGrad.addColorStop(1, '#b45309'); // Warm copper rim
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Deep Black Predatory Pupil
    ctx.beginPath();
    ctx.arc(eyeX - 0.5 * s, eyeY, eyeRadius * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = '#05070c';
    ctx.fill();

    // Crisp Specular Glints
    ctx.beginPath();
    ctx.arc(eyeX - 1.8 * s, eyeY - 1.8 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeX + 1.2 * s, eyeY + 1.2 * s, 0.9 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Smooth Spiny & Soft Dorsal Fin with undulating peaks and electric-blue edge trim
   */
  private renderSmoothDorsalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 2.2;

    ctx.save();
    ctx.beginPath();
    // Origin at nape
    ctx.moveTo(4 * s, -29 * s);
    // Spiny anterior crest with rhythmic serrated peaks
    ctx.quadraticCurveTo(12 * s, -38 * s + wave * 0.4, 18 * s, -41 * s + wave * 0.6);
    ctx.quadraticCurveTo(28 * s, -43 * s + wave * 0.8, 36 * s, -38 * s + wave);
    // Soft rounded posterior lobe
    ctx.quadraticCurveTo(46 * s, -32 * s + wave * 1.2, 52 * s, -22 * s + wave * 0.8);
    // Insertion at peduncle
    ctx.quadraticCurveTo(50 * s, -18 * s, 46 * s, -18 * s);
    ctx.lineTo(4 * s, -29 * s);
    ctx.closePath();

    const dorsalGrad = ctx.createLinearGradient(4 * s, -43 * s, 50 * s, -18 * s);
    dorsalGrad.addColorStop(0, '#ef4444');  // Bright vermilion crest
    dorsalGrad.addColorStop(0.5, '#dc2626'); // Rich red
    dorsalGrad.addColorStop(1, '#991b1b');  // Deep rust base
    ctx.fillStyle = dorsalGrad;
    ctx.fill();

    // Spiny Fin Rays
    ctx.beginPath();
    ctx.moveTo(8 * s, -29 * s); ctx.lineTo(10 * s, -37 * s + wave * 0.4);
    ctx.moveTo(16 * s, -28 * s); ctx.lineTo(18 * s, -41 * s + wave * 0.6);
    ctx.moveTo(24 * s, -26 * s); ctx.lineTo(26 * s, -42 * s + wave * 0.8);
    ctx.moveTo(32 * s, -24 * s); ctx.lineTo(34 * s, -39 * s + wave);
    ctx.moveTo(40 * s, -21 * s); ctx.lineTo(42 * s, -34 * s + wave * 1.1);
    ctx.moveTo(46 * s, -19 * s); ctx.lineTo(48 * s, -27 * s + wave * 0.9);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Electric Cyan Margin Trim
    ctx.beginPath();
    ctx.moveTo(4 * s, -29 * s);
    ctx.quadraticCurveTo(12 * s, -38 * s + wave * 0.4, 18 * s, -41 * s + wave * 0.6);
    ctx.quadraticCurveTo(28 * s, -43 * s + wave * 0.8, 36 * s, -38 * s + wave);
    ctx.quadraticCurveTo(46 * s, -32 * s + wave * 1.2, 52 * s, -22 * s + wave * 0.8);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8 * (s / 3.6);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Smooth Anal Fin with rounded lobe and cyan edge
   */
  private renderSmoothAnalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.8;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(32 * s, 18 * s);
    ctx.quadraticCurveTo(40 * s, 28 * s + wave, 48 * s, 26 * s + wave * 1.1);
    ctx.quadraticCurveTo(54 * s, 20 * s + wave * 0.8, 56 * s, 10 * s);
    ctx.lineTo(32 * s, 18 * s);
    ctx.closePath();

    const analGrad = ctx.createLinearGradient(32 * s, 18 * s, 48 * s, 28 * s);
    analGrad.addColorStop(0, '#dc2626');
    analGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = analGrad;
    ctx.fill();

    // Fin rays
    ctx.beginPath();
    ctx.moveTo(36 * s, 17 * s); ctx.lineTo(40 * s, 27 * s + wave);
    ctx.moveTo(42 * s, 15 * s); ctx.lineTo(46 * s, 26 * s + wave * 1.1);
    ctx.moveTo(48 * s, 13 * s); ctx.lineTo(52 * s, 21 * s + wave * 0.9);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Cyan edge
    ctx.beginPath();
    ctx.moveTo(32 * s, 18 * s);
    ctx.quadraticCurveTo(40 * s, 28 * s + wave, 48 * s, 26 * s + wave * 1.1);
    ctx.quadraticCurveTo(54 * s, 20 * s + wave * 0.8, 56 * s, 10 * s);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6 * (s / 3.6);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Smooth Pelvic Fin with delicate cyan edge
   */
  private renderSmoothPelvicFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.5;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(2 * s, 22 * s);
    ctx.quadraticCurveTo(6 * s, 34 * s + wave, 12 * s, 32 * s + wave);
    ctx.lineTo(14 * s, 21 * s);
    ctx.closePath();

    const pelvicGrad = ctx.createLinearGradient(2 * s, 22 * s, 8 * s, 34 * s);
    pelvicGrad.addColorStop(0, '#ea580c');
    pelvicGrad.addColorStop(1, '#dc2626');
    ctx.fillStyle = pelvicGrad;
    ctx.fill();

    // Cyan edge
    ctx.beginPath();
    ctx.moveTo(2 * s, 22 * s);
    ctx.quadraticCurveTo(6 * s, 34 * s + wave, 12 * s, 32 * s + wave);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4 * (s / 3.6);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Broad Smooth Rounded Fan Caudal Tail Fin with radiating rays and cyan trim
   */
  private renderSmoothCaudalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 3.5;
    const tailLen = 30 * s;

    ctx.save();
    ctx.beginPath();
    // Caudal peduncle top attachment
    ctx.moveTo(64 * s, -8 * s);
    // Smooth convex upper lobe
    ctx.quadraticCurveTo(64 * s + tailLen * 0.6, -18 * s + wave * 0.7, 64 * s + tailLen * 0.95, -12 * s + wave * 0.9);
    // Convex rounded rear caudal edge
    ctx.quadraticCurveTo(64 * s + tailLen * 1.12, 0 * s + wave * 1.2, 64 * s + tailLen * 0.95, 12 * s + wave * 0.9);
    // Lower lobe to peduncle bottom attachment
    ctx.quadraticCurveTo(64 * s + tailLen * 0.6, 18 * s + wave * 0.7, 64 * s, 7 * s);
    ctx.closePath();

    const tailGrad = ctx.createLinearGradient(64 * s, 0, 64 * s + tailLen, 0);
    tailGrad.addColorStop(0, '#991b1b');  // Deep rust base
    tailGrad.addColorStop(0.5, '#dc2626'); // Vermilion mid
    tailGrad.addColorStop(1, '#ef4444');  // Bright coral red trailing edge
    ctx.fillStyle = tailGrad;
    ctx.fill();

    // Radiating Caudal Rays
    ctx.beginPath();
    for (let angle = -12; angle <= 12; angle += 4) {
      const startY = (angle / 12) * 6 * s;
      const endX = 64 * s + tailLen * (1.0 - Math.abs(angle) * 0.015);
      const endY = (angle * 1.2) * s + wave * (0.8 + Math.abs(angle) * 0.02);
      ctx.moveTo(64 * s, startY);
      ctx.quadraticCurveTo(64 * s + tailLen * 0.5, (startY + endY) * 0.5, endX, endY);
    }
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Brilliant Cyan Edge Margin
    ctx.beginPath();
    ctx.moveTo(64 * s + tailLen * 0.85, -16 * s + wave * 0.75);
    ctx.quadraticCurveTo(64 * s + tailLen * 1.12, 0 * s + wave * 1.2, 64 * s + tailLen * 0.85, 16 * s + wave * 0.75);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0 * (s / 3.6);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Translucent Smooth Rounded Pectoral Fin sculling gracefully in foreground
   */
  private renderSmoothPectoralFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const scullAngle = finFlutter * 0.35;

    ctx.save();
    const rootX = 6 * s;
    const rootY = 6 * s;
    ctx.translate(rootX, rootY);
    ctx.rotate(scullAngle);

    const finLen = 24 * s;

    // Translucent rounded paddle fan
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(finLen * 0.6, -12 * s, finLen * 0.95, -6 * s);
    ctx.quadraticCurveTo(finLen * 1.1, 4 * s, finLen * 0.85, 14 * s);
    ctx.quadraticCurveTo(finLen * 0.4, 12 * s, 0, 0);
    ctx.closePath();

    const pecGrad = ctx.createLinearGradient(0, 0, finLen, 0);
    pecGrad.addColorStop(0, 'rgba(249, 115, 22, 0.85)'); // Warm amber base
    pecGrad.addColorStop(0.6, 'rgba(239, 68, 68, 0.75)'); // Coral red
    pecGrad.addColorStop(1, 'rgba(252, 165, 165, 0.6)'); // Pale pinkish rim
    ctx.fillStyle = pecGrad;
    ctx.fill();

    // Delicate fin rays
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(finLen * 0.9, -6 * s);
    ctx.moveTo(0, 0); ctx.lineTo(finLen * 1.05, 0);
    ctx.moveTo(0, 0); ctx.lineTo(finLen * 1.0, 6 * s);
    ctx.moveTo(0, 0); ctx.lineTo(finLen * 0.8, 12 * s);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Cyan edge trim
    ctx.beginPath();
    ctx.moveTo(finLen * 0.95, -6 * s);
    ctx.quadraticCurveTo(finLen * 1.1, 4 * s, finLen * 0.85, 14 * s);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.restore();
  }

  // =========================================================================
  // FRONT-FACING VIEW RENDERING (Looking directly into the Cavernous Mouth)
  // =========================================================================

  private renderFrontFacing(
    ctx: CanvasRenderingContext2D,
    s: number,
    breath: number,
    finFlutter: number,
    alpha: number = 1.0
  ) {
    ctx.save();
    if (alpha < 1.0) {
      ctx.globalAlpha = ctx.globalAlpha * alpha;
    }

    const mouthOpen = this.mouthAperture;
    const breathShift = breath * 2.0;
    const flare = breath * 3.5;

    // --- 1. Symmetrical Pectoral Fins (Left & Right Fanning Outwards) ---
    this.renderFrontPectoralFins(ctx, s, finFlutter);

    // --- 2. Dorsal Fin Crest Visible Behind Head ---
    this.renderFrontDorsalCrest(ctx, s, finFlutter);

    // --- 3. Outer Cranium, Opercular Cheeks & Chin Facets (Head Silhouette) ---
    this.renderFrontHeadVault(ctx, s, breathShift, flare);

    // --- 4. Deep Cavernous Oral Cavity (Looking Down the Throat) ---
    this.renderFrontOralCavity(ctx, s, mouthOpen);

    // --- 5. Massive Jaws, Lips & Sharp Conical Dental Arches (Teeth) ---
    this.renderFrontJawsAndTeeth(ctx, s, mouthOpen, breathShift);

    // --- 6. Opercular Gill Slits (Left & Right Glowing Gills) ---
    this.renderFrontOpercula(ctx, s, flare);

    // --- 7. Prominent Forward/Lateral Staring Predatory Eyes ---
    this.renderFrontEyes(ctx, s);

    ctx.restore();
  }

  /**
   * Symmetrical pectoral fins undulating on left and right sides
   */
  private renderFrontPectoralFins(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const scullLeft = finFlutter * 0.28;
    const scullRight = -finFlutter * 0.28;

    for (const side of [-1, 1]) {
      ctx.save();
      const rootX = side * 24 * s;
      const rootY = 12 * s;
      ctx.translate(rootX, rootY);
      ctx.rotate(side === -1 ? scullLeft : scullRight);

      const fLen = 28 * s;
      const r1: Vector2D = { x: side * fLen * 0.85, y: -12 * s };
      const r2: Vector2D = { x: side * fLen * 1.05, y: -2 * s };
      const r3: Vector2D = { x: side * fLen * 0.95, y: 10 * s };
      const r4: Vector2D = { x: side * fLen * 0.70, y: 18 * s };
      const root: Vector2D = { x: 0, y: 0 };

      this.drawPoly(ctx, [root, r1, r2], 'rgba(239, 68, 68, 0.75)', 'rgba(255,255,255,0.3)');
      this.drawPoly(ctx, [root, r2, r3], 'rgba(249, 115, 22, 0.8)', 'rgba(255,255,255,0.3)');
      this.drawPoly(ctx, [root, r3, r4], 'rgba(220, 38, 38, 0.75)', 'rgba(255,255,255,0.3)');
      this.drawPoly(ctx, [r1, { x: r1.x + side * 3 * s, y: r1.y - 2 * s }, r2], '#38bdf8', 'rgba(255,255,255,0.5)');

      ctx.restore();
    }
  }

  /**
   * Spiny dorsal crest rising up behind head
   */
  private renderFrontDorsalCrest(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.5;

    const dCenterTop: Vector2D = { x: 0, y: -42 * s + wave };
    const dLeftTop: Vector2D = { x: -14 * s, y: -38 * s + wave * 0.8 };
    const dRightTop: Vector2D = { x: 14 * s, y: -38 * s + wave * 0.8 };
    const dNape: Vector2D = { x: 0, y: -28 * s };

    this.drawPoly(ctx, [dNape, dLeftTop, dCenterTop], '#b91c1c', 'rgba(255,255,255,0.2)');
    this.drawPoly(ctx, [dNape, dCenterTop, dRightTop], '#dc2626', 'rgba(255,255,255,0.2)');

    // Cyan tip margin
    this.drawPoly(ctx, [dLeftTop, { x: 0, y: -45 * s + wave }, dCenterTop], '#38bdf8', 'rgba(255,255,255,0.4)');
    this.drawPoly(ctx, [dCenterTop, { x: 0, y: -45 * s + wave }, dRightTop], '#38bdf8', 'rgba(255,255,255,0.4)');
  }

  /**
   * Head Vault: Muscular cranium, cheekbones, brow ridge, and chin plates
   */
  private renderFrontHeadVault(ctx: CanvasRenderingContext2D, s: number, breathShift: number, flare: number) {
    // Symmetrical landmarks
    const vCrown: Vector2D = { x: 0, y: -28 * s };
    const vForeheadCenter: Vector2D = { x: 0, y: -18 * s };
    const vSnoutBridge: Vector2D = { x: 0, y: -10 * s };

    const vBrowL: Vector2D = { x: -18 * s, y: -22 * s };
    const vBrowR: Vector2D = { x: 18 * s, y: -22 * s };

    const vTempleL: Vector2D = { x: -28 * s - flare * 0.5, y: -16 * s };
    const vTempleR: Vector2D = { x: 28 * s + flare * 0.5, y: -16 * s };

    const vCheekL: Vector2D = { x: -32 * s - flare, y: 0 };
    const vCheekR: Vector2D = { x: 32 * s + flare, y: 0 };

    const vJawAngleL: Vector2D = { x: -28 * s - flare * 0.8, y: 18 * s + breathShift * 0.5 };
    const vJawAngleR: Vector2D = { x: 28 * s + flare * 0.8, y: 18 * s + breathShift * 0.5 };

    const vChinCenter: Vector2D = { x: 0, y: 28 * s + breathShift };
    const vChinL: Vector2D = { x: -14 * s, y: 24 * s + breathShift };
    const vChinR: Vector2D = { x: 14 * s, y: 24 * s + breathShift };

    // --- Colors ---
    const cForehead = '#ef4444';
    const cRedMid = '#dc2626';
    const cRedDark = '#b91c1c';
    const cCoralOrange = '#f97316';
    const cCoralAmber = '#ea580c';
    const cDeepRust = '#991b1b';
    const cDarkUmber = '#7f1d1d';
    const cSpot = '#38bdf8';

    // Forehead / Crown
    this.drawPoly(ctx, [vCrown, vBrowL, vForeheadCenter], cRedDark);
    this.drawPoly(ctx, [vCrown, vForeheadCenter, vBrowR], cDeepRust);
    this.drawPoly(ctx, [vBrowL, vSnoutBridge, vForeheadCenter], cRedMid);
    this.drawPoly(ctx, [vBrowR, vForeheadCenter, vSnoutBridge], cCoralOrange);

    // Cyan spots on forehead
    this.drawPoly(ctx, [{ x: 0, y: -24 * s }, { x: -4 * s, y: -20 * s }, { x: 4 * s, y: -20 * s }], cSpot, 'rgba(255,255,255,0.4)');
    this.drawPoly(ctx, [{ x: -10 * s, y: -16 * s }, { x: -6 * s, y: -13 * s }, { x: -12 * s, y: -12 * s }], cSpot, 'rgba(255,255,255,0.4)');
    this.drawPoly(ctx, [{ x: 10 * s, y: -16 * s }, { x: 6 * s, y: -13 * s }, { x: 12 * s, y: -12 * s }], cSpot, 'rgba(255,255,255,0.4)');

    // Temples & Cheeks
    this.drawPoly(ctx, [vBrowL, vTempleL, vCheekL], cDarkUmber);
    this.drawPoly(ctx, [vBrowR, vTempleR, vCheekR], cDarkUmber);
    this.drawPoly(ctx, [vBrowL, vCheekL, { x: -18 * s, y: -4 * s }], cCoralAmber);
    this.drawPoly(ctx, [vBrowR, { x: 18 * s, y: -4 * s }, vCheekR], cCoralAmber);

    // Lower Cheek to Jaw Angle
    this.drawPoly(ctx, [vCheekL, vJawAngleL, { x: -20 * s, y: 10 * s }], cRedDark);
    this.drawPoly(ctx, [vCheekR, { x: 20 * s, y: 10 * s }, vJawAngleR], cRedDark);

    // Heavy Chin plates
    this.drawPoly(ctx, [vJawAngleL, vChinL, vChinCenter], cDeepRust);
    this.drawPoly(ctx, [vJawAngleR, vChinCenter, vChinR], cDeepRust);
    this.drawPoly(ctx, [vChinL, { x: 0, y: 32 * s + breathShift }, vChinCenter], cDarkUmber);
    this.drawPoly(ctx, [vChinR, vChinCenter, { x: 0, y: 32 * s + breathShift }], cDarkUmber);

    // Cyan spots on chin
    this.drawPoly(ctx, [{ x: -6 * s, y: 22 * s + breathShift }, { x: 0, y: 25 * s + breathShift }, { x: 6 * s, y: 22 * s + breathShift }], cSpot, 'rgba(255,255,255,0.4)');
  }

  /**
   * Cavernous Open Mouth looking straight down the dark gullet
   */
  private renderFrontOralCavity(ctx: CanvasRenderingContext2D, s: number, mouthOpen: number) {
    const rx = 19 * s;
    const ry = 15 * mouthOpen * s;
    const cy = 4 * s;

    // --- Outer Cavity Void Gradient (Burgundy to pitch black depth) ---
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
    const mouthGrad = ctx.createRadialGradient(0, cy, 2 * s, 0, cy, rx);
    mouthGrad.addColorStop(0, '#030102'); // Pitch black gullet center
    mouthGrad.addColorStop(0.5, '#1e0407'); // Deep dark throat
    mouthGrad.addColorStop(0.85, '#5c0a18'); // Pharyngeal walls
    mouthGrad.addColorStop(1, '#881337'); // Fleshy oral mucosa edge
    ctx.fillStyle = mouthGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Deep Esophagus Tunnel Ring
    ctx.beginPath();
    ctx.ellipse(0, cy + 1 * s, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#050102';
    ctx.fill();

    // Soft Palate / Upper Throat folds
    const palateArch: Vector2D[] = [
      { x: -14 * s, y: cy - ry * 0.6 },
      { x: 0, y: cy - ry * 0.8 },
      { x: 14 * s, y: cy - ry * 0.6 },
      { x: 0, y: cy - ry * 0.3 },
    ];
    this.drawPoly(ctx, palateArch, '#9f1239', 'rgba(255,255,255,0.1)');

    // Tongue on bottom floor of mouth
    const tongueArch: Vector2D[] = [
      { x: -12 * s, y: cy + ry * 0.55 },
      { x: 0, y: cy + ry * 0.25 },
      { x: 12 * s, y: cy + ry * 0.55 },
      { x: 0, y: cy + ry * 0.85 },
    ];
    this.drawPoly(ctx, tongueArch, '#be123c', 'rgba(255,255,255,0.15)');

    ctx.restore();
  }

  /**
   * Upper and Lower Jaws, Lips, and Full Row of Sharp Conical Predator Teeth
   */
  private renderFrontJawsAndTeeth(
    ctx: CanvasRenderingContext2D,
    s: number,
    mouthOpen: number,
    breathShift: number
  ) {
    const rx = 19 * s;
    const ry = 15 * mouthOpen * s;
    const cy = 4 * s;

    // --- Upper Maxilla Lip Arch ---
    const lipTop = cy - ry;
    const upperLipPts: Vector2D[] = [
      { x: -rx * 1.1, y: cy },
      { x: -rx * 0.8, y: lipTop - 3 * s },
      { x: 0, y: lipTop - 5 * s },
      { x: rx * 0.8, y: lipTop - 3 * s },
      { x: rx * 1.1, y: cy },
      { x: rx * 0.8, y: lipTop },
      { x: 0, y: lipTop - 1 * s },
      { x: -rx * 0.8, y: lipTop },
    ];
    this.drawPoly(ctx, upperLipPts, '#ea580c', 'rgba(255,255,255,0.25)');

    // Upper Teeth (Full row pointing downward into the oral cavity)
    const upperToothAngles = [-0.75, -0.55, -0.35, -0.18, 0, 0.18, 0.35, 0.55, 0.75];
    for (const factor of upperToothAngles) {
      const tx = factor * (rx * 0.9);
      const ty = lipTop + Math.abs(factor) * 2.5 * s;
      const isCanine = Math.abs(factor) === 0.35 || Math.abs(factor) === 0.55;
      const tLen = (isCanine ? 5.5 : 3.8) * s;
      const tHalfW = (isCanine ? 1.8 : 1.3) * s;

      const p1: Vector2D = { x: tx - tHalfW, y: ty };
      const p2: Vector2D = { x: tx + tHalfW, y: ty };
      const pTip: Vector2D = { x: tx, y: ty + tLen };

      this.drawPoly(ctx, [p1, pTip, p2], isCanine ? '#ffffff' : '#fef08a', 'rgba(255,255,255,0.4)');
    }

    // --- Lower Mandible Lip Arch (Underbite chin) ---
    const lipBot = cy + ry;
    const lowerLipPts: Vector2D[] = [
      { x: -rx * 1.1, y: cy },
      { x: -rx * 0.8, y: lipBot },
      { x: 0, y: lipBot + 1 * s },
      { x: rx * 0.8, y: lipBot },
      { x: rx * 1.1, y: cy },
      { x: rx * 0.8, y: lipBot + 4 * s + breathShift * 0.3 },
      { x: 0, y: lipBot + 6 * s + breathShift * 0.3 },
      { x: -rx * 0.8, y: lipBot + 4 * s + breathShift * 0.3 },
    ];
    this.drawPoly(ctx, lowerLipPts, '#c2410c', 'rgba(255,255,255,0.25)');

    // Lower Teeth (Full row pointing upward into the oral cavity)
    const lowerToothAngles = [-0.75, -0.55, -0.35, -0.18, 0, 0.18, 0.35, 0.55, 0.75];
    for (const factor of lowerToothAngles) {
      const tx = factor * (rx * 0.88);
      const ty = lipBot - Math.abs(factor) * 2.0 * s;
      const isCanine = Math.abs(factor) === 0.35 || Math.abs(factor) === 0.55;
      const tLen = (isCanine ? 5.8 : 3.9) * s;
      const tHalfW = (isCanine ? 1.8 : 1.3) * s;

      const p1: Vector2D = { x: tx - tHalfW, y: ty };
      const p2: Vector2D = { x: tx + tHalfW, y: ty };
      const pTip: Vector2D = { x: tx, y: ty - tLen };

      this.drawPoly(ctx, [p1, pTip, p2], isCanine ? '#ffffff' : '#fef08a', 'rgba(255,255,255,0.4)');
    }
  }

  /**
   * Opercular Gill Slits flaring open rhythmically on both left and right sides
   */
  private renderFrontOpercula(ctx: CanvasRenderingContext2D, s: number, flare: number) {
    for (const side of [-1, 1]) {
      const gTop: Vector2D = { x: side * (26 * s + flare * 0.4), y: -12 * s };
      const gMid: Vector2D = { x: side * (33 * s + flare), y: 0 };
      const gBot: Vector2D = { x: side * (26 * s + flare * 0.5), y: 14 * s };
      const gInMid: Vector2D = { x: side * (24 * s), y: 0 };

      // Dark red gill filament cavity inside
      this.drawPoly(ctx, [gTop, gMid, gInMid], '#450a0a', 'transparent');
      this.drawPoly(ctx, [gInMid, gMid, gBot], '#450a0a', 'transparent');

      // Glowing crimson gill arch inside slit
      const gillFilament: Vector2D[] = [
        { x: side * (25 * s + flare * 0.3), y: -8 * s },
        { x: side * (29 * s + flare * 0.6), y: 0 },
        { x: side * (25 * s + flare * 0.3), y: 8 * s },
      ];
      ctx.beginPath();
      ctx.moveTo(gillFilament[0].x, gillFilament[0].y);
      ctx.quadraticCurveTo(gillFilament[1].x, gillFilament[1].y, gillFilament[2].x, gillFilament[2].y);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Opercular outer flap
      this.drawPoly(ctx, [gTop, { x: side * (28 * s + flare * 0.7), y: -6 * s }, gMid], '#dc2626');
      this.drawPoly(ctx, [gMid, { x: side * (28 * s + flare * 0.7), y: 8 * s }, gBot], '#ea580c');
    }
  }

  /**
   * Forward / Lateral staring Predatory Eyes
   */
  private renderFrontEyes(ctx: CanvasRenderingContext2D, s: number) {
    for (const side of [-1, 1]) {
      const eyeX = side * 23 * s;
      const eyeY = -14 * s;
      const eyeRadius = 5.2 * s;

      // Socket Bevel
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeRadius + 1.2 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#7f1d1d';
      ctx.fill();

      // Golden Amber Iris
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      // Inner Gold Ring
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeRadius * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();

      // Pupil (Staring forward with slight inward focus)
      ctx.beginPath();
      ctx.arc(eyeX - side * 0.6 * s, eyeY, eyeRadius * 0.52, 0, Math.PI * 2);
      ctx.fillStyle = '#05070c';
      ctx.fill();

      // Specular Glint
      ctx.beginPath();
      ctx.arc(eyeX - side * 1.5 * s, eyeY - 1.5 * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeX + side * 1.0 * s, eyeY + 1.0 * s, 0.8 * s, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    }
  }
}

import { Vector2D, Parasite } from '../types';
import { lerp, clamp } from '../utils/math';

export interface CleaningTargetSpot {
  id: string;
  name: string;
  pos: Vector2D;
}

/**
 * Yellowtail Goatfish (Mulloidichthys martinicus)
 * "Smooth Low-Poly" Style Guide Implementation:
 * - Slender, streamlined fusiform body with soft anatomical contours (~25–35 cm)
 * - Pearlescent silver/pale body with vibrant golden-yellow lateral stripe
 * - Two prominent chin barbels (hyoid barbels) that sway dynamically with swimming & substrate probing
 * - Small subterminal mouth beneath the curved snout
 * - Two separate dorsal fins (spiny anterior & soft yellow posterior)
 * - Deeply forked, vivid golden-yellow caudal tail
 * - Smooth geometric body planes with pearlescent and yellow-gold gradients
 * - Large, expressive golden-amber coral eye
 */
export class YellowtailGoatfish {
  public pos: Vector2D = { x: 0, y: 0 };
  public targetPos: Vector2D = { x: 0, y: 0 };
  public heading: number = Math.PI; // Facing left toward the cleaning station in profile

  // Scale 3.29 (0.7x relative to Queen Triggerfish baseline 4.7)
  public scale: number = 3.29;

  public state: 'entering' | 'stationary' | 'exiting' | 'exited' = 'entering';
  public entrySpeed: number = 2.8;
  public exitSpeed: number = 3.4;

  public animTime: number = 0;
  public breathPhase: number = 0;
  public finPhase: number = 0;
  public barbelPhase: number = 0;
  public mouthAperture: number = 0.8;

  public isVisible: boolean = true;

  // Procedural Turn & Perspective Facing State
  public facingPlayer: boolean = false;
  public turnProgress: number = 0; // 0.0 = Profile (side view), 1.0 = Facing Player
  public turnSpeed: number = 0.0075;

  // Parasites on chin barbels, mouth, and silver/yellow body
  public parasites: Parasite[] = [];

  constructor(canvasWidth: number, canvasHeight: number) {
    // Start offscreen to the right
    this.pos = {
      x: canvasWidth + 450,
      y: canvasHeight * 0.48,
    };
    this.targetPos = {
      x: this.getProfileTargetX(canvasWidth),
      y: canvasHeight * 0.48,
    };

    this.initParasites();
  }

  /**
   * Initialize parasites over the chin barbels, subterminal mouth, and slender body
   */
  private initParasites() {
    this.parasites = [];
    let id = 200;

    // 1. Parasites on chin barbels & subterminal mouth (teeth/barbel category)
    const barbelAndMouthCoords = [
      { x: -32.0, y: 6.0, part: 'lowerTeeth' as const },
      { x: -30.0, y: 8.5, part: 'lowerTeeth' as const },
      { x: -28.0, y: 12.0, part: 'lowerTeeth' as const },
      { x: -26.0, y: 15.5, part: 'lowerTeeth' as const },
      { x: -24.0, y: 19.0, part: 'lowerTeeth' as const },
      { x: -22.5, y: 22.0, part: 'lowerTeeth' as const },
      { x: -34.0, y: 4.5, part: 'upperTeeth' as const },
      { x: -36.0, y: 2.0, part: 'upperTeeth' as const },
      { x: -33.5, y: 1.0, part: 'upperTeeth' as const },
      { x: -31.0, y: 2.5, part: 'upperTeeth' as const },
      { x: -29.0, y: 10.0, part: 'lowerTeeth' as const },
      { x: -27.0, y: 14.0, part: 'lowerTeeth' as const },
      { x: -25.0, y: 18.0, part: 'lowerTeeth' as const },
      { x: -35.0, y: 3.2, part: 'upperTeeth' as const },
    ];

    for (const c of barbelAndMouthCoords) {
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

    // 2. Body Parasites along the golden yellow lateral stripe & silver flanks
    const lateralStripeCoords = [
      { x: -16.0, y: -2.0, part: 'body' as const },
      { x: -8.0, y: -1.5, part: 'body' as const },
      { x: 0.0, y: -1.0, part: 'body' as const },
      { x: 8.0, y: -1.0, part: 'body' as const },
      { x: 16.0, y: -1.0, part: 'body' as const },
      { x: 24.0, y: -1.5, part: 'body' as const },
      { x: 32.0, y: -1.5, part: 'body' as const },
      { x: 40.0, y: -2.0, part: 'body' as const },
      { x: 48.0, y: -2.5, part: 'body' as const },
    ];

    for (const c of lateralStripeCoords) {
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

    // Head, Dorsal Arch, Operculum, and Belly
    const bodyCoords = [
      // Forehead & snout slope
      { x: -28.0, y: -8.0, part: 'body' as const },
      { x: -22.0, y: -13.0, part: 'body' as const },
      { x: -14.0, y: -16.0, part: 'body' as const },
      { x: -6.0, y: -18.0, part: 'body' as const },
      // Opercular area
      { x: -16.0, y: 4.0, part: 'operculum' as const },
      { x: -10.0, y: 6.0, part: 'operculum' as const },
      { x: -6.0, y: 2.0, part: 'operculum' as const },
      // Dorsal ridge
      { x: 2.0, y: -17.5, part: 'body' as const },
      { x: 12.0, y: -16.0, part: 'body' as const },
      { x: 22.0, y: -14.0, part: 'body' as const },
      { x: 32.0, y: -11.0, part: 'body' as const },
      { x: 42.0, y: -8.0, part: 'body' as const },
      // Silver Belly
      { x: -4.0, y: 10.0, part: 'belly' as const },
      { x: 4.0, y: 12.5, part: 'belly' as const },
      { x: 14.0, y: 12.0, part: 'belly' as const },
      { x: 24.0, y: 10.0, part: 'belly' as const },
      { x: 34.0, y: 7.5, part: 'belly' as const },
      { x: 44.0, y: 5.0, part: 'body' as const },
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
      // Barbel flex with swimming
      const barbelSway = Math.sin(this.barbelPhase + p.localY * 0.1) * 2.0;
      lx += barbelSway;
      ly = p.localY * s;
    } else if (p.attachPart === 'belly') {
      ly = (p.localY * s) + (Math.sin(this.breathPhase) * 1.2);
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
   * Calculate target X so the entire fish (from snout & barbels to forked yellow caudal tail tip) is fully visible,
   * anchored cleanly on the right side of the screen.
   */
  private getProfileTargetX(canvasWidth: number): number {
    const s = this.scale;
    // Whole body length from snout (-35 * s) to forked tail tip (+96 * s) is ~131 * s.
    return canvasWidth - (97 * s + 24);
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
    const minY = -28 * s;
    const maxY = 28 * s;
    return dx >= minX && dx <= maxX && dy >= minY && dy <= maxY;
  }

  public update(width: number, height: number, dt: number = 1) {
    const safeDt = clamp(dt, 0.2, 2.0);
    this.animTime += 0.03 * safeDt;
    this.breathPhase += 0.035 * safeDt;
    this.finPhase += 0.06 * safeDt;
    this.barbelPhase += 0.045 * safeDt;

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
      // Reversing backwards to the right off screen
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

    // Mouth aperture
    this.mouthAperture = 0.8 + Math.sin(this.breathPhase) * 0.04;
  }

  public getCleaningStationSpots(): CleaningTargetSpot[] {
    const s = this.scale;

    const profBarbels: Vector2D = {
      x: this.pos.x - 26 * s,
      y: this.pos.y + 14 * s,
    };
    const profSnout: Vector2D = {
      x: this.pos.x - 34 * s,
      y: this.pos.y + 2 * s,
    };
    const profLateralStripe: Vector2D = {
      x: this.pos.x + 6 * s,
      y: this.pos.y - 2 * s,
    };

    return [
      {
        id: 'chin-barbels',
        name: 'Chin Sensory Barbels',
        pos: profBarbels,
      },
      {
        id: 'subterminal-mouth',
        name: 'Subterminal Mouth & Snout',
        pos: profSnout,
      },
      {
        id: 'yellow-stripe',
        name: 'Golden-Yellow Lateral Stripe',
        pos: profLateralStripe,
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
    const barbelFlutter = Math.sin(this.barbelPhase);

    this.renderProfile(ctx, s, breath, finFlutter, barbelFlutter, 1.0);

    ctx.restore();
  }

  // =========================================================================
  // PROFILE VIEW RENDERING (Yellowtail Goatfish - Mulloidichthys martinicus)
  // "Smooth Low-Poly" Style:
  // Slender streamlined silver body, bright yellow lateral stripe, two chin barbels,
  // subterminal mouth, two dorsal fins, and deeply forked yellow tail.
  // =========================================================================

  private renderProfile(
    ctx: CanvasRenderingContext2D,
    s: number,
    breath: number,
    finFlutter: number,
    barbelFlutter: number,
    alpha: number = 1.0
  ) {
    ctx.save();
    if (alpha < 1.0) {
      ctx.globalAlpha = ctx.globalAlpha * alpha;
    }

    // 1. Two Separate Dorsal Fins (Spiny Anterior & Yellow Soft Posterior)
    this.renderSmoothDorsalFins(ctx, s, finFlutter);

    // 2. Yellow Anal Fin & Pelvic Fin
    this.renderSmoothAnalFin(ctx, s, finFlutter);
    this.renderSmoothPelvicFin(ctx, s, finFlutter);

    // 3. Deeply Forked Bright Yellow Caudal Tail
    this.renderSmoothForkedTail(ctx, s, finFlutter);

    // 4. Slender Silver & Pale Body with Golden Lateral Stripe
    this.renderSmoothMainBody(ctx, s, breath);

    // 5. Two Prominent Chin Barbels (Hyoid sensory barbels swaying organically)
    this.renderSmoothChinBarbels(ctx, s, barbelFlutter);

    // 6. Subterminal Mouth & Snout
    this.renderSmoothSubterminalMouth(ctx, s);

    // 7. Large Golden Coral Eye
    this.renderSmoothEye(ctx, s);

    // 8. Translucent Pale Pectoral Fin
    this.renderSmoothPectoralFin(ctx, s, finFlutter);

    // 9. Parasites on Barbels & Body
    this.renderParasites(ctx);

    ctx.restore();
  }

  private renderParasites(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = '#451a03';
    for (const p of this.parasites) {
      if (p.removed) continue;
      const local = this.getParasiteLocalPos(p);
      ctx.fillRect(Math.round(local.x), Math.round(local.y), 2, 2);
    }
    ctx.restore();
  }

  /**
   * Slender, streamlined fusiform body with silvery-white pearlescent wash
   * and prominent bright golden-yellow lateral stripe from eye to caudal fin.
   */
  private renderSmoothMainBody(ctx: CanvasRenderingContext2D, s: number, breath: number) {
    const bShift = breath * 1.0;

    // 1. Streamlined Silhouette with Smooth Curved Perimeter
    ctx.save();
    ctx.beginPath();
    // Tip of snout (smooth rounded upper slope)
    ctx.moveTo(-36 * s, -1 * s);
    // Smooth curved forehead slope to nape
    ctx.bezierCurveTo(-30 * s, -10 * s, -18 * s, -17 * s, -6 * s, -18.5 * s);
    // Dorsal line (slender, gentle tapering arch)
    ctx.bezierCurveTo(12 * s, -18.5 * s, 32 * s, -13 * s, 54 * s, -7 * s);
    // Slender caudal peduncle top
    ctx.lineTo(60 * s, -4.5 * s);
    // Caudal peduncle rear
    ctx.lineTo(60 * s, 4.5 * s);
    // Caudal peduncle bottom
    ctx.lineTo(54 * s, 6.5 * s);
    // Slender ventral belly line
    ctx.bezierCurveTo(32 * s, 11 * s, 10 * s, 13 * s + bShift, -10 * s, 11 * s + bShift);
    // Throat to lower jaw / chin
    ctx.quadraticCurveTo(-26 * s, 8 * s, -33 * s, 4 * s);
    // Subterminal mouth notch
    ctx.lineTo(-35 * s, 2 * s);
    ctx.closePath();

    // Silvery-white to soft pale-blue iridescent gradient base
    const bodyGrad = ctx.createLinearGradient(-30 * s, -18 * s, 40 * s, 12 * s);
    bodyGrad.addColorStop(0, '#f8fafc');   // Pure silver white
    bodyGrad.addColorStop(0.3, '#e2e8f0'); // Pale iridescent silver
    bodyGrad.addColorStop(0.65, '#cbd5e1'); // Metallic silver sheen
    bodyGrad.addColorStop(1, '#94a3b8');   // Pale pearl tail base
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.restore();

    // 2. Bright Golden-Yellow Lateral Stripe (Signature Goatfish Marker)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-20 * s, -2.5 * s);
    ctx.quadraticCurveTo(8 * s, -2 * s, 36 * s, -2 * s);
    ctx.lineTo(60 * s, -1 * s);
    ctx.lineTo(60 * s, 2.5 * s);
    ctx.quadraticCurveTo(36 * s, 2.5 * s, 8 * s, 2.5 * s);
    ctx.quadraticCurveTo(-10 * s, 2 * s, -20 * s, 1.5 * s);
    ctx.closePath();

    const stripeGrad = ctx.createLinearGradient(-20 * s, 0, 60 * s, 0);
    stripeGrad.addColorStop(0, '#facc15'); // Vivid golden yellow
    stripeGrad.addColorStop(0.5, '#eab308'); // Rich warm gold
    stripeGrad.addColorStop(1, '#fbbf24'); // Bright amber gold transitioning to yellow tail
    ctx.fillStyle = stripeGrad;
    ctx.fill();
    ctx.restore();

    // 3. Smooth Upper Dorsal Golden/Olive Shimmer Plane
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-28 * s, -8 * s);
    ctx.quadraticCurveTo(-10 * s, -17 * s, 12 * s, -17 * s);
    ctx.quadraticCurveTo(34 * s, -12 * s, 54 * s, -6 * s);
    ctx.lineTo(44 * s, -2 * s);
    ctx.quadraticCurveTo(12 * s, -4 * s, -16 * s, -3 * s);
    ctx.closePath();

    const dorsalGrad = ctx.createLinearGradient(0, -18 * s, 0, -2 * s);
    dorsalGrad.addColorStop(0, 'rgba(234, 179, 8, 0.35)'); // Soft olive-gold sheen
    dorsalGrad.addColorStop(0.6, 'rgba(250, 204, 21, 0.2)');
    dorsalGrad.addColorStop(1, 'rgba(241, 245, 249, 0.1)');
    ctx.fillStyle = dorsalGrad;
    ctx.fill();
    ctx.restore();

    // 4. Smooth Silver Belly Plane
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-12 * s, 10 * s + bShift);
    ctx.bezierCurveTo(8 * s, 13 * s + bShift, 28 * s, 11 * s, 52 * s, 6 * s);
    ctx.lineTo(40 * s, 3 * s);
    ctx.quadraticCurveTo(10 * s, 3 * s, -16 * s, 2 * s);
    ctx.closePath();

    const bellyGrad = ctx.createLinearGradient(0, 2 * s, 0, 13 * s);
    bellyGrad.addColorStop(0, 'rgba(248, 250, 252, 0.4)');
    bellyGrad.addColorStop(1, 'rgba(255, 255, 255, 0.85)'); // Pure lustrous white belly
    ctx.fillStyle = bellyGrad;
    ctx.fill();
    ctx.restore();

    // 5. Rounded Opercular Flap (Smooth curved silver gill margin)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-16 * s, -10 * s);
    ctx.quadraticCurveTo(-8 * s, 0, -10 * s, 8 * s);
    ctx.quadraticCurveTo(-18 * s, 6 * s, -20 * s, -4 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // Subtle, soft polygonal facet lines to maintain stylized low-poly character
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-18 * s, -14 * s); ctx.lineTo(-4 * s, -2 * s);
    ctx.moveTo(8 * s, -18 * s); ctx.lineTo(16 * s, -2 * s); ctx.lineTo(26 * s, -14 * s);
    ctx.moveTo(34 * s, -12 * s); ctx.lineTo(42 * s, -2 * s);
    ctx.moveTo(-4 * s, 2 * s); ctx.lineTo(8 * s, 12 * s + bShift);
    ctx.moveTo(22 * s, 2 * s); ctx.lineTo(34 * s, 10 * s);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Two Prominent Chin Barbels (Hyoid sensory barbels)
   * Curved, flexible sensory appendages hanging beneath the chin that sway organically.
   */
  private renderSmoothChinBarbels(ctx: CanvasRenderingContext2D, s: number, barbelFlutter: number) {
    const sway1 = barbelFlutter * 3.5;
    const sway2 = Math.sin(this.barbelPhase + 0.6) * 3.2;

    ctx.save();
    // Barbel 1 (Near / Foreground barbel)
    ctx.beginPath();
    ctx.moveTo(-31 * s, 5 * s);
    ctx.quadraticCurveTo(-28 * s + sway1 * 0.5, 14 * s, -23 * s + sway1, 24 * s);
    ctx.quadraticCurveTo(-27 * s + sway1 * 0.6, 14 * s, -32.5 * s, 5.5 * s);
    ctx.closePath();

    const barbelGrad1 = ctx.createLinearGradient(-31 * s, 5 * s, -23 * s, 24 * s);
    barbelGrad1.addColorStop(0, '#fef08a'); // Pale yellow base
    barbelGrad1.addColorStop(0.6, '#facc15'); // Warm golden yellow
    barbelGrad1.addColorStop(1, '#ffffff'); // Whitish sensitive tip
    ctx.fillStyle = barbelGrad1;
    ctx.fill();
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Barbel 2 (Far / Background barbel, slightly offset)
    ctx.beginPath();
    ctx.moveTo(-29 * s, 5 * s);
    ctx.quadraticCurveTo(-25 * s + sway2 * 0.5, 13 * s, -20 * s + sway2, 22 * s);
    ctx.quadraticCurveTo(-24 * s + sway2 * 0.6, 13 * s, -30.5 * s, 5.5 * s);
    ctx.closePath();

    const barbelGrad2 = ctx.createLinearGradient(-29 * s, 5 * s, -20 * s, 22 * s);
    barbelGrad2.addColorStop(0, '#fef9c3');
    barbelGrad2.addColorStop(0.6, '#eab308');
    barbelGrad2.addColorStop(1, '#f8fafc');
    ctx.fillStyle = barbelGrad2;
    ctx.fill();
    ctx.restore();
  }

  /**
   * Subterminal Mouth positioned under the curved snout
   */
  private renderSmoothSubterminalMouth(ctx: CanvasRenderingContext2D, s: number) {
    const mouthOpen = this.mouthAperture;

    ctx.save();
    // Smooth fleshy lips
    ctx.beginPath();
    ctx.moveTo(-36 * s, -1 * s);
    ctx.quadraticCurveTo(-38 * s, 1 * s, -35 * s, 3.5 * mouthOpen * s);
    ctx.quadraticCurveTo(-32 * s, 4.5 * mouthOpen * s, -30 * s, 4 * s);
    ctx.quadraticCurveTo(-33 * s, 2 * s, -36 * s, -1 * s);
    ctx.closePath();

    const lipGrad = ctx.createLinearGradient(-36 * s, 0, -30 * s, 4 * s);
    lipGrad.addColorStop(0, '#fef08a');
    lipGrad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = lipGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.7)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Large, expressive golden-amber coral reef eye
   */
  private renderSmoothEye(ctx: CanvasRenderingContext2D, s: number) {
    const eyeX = -20 * s;
    const eyeY = -9 * s;
    const eyeRadius = 4.6 * s;

    ctx.save();
    // Golden-yellow outer orbital ring
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius + 1.0 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();

    // Amber-Gold Iris
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(eyeX, eyeY, 0.8 * s, eyeX, eyeY, eyeRadius);
    irisGrad.addColorStop(0, '#fef08a');
    irisGrad.addColorStop(0.6, '#eab308');
    irisGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Deep Dark Pupil
    ctx.beginPath();
    ctx.arc(eyeX - 0.2 * s, eyeY, eyeRadius * 0.54, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();

    // Specular Highlights
    ctx.beginPath();
    ctx.arc(eyeX - 1.3 * s, eyeY - 1.3 * s, 1.4 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeX + 1.1 * s, eyeY + 1.1 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Two Separate Dorsal Fins (Anterior spiny fin & Posterior soft yellow fin)
   */
  private renderSmoothDorsalFins(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.5;

    ctx.save();
    // 1. Anterior Spiny Dorsal Fin (Translucent silver-gold triangular fin)
    ctx.beginPath();
    ctx.moveTo(-6 * s, -18.5 * s);
    ctx.quadraticCurveTo(2 * s, -30 * s + wave * 0.5, 6 * s, -31 * s + wave * 0.8);
    ctx.quadraticCurveTo(8 * s, -24 * s + wave * 0.4, 12 * s, -17.5 * s);
    ctx.closePath();

    const d1Grad = ctx.createLinearGradient(0, -18 * s, 6 * s, -31 * s);
    d1Grad.addColorStop(0, 'rgba(226, 232, 240, 0.8)');
    d1Grad.addColorStop(0.6, 'rgba(250, 204, 21, 0.6)');
    d1Grad.addColorStop(1, 'rgba(253, 224, 71, 0.85)');
    ctx.fillStyle = d1Grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // 2. Posterior Soft Dorsal Fin (Bright golden yellow soft fin)
    ctx.beginPath();
    ctx.moveTo(22 * s, -15 * s);
    ctx.quadraticCurveTo(28 * s, -25 * s + wave, 36 * s, -24 * s + wave * 0.8);
    ctx.quadraticCurveTo(38 * s, -18 * s + wave * 0.4, 42 * s, -11 * s);
    ctx.closePath();

    const d2Grad = ctx.createLinearGradient(25 * s, -14 * s, 32 * s, -25 * s);
    d2Grad.addColorStop(0, '#eab308');
    d2Grad.addColorStop(0.7, '#facc15');
    d2Grad.addColorStop(1, '#fef08a');
    ctx.fillStyle = d2Grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Smooth Yellow Anal Fin
   */
  private renderSmoothAnalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.4;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(22 * s, 10.5 * s);
    ctx.quadraticCurveTo(28 * s, 19 * s + wave, 34 * s, 18 * s + wave * 0.8);
    ctx.quadraticCurveTo(36 * s, 14 * s + wave * 0.4, 40 * s, 8 * s);
    ctx.closePath();

    const aGrad = ctx.createLinearGradient(25 * s, 10 * s, 30 * s, 19 * s);
    aGrad.addColorStop(0, '#eab308');
    aGrad.addColorStop(0.7, '#facc15');
    aGrad.addColorStop(1, '#fef08a');
    ctx.fillStyle = aGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Smooth Pelvic Fin
   */
  private renderSmoothPelvicFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-6 * s, 10.5 * s);
    ctx.quadraticCurveTo(-2 * s, 19 * s + wave, 4 * s, 18 * s + wave * 0.7);
    ctx.quadraticCurveTo(2 * s, 13 * s + wave * 0.3, 2 * s, 11 * s);
    ctx.closePath();

    const pGrad = ctx.createLinearGradient(-4 * s, 10 * s, 0, 19 * s);
    pGrad.addColorStop(0, '#f1f5f9');
    pGrad.addColorStop(0.6, '#facc15');
    pGrad.addColorStop(1, '#fef08a');
    ctx.fillStyle = pGrad;
    ctx.fill();
    ctx.restore();
  }

  /**
   * Deeply Forked Bright Yellow Caudal Tail
   * Flowing upper & lower lobes with deep V-shaped fork and vivid golden-yellow coloration.
   */
  private renderSmoothForkedTail(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 2.8;

    ctx.save();
    ctx.beginPath();
    // Caudal peduncle root
    ctx.moveTo(60 * s, -4.5 * s);
    // Smooth flowing upper forked lobe
    ctx.bezierCurveTo(70 * s, -12 * s + wave * 0.5, 82 * s, -22 * s + wave * 0.8, 96 * s, -24 * s + wave);
    // Deep V-shaped inner fork curve
    ctx.bezierCurveTo(86 * s, -10 * s + wave * 0.6, 74 * s, 0 + wave * 0.4, 70 * s, 0 + wave * 0.3);
    // Deep V-shaped lower return
    ctx.bezierCurveTo(74 * s, 0 + wave * 0.4, 86 * s, 10 * s + wave * 0.6, 96 * s, 24 * s + wave);
    // Smooth flowing lower forked lobe
    ctx.bezierCurveTo(82 * s, 22 * s + wave * 0.8, 70 * s, 12 * s + wave * 0.5, 60 * s, 4.5 * s);
    ctx.closePath();

    // Vibrant Golden-Yellow Caudal Tail Gradient
    const tailGrad = ctx.createLinearGradient(60 * s, 0, 96 * s, 0);
    tailGrad.addColorStop(0, '#eab308'); // Rich warm gold at peduncle
    tailGrad.addColorStop(0.4, '#facc15'); // Vivid golden yellow
    tailGrad.addColorStop(0.85, '#fde047'); // Bright sunlight yellow
    tailGrad.addColorStop(1, '#fef08a'); // Pale yellow tips
    ctx.fillStyle = tailGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Translucent Pale Pectoral Fin
   */
  private renderSmoothPectoralFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const scullAngle = finFlutter * 0.35;

    ctx.save();
    const rootX = -8 * s;
    const rootY = 3 * s;
    ctx.translate(rootX, rootY);
    ctx.rotate(scullAngle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(8 * s, -8 * s, 18 * s, -6 * s, 22 * s, 0);
    ctx.bezierCurveTo(24 * s, 6 * s, 16 * s, 12 * s, 6 * s, 10 * s);
    ctx.closePath();

    const pecGrad = ctx.createLinearGradient(0, 0, 22 * s, 4 * s);
    pecGrad.addColorStop(0, 'rgba(241, 245, 249, 0.8)');
    pecGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.75)');
    pecGrad.addColorStop(1, 'rgba(250, 204, 21, 0.65)');
    ctx.fillStyle = pecGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  // =========================================================================
  // FRONT-FACING VIEW RENDERING (Yellowtail Goatfish)
  // Slender silvery head vault, two chin barbels hanging downward symmetrically,
  // subterminal mouth beneath the snout, and high-set golden eyes.
  // =========================================================================

  private renderFrontFacing(
    ctx: CanvasRenderingContext2D,
    s: number,
    breath: number,
    finFlutter: number,
    barbelFlutter: number,
    alpha: number = 1.0
  ) {
    ctx.save();
    if (alpha < 1.0) {
      ctx.globalAlpha = ctx.globalAlpha * alpha;
    }

    const mouthOpen = this.mouthAperture;
    const breathShift = breath * 1.5;
    const flare = breath * 2.5;

    // 1. Symmetrical Smooth Pectoral Fins
    this.renderFrontSmoothPectoralFins(ctx, s, finFlutter);

    // 2. Anterior Dorsal Fin Tip
    this.renderFrontSmoothDorsalFin(ctx, s, finFlutter);

    // 3. Slender Silvery Head Vault
    this.renderFrontSmoothHeadVault(ctx, s, breathShift, flare);

    // 4. Subterminal Ventral Mouth
    this.renderFrontSmoothMouth(ctx, s, mouthOpen);

    // 5. Two Symmetrical Chin Barbels Hanging Downward
    this.renderFrontSmoothBarbels(ctx, s, barbelFlutter);

    // 6. Radiant Golden Lateral Eyes
    this.renderFrontSmoothEyes(ctx, s);

    ctx.restore();
  }

  private renderFrontSmoothPectoralFins(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const scullLeft = finFlutter * 0.30;
    const scullRight = -finFlutter * 0.30;

    for (const side of [-1, 1]) {
      ctx.save();
      const rootX = side * 16 * s;
      const rootY = 4 * s;
      ctx.translate(rootX, rootY);
      ctx.rotate(side === -1 ? scullLeft : scullRight);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(side * 10 * s, -8 * s, side * 22 * s, -4 * s, side * 24 * s, 3 * s);
      ctx.bezierCurveTo(side * 20 * s, 10 * s, side * 8 * s, 12 * s, 0, 0);
      ctx.closePath();

      const fGrad = ctx.createLinearGradient(0, 0, side * 24 * s, 3 * s);
      fGrad.addColorStop(0, 'rgba(241, 245, 249, 0.8)');
      fGrad.addColorStop(0.6, 'rgba(254, 240, 138, 0.7)');
      fGrad.addColorStop(1, 'rgba(250, 204, 21, 0.6)');
      ctx.fillStyle = fGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderFrontSmoothDorsalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, -18 * s);
    ctx.bezierCurveTo(-8 * s, -26 * s + wave * 0.5, -4 * s, -32 * s + wave, 0, -33 * s + wave);
    ctx.bezierCurveTo(4 * s, -32 * s + wave, 8 * s, -26 * s + wave * 0.5, 0, -18 * s);
    ctx.closePath();

    const dGrad = ctx.createLinearGradient(0, -18 * s, 0, -33 * s);
    dGrad.addColorStop(0, '#e2e8f0');
    dGrad.addColorStop(0.6, '#facc15');
    dGrad.addColorStop(1, '#fef08a');
    ctx.fillStyle = dGrad;
    ctx.fill();
    ctx.restore();
  }

  private renderFrontSmoothHeadVault(ctx: CanvasRenderingContext2D, s: number, breathShift: number, flare: number) {
    ctx.save();
    ctx.beginPath();
    // Slender crown
    ctx.moveTo(0, -18 * s);
    // Smooth rounded brow & side slope
    ctx.bezierCurveTo(-12 * s, -16 * s, -18 * s - flare * 0.5, -8 * s, -20 * s - flare, 0);
    // Cheek to subterminal chin
    ctx.bezierCurveTo(-18 * s - flare, 8 * s, -10 * s, 16 * s + breathShift, 0, 18 * s + breathShift);
    // Symmetrical right side
    ctx.bezierCurveTo(10 * s, 16 * s + breathShift, 18 * s + flare, 8 * s, 20 * s + flare, 0);
    ctx.bezierCurveTo(18 * s + flare * 0.5, -8 * s, 12 * s, -16 * s, 0, -18 * s);
    ctx.closePath();

    const vaultGrad = ctx.createRadialGradient(0, -2 * s, 2 * s, 0, 0, 24 * s);
    vaultGrad.addColorStop(0, '#ffffff');
    vaultGrad.addColorStop(0.4, '#f1f5f9');
    vaultGrad.addColorStop(0.75, '#cbd5e1');
    vaultGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = vaultGrad;
    ctx.fill();

    // Golden lateral stripes glowing on the side margins
    ctx.beginPath();
    ctx.ellipse(-14 * s, 0, 4 * s, 2 * s, -0.2, 0, Math.PI * 2);
    ctx.ellipse(14 * s, 0, 4 * s, 2 * s, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.5)';
    ctx.fill();

    ctx.restore();
  }

  private renderFrontSmoothMouth(ctx: CanvasRenderingContext2D, s: number, mouthOpen: number) {
    const rx = 8 * s;
    const ry = 5 * mouthOpen * s;
    const cy = 10 * s;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
    const mouthGrad = ctx.createRadialGradient(0, cy, 1 * s, 0, cy, rx);
    mouthGrad.addColorStop(0, '#0f172a');
    mouthGrad.addColorStop(0.7, '#334155');
    mouthGrad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = mouthGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.6)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  private renderFrontSmoothBarbels(ctx: CanvasRenderingContext2D, s: number, barbelFlutter: number) {
    const swayLeft = Math.sin(this.barbelPhase) * 2.5;
    const swayRight = Math.sin(this.barbelPhase + 0.4) * 2.5;

    for (const side of [-1, 1]) {
      const sway = side === -1 ? swayLeft : swayRight;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(side * 3 * s, 14 * s);
      ctx.quadraticCurveTo(side * (5 * s + sway * 0.5), 22 * s, side * (7 * s + sway), 30 * s);
      ctx.quadraticCurveTo(side * (4 * s + sway * 0.6), 22 * s, side * 1.5 * s, 14 * s);
      ctx.closePath();

      const bGrad = ctx.createLinearGradient(side * 3 * s, 14 * s, side * 7 * s, 30 * s);
      bGrad.addColorStop(0, '#fef08a');
      bGrad.addColorStop(0.7, '#facc15');
      bGrad.addColorStop(1, '#ffffff');
      ctx.fillStyle = bGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderFrontSmoothEyes(ctx: CanvasRenderingContext2D, s: number) {
    for (const side of [-1, 1]) {
      const eyeX = side * 18 * s;
      const eyeY = -8 * s;
      const eyeRadius = 3.6 * s;

      ctx.save();
      // Orbital Ring
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeRadius + 0.8 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();

      // Iris
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#eab308';
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

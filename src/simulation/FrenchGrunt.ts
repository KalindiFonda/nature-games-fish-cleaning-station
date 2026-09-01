import { Vector2D, Parasite } from '../types';
import { lerp, clamp } from '../utils/math';

export interface CleaningTargetSpot {
  id: string;
  name: string;
  pos: Vector2D;
}

/**
 * French Grunt (Haemulon flavolineatum)
 *
 * Smooth Low-Poly & Anatomical Design:
 * - Size: ~20–30 cm (Scale ~4.5, appropriately smaller and deep-bodied)
 * - Deep-bodied, laterally compressed oval profile with soft convex dorsal arch
 * - Pearlescent silver/cream body base with bright metallic highlights
 * - Vibrant golden-yellow head, snout, and forehead
 * - Several prominent, crisp golden-yellow horizontal and diagonal stripes traversing the flanks
 * - Radiant electric blue/slate-gray facial accent stripes and ocular lines
 * - Large, expressive dark-pupil eye with brilliant gold-yellow iris
 * - Relatively small, terminal mouth with soft pale lips, red interior lining, and tiny incisor teeth
 * - Soft-flowing spiny/soft continuous dorsal fin with yellow margins
 * - Translucent yellow pectoral, pelvic, anal, and forked caudal fins
 * - Procedural 3D perspective turn between Profile and Facing Player
 * - Parasite cleaning target network across mouth/lips, yellow head, blue facial stripes, and striped body flanks
 */
export class FrenchGrunt {
  public pos: Vector2D = { x: 0, y: 0 };
  public targetPos: Vector2D = { x: 0, y: 0 };
  public heading: number = Math.PI; // Facing left toward cleaning station in profile

  // Scale 2.82 (0.6x relative to Queen Triggerfish baseline 4.7)
  public scale: number = 2.82;

  public state: 'entering' | 'stationary' | 'exiting' | 'exited' = 'entering';
  public entrySpeed: number = 2.7;
  public exitSpeed: number = 3.3;

  public animTime: number = 0;
  public breathPhase: number = 0;
  public finPhase: number = 0;
  public mouthAperture: number = 0.8; // Small mouth rhythmic aperture

  public isVisible: boolean = true;

  // Procedural Turn & Perspective Facing State
  public facingPlayer: boolean = false;
  public turnProgress: number = 0; // 0.0 = Profile (side view), 1.0 = Facing Player
  public turnSpeed: number = 0.0075;

  // Parasites on mouth, head, and striped body
  public parasites: Parasite[] = [];

  constructor(canvasWidth: number, canvasHeight: number) {
    // Start offscreen to the right
    this.pos = {
      x: canvasWidth + 400,
      y: canvasHeight * 0.47,
    };
    this.targetPos = {
      x: this.getProfileTargetX(canvasWidth),
      y: canvasHeight * 0.47,
    };

    this.initParasites();
  }

  /**
   * Initialize parasites over the small mouth, bright yellow head, and striped flanks
   */
  private initParasites() {
    this.parasites = [];
    let id = 500;

    // 1. Parasites on relatively small mouth and lips
    const mouthCoords = [
      { x: -34.0, y: 1.0, type: 'teeth' as const, part: 'upperTeeth' as const },
      { x: -32.5, y: 0.0, type: 'teeth' as const, part: 'upperTeeth' as const },
      { x: -35.2, y: 2.0, type: 'teeth' as const, part: 'upperTeeth' as const },
      { x: -31.0, y: 0.5, type: 'teeth' as const, part: 'upperTeeth' as const },
      { x: -33.5, y: 3.5, type: 'teeth' as const, part: 'lowerTeeth' as const },
      { x: -35.0, y: 4.2, type: 'teeth' as const, part: 'lowerTeeth' as const },
      { x: -32.0, y: 3.0, type: 'teeth' as const, part: 'lowerTeeth' as const },
    ];

    for (const c of mouthCoords) {
      this.parasites.push({
        id: id++,
        type: c.type,
        localX: c.x,
        localY: c.y,
        attachPart: c.part,
        hoverTimer: 0,
        removed: false,
      });
    }

    // 2. Parasites on bright yellow head, blue facial markings, and operculum
    const headCoords = [
      { x: -28.0, y: -4.0, part: 'body' as const },
      { x: -25.0, y: -10.0, part: 'body' as const },
      { x: -22.0, y: -15.0, part: 'body' as const },
      { x: -16.0, y: -18.0, part: 'body' as const },
      { x: -18.0, y: -7.0, part: 'operculum' as const },
      { x: -14.0, y: 0.0, part: 'operculum' as const },
      { x: -12.0, y: 5.0, part: 'operculum' as const },
      { x: -20.0, y: 7.0, part: 'belly' as const },
      { x: -26.0, y: 4.5, part: 'body' as const },
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

    // 3. Parasites along the silver flanks and yellow horizontal stripes
    const flankCoords = [
      { x: -8.0, y: -14.0 },
      { x: 0.0, y: -16.0 },
      { x: 8.0, y: -15.0 },
      { x: 16.0, y: -12.0 },
      { x: -6.0, y: -6.0 },
      { x: 2.0, y: -5.0 },
      { x: 10.0, y: -4.0 },
      { x: 18.0, y: -3.0 },
      { x: -4.0, y: 2.0 },
      { x: 4.0, y: 3.0 },
      { x: 12.0, y: 4.0 },
      { x: 20.0, y: 4.0 },
      { x: -6.0, y: 10.0 },
      { x: 2.0, y: 11.0 },
      { x: 10.0, y: 10.0 },
    ];

    for (const c of flankCoords) {
      this.parasites.push({
        id: id++,
        type: 'body',
        localX: c.x,
        localY: c.y,
        attachPart: 'body',
        hoverTimer: 0,
        removed: false,
      });
    }

    // 4. Parasites on belly and caudal peduncle
    const rearCoords = [
      { x: 24.0, y: -6.0 },
      { x: 30.0, y: -2.0 },
      { x: 34.0, y: 1.0 },
      { x: 28.0, y: 5.0 },
      { x: 22.0, y: 7.0 },
    ];

    for (const c of rearCoords) {
      this.parasites.push({
        id: id++,
        type: 'body',
        localX: c.x,
        localY: c.y,
        attachPart: 'body',
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
      ly = p.localY * this.mouthAperture * s;
    } else if (p.attachPart === 'belly') {
      ly = p.localY * s + Math.sin(this.breathPhase) * 1.4;
    } else if (p.attachPart === 'operculum') {
      lx = p.localX * s - Math.sin(this.breathPhase) * 1.5;
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

  private getProfileTargetX(canvasWidth: number): number {
    const s = this.scale;
    return canvasWidth - (64 * s + 30);
  }

  public startExit() {
    if (this.state !== 'exiting' && this.state !== 'exited') {
      this.state = 'exiting';
      this.facingPlayer = false;
    }
  }

  public setFacingPlayer(_facing: boolean) {
    this.facingPlayer = false;
  }

  public toggleFacingPlayer(): boolean {
    return false;
  }

  public hitTest(pos: Vector2D): boolean {
    if (this.state === 'exited' || !this.isVisible) return false;
    const dx = pos.x - this.pos.x;
    const dy = pos.y - this.pos.y;
    const r = 95 * (this.scale / 4.5);
    return dx * dx + dy * dy < r * r;
  }

  public getCleaningStationSpots(): CleaningTargetSpot[] {
    const s = this.scale;
    const spots: CleaningTargetSpot[] = [];

    // Profile cleaning spots
    spots.push(
      {
        id: 'grunt-mouth',
        name: 'Small Grunt Mouth & Lips',
        pos: { x: this.pos.x - 33 * s, y: this.pos.y + 2 * s },
      },
      {
        id: 'grunt-head',
        name: 'Yellow Head & Blue Face Markings',
        pos: { x: this.pos.x - 22 * s, y: this.pos.y - 7 * s },
      },
      {
        id: 'grunt-eye',
        name: 'Expressive Eye Orbital',
        pos: { x: this.pos.x - 20 * s, y: this.pos.y - 4 * s },
      },
      {
        id: 'grunt-stripes',
        name: 'Yellow Diagonal & Horizontal Stripes',
        pos: { x: this.pos.x + 4 * s, y: this.pos.y - 2 * s },
      },
      {
        id: 'grunt-dorsal',
        name: 'Golden Spiny Dorsal Fin',
        pos: { x: this.pos.x - 2 * s, y: this.pos.y - 24 * s },
      },
      {
        id: 'grunt-tail',
        name: 'Silver Peduncle & Tail',
        pos: { x: this.pos.x + 30 * s, y: this.pos.y },
      }
    );

    return spots;
  }

  public update(canvasWidth: number, canvasHeight: number, dt: number) {
    this.animTime += dt * 0.038;
    this.breathPhase += dt * 0.048;
    this.finPhase += dt * 0.12;

    // Small mouth rhythmic pulsing
    this.mouthAperture = 0.75 + Math.sin(this.breathPhase * 1.4) * 0.25;

    this.turnProgress = 0;
    this.facingPlayer = false;

    const profileTargetX = this.getProfileTargetX(canvasWidth);
    this.targetPos.x = profileTargetX;
    this.targetPos.y = canvasHeight * 0.47;

    // Floating subtle bobbing
    const bob = Math.sin(this.animTime * 1.3) * (3.2 * (1 - this.turnProgress * 0.4));
    const sway = Math.cos(this.animTime * 0.95) * 2.2;

    // State Machine
    if (this.state === 'entering') {
      const dx = this.targetPos.x - this.pos.x;
      const dy = this.targetPos.y - this.pos.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 4.0) {
        this.state = 'stationary';
        this.pos.x = this.targetPos.x;
        this.pos.y = this.targetPos.y;
      } else {
        this.pos.x += (dx / dist) * this.entrySpeed * dt;
        this.pos.y += (dy / dist) * this.entrySpeed * dt;
      }
    } else if (this.state === 'stationary') {
      const dx = this.targetPos.x - this.pos.x;
      const dy = this.targetPos.y - this.pos.y;
      this.pos.x += dx * 0.05 * dt;
      this.pos.y += dy * 0.05 * dt;
    } else if (this.state === 'exiting') {
      this.pos.x += this.exitSpeed * dt;
      if (this.pos.x > canvasWidth + 500) {
        this.state = 'exited';
        this.isVisible = false;
      }
    }

    this.pos.y += bob * 0.04 * dt;
    this.pos.x += sway * 0.02 * dt;
  }

  /**
   * Main Render Dispatcher
   */
  public render(ctx: CanvasRenderingContext2D) {
    if (!this.isVisible || this.state === 'exited') return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    this.renderProfile(ctx);

    ctx.restore();
  }

  /**
   * Render Profile View:
   * Smooth low-poly deep-bodied silver/cream body, yellow head, blue facial stripes,
   * strong yellow horizontal/diagonal body stripes, large expressive eye, and yellow fins.
   */
  private renderProfile(ctx: CanvasRenderingContext2D) {
    const s = this.scale;
    const breathOffset = Math.sin(this.breathPhase) * 1.6;
    const finWave = Math.sin(this.finPhase);

    // 1. Spiny & Soft Dorsal Fin (Yellow/amber continuous fin along upper back)
    this.renderDorsalFin(ctx, s, finWave);

    // 2. Anal Fin (Golden yellow rear bottom fin)
    this.renderAnalFin(ctx, s, finWave);

    // 3. Caudal Tail (Forked translucent golden-yellow tail)
    this.renderCaudalFin(ctx, s, finWave);

    // 4. Pelvic Fin (Translucent yellow ventral fin)
    this.renderPelvicFin(ctx, s, finWave);

    // 5. Main Deep Body Profile (Silver/cream base with yellow head zone)
    this.renderMainBody(ctx, s, breathOffset);

    // 6. Yellow Horizontal & Diagonal Stripes on Flanks
    this.renderYellowBodyStripes(ctx, s);

    // 7. Electric Blue / Slate-Gray Facial Accent Markings & Head Details
    this.renderFacialMarkings(ctx, s);

    // 8. Large Expressive Eye
    this.renderLargeExpressiveEye(ctx, s);

    // 9. Relatively Small Grunt Mouth & Soft Pale Lips
    this.renderSmallMouth(ctx, s);

    // 10. Translucent Yellow Pectoral Fin
    this.renderPectoralFin(ctx, s, finWave);

    // 11. Parasites
    this.renderParasites(ctx);
  }

  /**
   * Dorsal Fin: Continuous spiny anterior transitioning to soft posterior with yellow/amber glow
   */
  private renderDorsalFin(ctx: CanvasRenderingContext2D, s: number, finWave: number) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-16 * s, -19 * s);
    // Spiny anterior crest
    ctx.bezierCurveTo(-8 * s, -28 * s + finWave * 2, 6 * s, -26 * s - finWave * 2, 18 * s, -22 * s);
    // Soft posterior fin
    ctx.bezierCurveTo(24 * s, -26 * s + finWave * 2, 34 * s, -20 * s, 36 * s, -9 * s);
    ctx.lineTo(32 * s, -8 * s);
    ctx.closePath();

    const dGrad = ctx.createLinearGradient(-10 * s, -28 * s, 34 * s, -8 * s);
    dGrad.addColorStop(0, 'rgba(255, 215, 0, 0.9)'); // Bright gold
    dGrad.addColorStop(0.5, 'rgba(240, 190, 40, 0.75)');
    dGrad.addColorStop(1, 'rgba(220, 160, 20, 0.55)');
    ctx.fillStyle = dGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 235, 100, 0.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Spines & Soft Rays
    ctx.strokeStyle = 'rgba(255, 245, 180, 0.6)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const rx = lerp(-12 * s, 34 * s, t);
      const ry1 = lerp(-19 * s, -9 * s, t);
      const ry2 = lerp(-27 * s + Math.sin(this.finPhase + i) * 1.5, -16 * s, t);
      ctx.beginPath();
      ctx.moveTo(rx, ry1);
      ctx.lineTo(rx + 1.5 * s, ry2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Anal Fin: Translucent golden-yellow ventral rear fin
   */
  private renderAnalFin(ctx: CanvasRenderingContext2D, s: number, finWave: number) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(12 * s, 16 * s);
    ctx.bezierCurveTo(18 * s, 26 * s - finWave * 2, 28 * s, 22 * s + finWave * 2, 34 * s, 9 * s);
    ctx.lineTo(30 * s, 8 * s);
    ctx.closePath();

    const aGrad = ctx.createLinearGradient(12 * s, 24 * s, 34 * s, 8 * s);
    aGrad.addColorStop(0, 'rgba(255, 215, 0, 0.85)');
    aGrad.addColorStop(0.6, 'rgba(240, 180, 30, 0.7)');
    aGrad.addColorStop(1, 'rgba(220, 150, 10, 0.45)');
    ctx.fillStyle = aGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 235, 100, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Soft rays
    ctx.strokeStyle = 'rgba(255, 245, 180, 0.5)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const rx = lerp(14 * s, 32 * s, t);
      const ry1 = lerp(16 * s, 8.5 * s, t);
      const ry2 = lerp(23 * s - Math.sin(this.finPhase + i) * 1.5, 12 * s, t);
      ctx.beginPath();
      ctx.moveTo(rx, ry1);
      ctx.lineTo(rx + 1 * s, ry2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Caudal Fin: Forked, energetic golden-yellow tail
   */
  private renderCaudalFin(ctx: CanvasRenderingContext2D, s: number, finWave: number) {
    ctx.save();
    const sway = Math.sin(this.animTime * 1.6) * 3.5;

    ctx.beginPath();
    ctx.moveTo(34 * s, -8 * s);
    // Upper lobe
    ctx.bezierCurveTo(46 * s, -18 * s + sway, 56 * s, -16 * s + sway, 58 * s, -12 * s + sway);
    // Central fork notch
    ctx.bezierCurveTo(50 * s, -4 * s + sway, 46 * s, 0 + sway, 44 * s, 0 + sway);
    // Lower fork notch
    ctx.bezierCurveTo(46 * s, 0 + sway, 50 * s, 4 * s + sway, 58 * s, 12 * s + sway);
    // Lower lobe
    ctx.bezierCurveTo(56 * s, 16 * s + sway, 46 * s, 18 * s + sway, 34 * s, 8 * s);
    ctx.closePath();

    const cGrad = ctx.createRadialGradient(34 * s, 0, 4 * s, 54 * s, sway, 30 * s);
    cGrad.addColorStop(0, 'rgba(255, 220, 50, 0.95)');
    cGrad.addColorStop(0.6, 'rgba(245, 195, 30, 0.8)');
    cGrad.addColorStop(1, 'rgba(220, 160, 10, 0.55)');
    ctx.fillStyle = cGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 120, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Caudal fin rays
    ctx.strokeStyle = 'rgba(255, 250, 200, 0.45)';
    ctx.lineWidth = 0.8;
    for (let i = -4; i <= 4; i++) {
      const ty = (i / 4) * 7 * s;
      const ey = (i / 4) * 14 * s + sway;
      ctx.beginPath();
      ctx.moveTo(34 * s, ty * 0.8);
      ctx.lineTo(54 * s, ey);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Pelvic Fin: Translucent yellow fin under chest
   */
  private renderPelvicFin(ctx: CanvasRenderingContext2D, s: number, finWave: number) {
    ctx.save();
    const px = -6 * s;
    const py = 16 * s;
    ctx.translate(px, py);
    ctx.rotate(finWave * 0.15);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(6 * s, 8 * s);
    ctx.lineTo(9 * s, 6 * s);
    ctx.lineTo(3 * s, 0);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 215, 0, 0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 120, 0.8)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Main Deep Body Profile:
   * Anatomical deep-bodied oval shape, steep convex forehead, silver/cream ground with yellow head
   */
  private renderMainBody(ctx: CanvasRenderingContext2D, s: number, breathOffset: number) {
    ctx.save();

    // Contour path of deep-bodied French Grunt
    ctx.beginPath();
    // Snout / small mouth tip
    ctx.moveTo(-33 * s, 1.5 * s);
    // Convex forehead slope up to dorsal origin
    ctx.bezierCurveTo(-28 * s, -8 * s, -22 * s, -16 * s, -16 * s, -19 * s);
    // High dorsal arch
    ctx.bezierCurveTo(-4 * s, -23 * s, 12 * s, -21 * s, 22 * s, -15 * s);
    // Caudal peduncle top
    ctx.bezierCurveTo(28 * s, -11 * s, 32 * s, -8 * s, 34 * s, -8 * s);
    // Caudal peduncle rear edge
    ctx.lineTo(34 * s, 8 * s);
    // Caudal peduncle bottom
    ctx.bezierCurveTo(32 * s, 8 * s, 28 * s, 11 * s, 20 * s, 14 * s);
    // Deep belly curve & throat
    ctx.bezierCurveTo(8 * s, 19 * s + breathOffset, -10 * s, 18 * s + breathOffset, -22 * s, 11 * s);
    // Chin to lower lip
    ctx.bezierCurveTo(-27 * s, 7 * s, -31 * s, 4 * s, -33 * s, 3.5 * s);
    ctx.closePath();

    // Complex multi-stop linear gradient: Brilliant yellow head blending to shimmering silver/cream flanks
    const bodyGrad = ctx.createLinearGradient(-33 * s, -10 * s, 34 * s, 10 * s);
    bodyGrad.addColorStop(0, '#ffd43b'); // Golden yellow snout & head
    bodyGrad.addColorStop(0.24, '#f7c948'); // Warm golden anterior
    bodyGrad.addColorStop(0.42, '#f1f5f9'); // Silver/white pearlescent transition
    bodyGrad.addColorStop(0.7, '#e2e8f0'); // Muted metallic silver flanks
    bodyGrad.addColorStop(1, '#cbd5e1'); // Pale silver-gray caudal peduncle
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Metallic pearlescent specular highlight along upper back
    const dorsalSheen = ctx.createLinearGradient(0, -22 * s, 0, 0);
    dorsalSheen.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    dorsalSheen.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = dorsalSheen;
    ctx.fill();

    // Anatomical edge stroke
    ctx.strokeStyle = 'rgba(230, 200, 100, 0.6)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Operculum (gill cover) smooth curve
    ctx.beginPath();
    ctx.arc(-13 * s, 2 * s, 9 * s, -1.2, 0.9);
    ctx.strokeStyle = 'rgba(210, 170, 40, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Yellow Horizontal & Diagonal Stripes on Body:
   * Diagnostic feature of Haemulon flavolineatum (horizontal stripes below lateral line,
   * oblique diagonal stripes above lateral line)
   */
  private renderYellowBodyStripes(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();

    // 1. Oblique diagonal stripes above lateral line (sloping upward and backward)
    ctx.strokeStyle = '#f59e0b'; // Rich golden-amber yellow
    ctx.lineWidth = 2.2 * (s / 4.5);
    ctx.lineCap = 'round';

    const diagonalStripes = [
      { x1: -14 * s, y1: -10 * s, x2: 2 * s, y2: -19 * s },
      { x1: -10 * s, y1: -6 * s, x2: 12 * s, y2: -18 * s },
      { x1: -4 * s, y1: -3 * s, x2: 18 * s, y2: -15 * s },
      { x1: 2 * s, y1: 0 * s, x2: 24 * s, y2: -11 * s },
    ];

    for (const d of diagonalStripes) {
      ctx.beginPath();
      ctx.moveTo(d.x1, d.y1);
      ctx.lineTo(d.x2, d.y2);
      ctx.stroke();
    }

    // 2. Strong horizontal stripes below lateral line (parallel along flank and belly)
    const horizontalStripes = [
      { y: -3 * s, xStart: -16 * s, xEnd: 32 * s },
      { y: 1.5 * s, xStart: -14 * s, xEnd: 32 * s },
      { y: 6.0 * s, xStart: -12 * s, xEnd: 28 * s },
      { y: 10.5 * s, xStart: -8 * s, xEnd: 22 * s },
      { y: 14.5 * s, xStart: -4 * s, xEnd: 15 * s },
    ];

    for (const h of horizontalStripes) {
      ctx.beginPath();
      ctx.moveTo(h.xStart, h.y);
      // Soft gentle wave matching the contour
      ctx.bezierCurveTo(
        (h.xStart + h.xEnd) * 0.4,
        h.y + 0.5 * s,
        (h.xStart + h.xEnd) * 0.7,
        h.y - 0.5 * s,
        h.xEnd,
        h.y
      );
      ctx.stroke();
    }

    // Pearlescent metallic highlight between stripes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.1 * (s / 4.5);
    for (const h of horizontalStripes) {
      ctx.beginPath();
      ctx.moveTo(h.xStart + 4 * s, h.y - 1.8 * s);
      ctx.lineTo(h.xEnd - 2 * s, h.y - 1.8 * s);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Electric Blue / Slate-Gray Facial Markings & Head Details:
   * Diagnostic neon blue/slate stripes wrapping around the snout, eye, and cheeks
   */
  private renderFacialMarkings(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();

    // Electric cyan/blue facial stripes
    ctx.strokeStyle = '#38bdf8'; // Electric sky blue
    ctx.lineWidth = 1.5 * (s / 4.5);
    ctx.lineCap = 'round';

    // Stripe 1: Snout to upper eye orbital
    ctx.beginPath();
    ctx.moveTo(-31 * s, -1 * s);
    ctx.bezierCurveTo(-27 * s, -3 * s, -24 * s, -7 * s, -20 * s, -9 * s);
    ctx.stroke();

    // Stripe 2: Snout through lower eye orbital
    ctx.beginPath();
    ctx.moveTo(-30 * s, 1.5 * s);
    ctx.bezierCurveTo(-25 * s, 0.5 * s, -21 * s, -0.5 * s, -14 * s, -0.5 * s);
    ctx.stroke();

    // Stripe 3: Cheek & opercular lower band
    ctx.beginPath();
    ctx.moveTo(-26 * s, 4 * s);
    ctx.bezierCurveTo(-21 * s, 4 * s, -17 * s, 4.5 * s, -11 * s, 4.5 * s);
    ctx.stroke();

    // Stripe 4: Forehead crown line
    ctx.beginPath();
    ctx.moveTo(-25 * s, -12 * s);
    ctx.bezierCurveTo(-21 * s, -15 * s, -17 * s, -17 * s, -12 * s, -18 * s);
    ctx.stroke();

    // Subtle neon blue glow
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 3.2 * (s / 4.5);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Large Expressive-Looking Eye:
   * Prominent, large eye with golden-yellow iris, rich black pupil, and glowing white specular highlights
   */
  private renderLargeExpressiveEye(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    const ex = -20 * s;
    const ey = -4 * s;
    const er = 5.2 * s; // Large, prominent eye

    // Orbital fleshy socket ring
    ctx.beginPath();
    ctx.arc(ex, ey, er + 1.6 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ca8a04'; // Deep gold orbital ring
    ctx.fill();
    ctx.strokeStyle = '#38bdf8'; // Blue rim accent
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Eyeball / Iris (Brilliant golden yellow)
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(ex - 1 * s, ey - 1 * s, 0.6 * s, ex, ey, er);
    irisGrad.addColorStop(0, '#fef08a'); // Pale luminous gold center
    irisGrad.addColorStop(0.5, '#eab308'); // Bright yellow
    irisGrad.addColorStop(0.85, '#ca8a04'); // Deep amber gold
    irisGrad.addColorStop(1, '#713f12'); // Dark rim
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Large dark pupil (Expressive look)
    ctx.beginPath();
    ctx.arc(ex, ey, er * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();

    // Primary specular corneal glint
    ctx.beginPath();
    ctx.arc(ex - 1.5 * s, ey - 1.5 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();

    // Secondary soft reflection
    ctx.beginPath();
    ctx.arc(ex + 1.2 * s, ey + 1.2 * s, 0.8 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Relatively Small Grunt Mouth:
   * Small terminal mouth with pale lips, bright red interior mouth lining (characteristic of grunts),
   * and tiny delicate teeth
   */
  private renderSmallMouth(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    const aperture = this.mouthAperture;

    // Fleshy pale lips
    ctx.beginPath();
    ctx.ellipse(-33 * s, 2.5 * s, 2.8 * s, 3.2 * s, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#fed7aa'; // Soft pale fleshy tone
    ctx.fill();
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Bright scarlet/red interior mouth gape (characteristic feature that gives Grunts their name)
    ctx.beginPath();
    ctx.ellipse(-33.5 * s, 2.5 * s, 1.4 * s, 2.2 * s * aperture, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626'; // Vibrant scarlet red mouth lining
    ctx.fill();

    // Tiny white delicate incisor teeth
    ctx.fillStyle = '#ffffff';
    // Upper teeth
    ctx.beginPath();
    ctx.moveTo(-33.5 * s, 1.2 * s);
    ctx.lineTo(-34.5 * s, 1.8 * s);
    ctx.lineTo(-33.2 * s, 2.1 * s);
    ctx.fill();

    // Lower teeth
    ctx.beginPath();
    ctx.moveTo(-33.5 * s, 3.8 * s * aperture);
    ctx.lineTo(-34.5 * s, 3.2 * s * aperture);
    ctx.lineTo(-33.2 * s, 2.9 * s * aperture);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Pectoral Fin:
   * Translucent golden-yellow fan fin
   */
  private renderPectoralFin(ctx: CanvasRenderingContext2D, s: number, finWave: number) {
    ctx.save();
    const px = -10 * s;
    const py = 4 * s;
    const angle = finWave * 0.22;

    ctx.translate(px, py);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(4 * s, -4 * s, 11 * s, -3 * s, 13 * s, 3 * s);
    ctx.bezierCurveTo(11 * s, 8 * s, 4 * s, 6 * s, 0, 0);
    ctx.closePath();

    ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 120, 0.85)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Fin rays
    ctx.strokeStyle = 'rgba(255, 250, 200, 0.6)';
    ctx.lineWidth = 0.7;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(12 * s, i * 1.8 * s + 1 * s);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Parasite Rendering & Interactive Station Glows
   */
  private renderParasites(ctx: CanvasRenderingContext2D) {
    const s = this.scale;

    for (const p of this.parasites) {
      if (p.removed) continue;
      const lPos = this.getParasiteLocalPos(p);

      ctx.save();
      ctx.translate(lPos.x, lPos.y);

      // Crustacean isopod parasite
      ctx.beginPath();
      ctx.ellipse(0, 0, 3.2 * (s / 4.5), 2.0 * (s / 4.5), 0.25, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444'; // Coral red parasite
      ctx.fill();
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 0.9;
      ctx.stroke();

      // Segmentation lines
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-1.4 * (s / 4.5), -1.2 * (s / 4.5));
      ctx.lineTo(-1.4 * (s / 4.5), 1.2 * (s / 4.5));
      ctx.moveTo(0, -1.5 * (s / 4.5));
      ctx.lineTo(0, 1.5 * (s / 4.5));
      ctx.moveTo(1.4 * (s / 4.5), -1.2 * (s / 4.5));
      ctx.lineTo(1.4 * (s / 4.5), 1.2 * (s / 4.5));
      ctx.stroke();

      // Subtle pulse glow
      const glow = (Math.sin(this.animTime * 4 + p.id) + 1) * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 5.0 * (s / 4.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(254, 202, 202, ${0.15 + glow * 0.25})`;
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Facing-Player View:
   * Frontal perspective of the deep-bodied French Grunt, showcasing the golden-yellow forehead,
   * bilateral electric blue facial markings, large expressive lateral eyes, and bright red interior mouth gape.
   */
  private renderFacingPlayer(ctx: CanvasRenderingContext2D) {
    const s = this.scale;
    const breathOffset = Math.sin(this.breathPhase) * 2.0;

    // 1. Spiny Dorsal Crest (Centered on top)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-2 * s, -22 * s);
    ctx.lineTo(0, -32 * s);
    ctx.lineTo(2 * s, -22 * s);
    ctx.closePath();
    ctx.fillStyle = '#ffd43b';
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // 2. Frontal Body Silhouette
    ctx.save();
    ctx.beginPath();
    // Forehead crown
    ctx.moveTo(0, -22 * s);
    // Cheeks & operculum sides
    ctx.bezierCurveTo(-15 * s, -14 * s, -19 * s, -4 * s, -17 * s, 6 * s);
    // Lower jaw & belly
    ctx.bezierCurveTo(-14 * s, 14 * s, -8 * s, 21 * s + breathOffset, 0, 24 * s + breathOffset);
    // Right side
    ctx.bezierCurveTo(8 * s, 21 * s + breathOffset, 14 * s, 14 * s, 17 * s, 6 * s);
    ctx.bezierCurveTo(19 * s, -4 * s, 15 * s, -14 * s, 0, -22 * s);
    ctx.closePath();

    const frontGrad = ctx.createRadialGradient(0, -2 * s, 4 * s, 0, 0, 22 * s);
    frontGrad.addColorStop(0, '#fef08a'); // Bright gold center
    frontGrad.addColorStop(0.5, '#eab308');
    frontGrad.addColorStop(0.85, '#e2e8f0'); // Silver flank edges
    frontGrad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = frontGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Bilateral electric blue facial stripes on front face
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6 * (s / 4.5);
    // Left cheek stripe
    ctx.beginPath();
    ctx.moveTo(-6 * s, -12 * s);
    ctx.bezierCurveTo(-10 * s, -6 * s, -11 * s, 2 * s, -7 * s, 8 * s);
    ctx.stroke();
    // Right cheek stripe
    ctx.beginPath();
    ctx.moveTo(6 * s, -12 * s);
    ctx.bezierCurveTo(10 * s, -6 * s, 11 * s, 2 * s, 7 * s, 8 * s);
    ctx.stroke();

    // 3. Bilateral Large Expressive Eyes
    const renderFrontEye = (x: number, y: number) => {
      ctx.beginPath();
      ctx.ellipse(x, y, 4.0 * s, 4.8 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ca8a04';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 3.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 2.2 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#09090b';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x - 0.9 * s, y - 0.9 * s, 1.0 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    };

    renderFrontEye(-14 * s, -4 * s);
    renderFrontEye(14 * s, -4 * s);

    // 4. Frontal Small Mouth & Scarlet Red Gape
    ctx.beginPath();
    ctx.ellipse(0, 8 * s, 3.4 * s, 2.5 * s * this.mouthAperture, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626'; // Vibrant red mouth interior
    ctx.fill();
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Pale lips
    ctx.beginPath();
    ctx.ellipse(0, 8 * s, 4.2 * s, 3.2 * s * this.mouthAperture, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // 5. Bilateral Translucent Pectoral Fins (Fluttering outward)
    const finFlutter = Math.sin(this.finPhase) * 0.35;

    ctx.save();
    ctx.translate(-17 * s, 6 * s);
    ctx.rotate(-0.4 + finFlutter);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(17 * s, 6 * s);
    ctx.rotate(0.4 - finFlutter);
    ctx.beginPath();
    ctx.ellipse(0, 0, 8 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }
}

import { Vector2D, Parasite } from '../types';
import { lerp, clamp } from '../utils/math';
import { parasiteUnit, drawParasite, drawEatRing, subsampleParasites } from './parasiteFx';

export interface CleaningTargetSpot {
  id: string;
  name: string;
  pos: Vector2D;
}

/**
 * Atlantic Trumpetfish (Aulostomus maculatus)
 * "Smooth Low-Poly" Style Guide Implementation:
 * - Extremely elongated, compressed, stick-like silhouette (~60–90 cm)
 * - Extremely long, slender tubular snout with fine longitudinal blue-violet iridescent streaks
 * - Tiny terminal mouth at the apex with a delicate fleshy chin barbel
 * - Small eye relative to body positioned high on the cranium
 * - Long matching soft dorsal and anal fins positioned far toward the rear
 * - Very thin, tapered caudal peduncle and small rounded tail fin with black ocellus
 * - Golden-yellow/amber and mottled brown coloration with luminous highlights
 */
export class Trumpetfish {
  public pos: Vector2D = { x: 0, y: 0 };
  public targetPos: Vector2D = { x: 0, y: 0 };
  public heading: number = Math.PI; // Facing left toward cleaning station

  // Scale 6.5
  public scale: number = 3.9;

  public state: 'entering' | 'stationary' | 'exiting' | 'exited' = 'entering';
  public entrySpeed: number = 2.5;
  public exitSpeed: number = 3.2;

  public animTime: number = 0;
  public breathPhase: number = 0;
  public finPhase: number = 0;
  public mouthAperture: number = 0.8;

  public isVisible: boolean = true;

  // Procedural Turn & Perspective Facing State
  public facingPlayer: boolean = false;
  public turnProgress: number = 0; // 0.0 = Profile, 1.0 = Facing Player
  public turnSpeed: number = 0.0075;

  // Parasites on tubular snout, tiny terminal mouth, barbel, elongated torso, and rear fins
  public parasites: Parasite[] = [];

  // Cavity gates driven by the ClientDirector (1 = open/eatable):
  // gill parasites hide under the operculum flap, teeth behind the lips.
  public gillOpen: number = 1;
  public mouthGate: number = 1;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.pos = {
      x: canvasWidth + 500,
      y: canvasHeight * 0.48,
    };
    this.targetPos = {
      x: this.getProfileTargetX(canvasWidth),
      y: canvasHeight * 0.48,
    };

    this.initParasites();
    this.parasites = subsampleParasites(this.parasites, 12);
  }

  /**
   * Initialize parasites over the long tubular snout, mouth, elongated flank, and rear fins
   */
  private initParasites() {
    this.parasites = [];
    let id = 400;

    // 1. Parasites on tiny terminal mouth and long tubular snout
    const snoutCoords = [
      { x: -94.0, y: -0.8, part: 'upperTeeth' as const },
      { x: -92.0, y: 1.4, part: 'lowerTeeth' as const },
      { x: -90.0, y: 3.0, part: 'lowerTeeth' as const }, // near chin barbel
      { x: -84.0, y: -0.5, part: 'upperTeeth' as const },
      { x: -76.0, y: 0.8, part: 'body' as const },
      { x: -68.0, y: -1.2, part: 'body' as const },
      { x: -60.0, y: 1.0, part: 'body' as const },
      { x: -52.0, y: -0.6, part: 'body' as const },
    ];

    for (const c of snoutCoords) {
      this.parasites.push({
        id: id++,
        type: c.part === 'upperTeeth' || c.part === 'lowerTeeth' ? 'teeth' : 'body',
        localX: c.x,
        localY: c.y,
        attachPart: c.part,
        hoverTimer: 0,
        removed: false,
      });
    }

    // 2. Body Parasites along the elongated flanks, back, belly, and rear caudal zone
    const bodyCoords = [
      // Cranium & Opercular area
      { x: -40.0, y: -3.5, part: 'body' as const },
      { x: -32.0, y: -5.0, part: 'body' as const },
      { x: -24.0, y: 4.0, part: 'operculum' as const },
      { x: -18.0, y: 1.0, part: 'operculum' as const },
      // Elongated Torso (Dorsal & Lateral)
      { x: -10.0, y: -6.0, part: 'body' as const },
      { x: -2.0, y: -6.5, part: 'body' as const },
      { x: 8.0, y: -6.0, part: 'body' as const },
      { x: 18.0, y: -6.2, part: 'body' as const },
      { x: 28.0, y: -5.8, part: 'body' as const },
      { x: 38.0, y: -5.5, part: 'body' as const },
      { x: 48.0, y: -5.0, part: 'body' as const },
      // Elongated Mid-Flank & Belly
      { x: -8.0, y: 5.5, part: 'belly' as const },
      { x: 2.0, y: 6.0, part: 'belly' as const },
      { x: 14.0, y: 5.8, part: 'belly' as const },
      { x: 24.0, y: 5.5, part: 'belly' as const },
      { x: 36.0, y: 5.0, part: 'belly' as const },
      { x: 46.0, y: 4.5, part: 'belly' as const },
      // Rear Soft Dorsal & Anal Fin Bases
      { x: 58.0, y: -5.5, part: 'body' as const },
      { x: 68.0, y: -6.5, part: 'body' as const },
      { x: 58.0, y: 5.0, part: 'belly' as const },
      { x: 68.0, y: 5.8, part: 'belly' as const },
      // Slender Caudal Peduncle & Tail Base
      { x: 78.0, y: -1.5, part: 'body' as const },
      { x: 86.0, y: 0.5, part: 'body' as const },
      { x: 94.0, y: -0.5, part: 'body' as const },
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
      ly = p.localY * s + (this.mouthAperture - 0.8) * (2.5 * s);
    } else if (p.attachPart === 'upperTeeth') {
      ly = p.localY * s - (this.mouthAperture - 0.8) * (1.5 * s);
    } else if (p.attachPart === 'belly') {
      ly = p.localY * s + Math.sin(this.breathPhase) * 1.0;
    } else if (p.attachPart === 'operculum') {
      lx = p.localX * s - Math.sin(this.breathPhase) * 1.2;
    }

    return { x: lx, y: ly };
  }

  public getProfileTargetX(canvasWidth: number): number {
    // Slender trumpetfish with long tubular snout reaching left
    return canvasWidth - (105 * this.scale + 24);
  }

  public getFacingTargetX(canvasWidth: number): number {
    return canvasWidth * 0.58;
  }

  public setFacingPlayer(_facing?: boolean) {
    this.facingPlayer = false;
  }

  public toggleFacingPlayer(): boolean {
    return false;
  }

  public startExit() {
    if (this.state === 'stationary' || this.state === 'entering') {
      this.state = 'exiting';
    }
  }

  public update(canvasWidth: number, canvasHeight: number, dt: number) {
    this.animTime += 0.018 * dt;
    this.breathPhase += 0.024 * dt;
    this.finPhase += 0.045 * dt;

    // Gentle buccal respiratory pulsation
    this.mouthAperture = 0.8 + Math.sin(this.breathPhase) * 0.18;

    this.turnProgress = 0;
    this.facingPlayer = false;

    const profileTargetX = this.getProfileTargetX(canvasWidth);
    this.targetPos.x = profileTargetX;
    this.targetPos.y = canvasHeight * 0.48;

    // State machine
    if (this.state === 'entering') {
      const dx = this.targetPos.x - this.pos.x;
      const dy = this.targetPos.y - this.pos.y;
      this.pos.x += dx * 0.025 * this.entrySpeed * dt;
      this.pos.y += dy * 0.025 * this.entrySpeed * dt;

      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
        this.state = 'stationary';
        this.pos.x = this.targetPos.x;
        this.pos.y = this.targetPos.y;
      }
    } else if (this.state === 'stationary') {
      // Natural aquatic hover with subtle buoyant micro-sway
      const hoverX = Math.cos(this.animTime * 0.7) * 2.0;
      const hoverY = Math.sin(this.animTime * 0.9) * 3.0;
      this.pos.x = this.targetPos.x + hoverX;
      this.pos.y = this.targetPos.y + hoverY;
    } else if (this.state === 'exiting') {
      // Graceful reverse backing away
      this.pos.x += 4.2 * this.exitSpeed * dt;
      this.pos.y += Math.sin(this.animTime * 1.5) * 0.8 * dt;

      if (this.pos.x > canvasWidth + 600) {
        this.state = 'exited';
        this.isVisible = false;
      }
    }
  }

  public updateParasites(
    wrasseMouth: Vector2D | null,
    gobiMouth: Vector2D | null,
    dt: number,
    wrasseScale: number,
    gobiScale: number
  ) {
    for (const p of this.parasites) {
      if (p.removed) continue;
      if (p.attachPart === 'operculum' && this.gillOpen < 0.6) continue;
      if ((p.attachPart === 'upperTeeth' || p.attachPart === 'lowerTeeth') && this.mouthGate < 0.6) continue;

      const lp = this.getParasiteLocalPos(p);
      const wx = this.pos.x + lp.x;
      const wy = this.pos.y + lp.y;

      let isHovered = false;

      // Check Wrasse
      if (wrasseMouth) {
        const dWrasse = Math.hypot(wx - wrasseMouth.x, wy - wrasseMouth.y);
        const threshold = (p.type === 'teeth' ? 24 : 20) * wrasseScale;
        if (dWrasse < threshold) isHovered = true;
      }

      // Check Goby
      if (gobiMouth && !isHovered) {
        const dGobi = Math.hypot(wx - gobiMouth.x, wy - gobiMouth.y);
        const threshold = (p.type === 'teeth' ? 22 : 18) * gobiScale;
        if (dGobi < threshold) isHovered = true;
      }

      // Eat on touch, same as every other client species
      if (isHovered) {
        p.removed = true;
        p.hoverTimer = 1;
      }
    }
  }

  public getCleaningStationSpots(): CleaningTargetSpot[] {
    const s = this.scale;
    const spots: CleaningTargetSpot[] = [];

    // Snout Tip & Mouth
    spots.push({
      id: 'mouth',
      name: 'Snout Tip & Mouth',
      pos: { x: this.pos.x - 93 * s, y: this.pos.y },
    });

    // Long Tubular Snout Midpoint
    spots.push({
      id: 'snout_mid',
      name: 'Tubular Snout',
      pos: { x: this.pos.x - 68 * s, y: this.pos.y },
    });

    // Gill Cover / Operculum
    spots.push({
      id: 'gills',
      name: 'Operculum & Pectoral Base',
      pos: { x: this.pos.x - 20 * s, y: this.pos.y + 2 * s },
    });

    // Elongated Torso Midpoint
    spots.push({
      id: 'torso',
      name: 'Elongated Flank',
      pos: { x: this.pos.x + 18 * s, y: this.pos.y },
    });

    // Rear Dorsal & Anal Fin Base
    spots.push({
      id: 'rear_fins',
      name: 'Rear Fin Station',
      pos: { x: this.pos.x + 68 * s, y: this.pos.y },
    });

    // Caudal Peduncle & Tail
    spots.push({
      id: 'tail',
      name: 'Slender Caudal Tail',
      pos: { x: this.pos.x + 95 * s, y: this.pos.y },
    });

    return spots;
  }

  public getActiveParasitePositions(): Vector2D[] {
    return this.parasites
      .filter((p) => !p.removed)
      .map((p) => {
        const lp = this.getParasiteLocalPos(p);
        return { x: this.pos.x + lp.x, y: this.pos.y + lp.y };
      });
  }

  public getParasiteStats() {
    const total = this.parasites.length;
    const remaining = this.parasites.filter((p) => !p.removed).length;
    const removed = total - remaining;
    const teethRemaining = this.parasites.filter((p) => p.type === 'teeth' && !p.removed).length;
    const bodyRemaining = this.parasites.filter((p) => p.type === 'body' && !p.removed).length;

    return { total, remaining, removed, teethRemaining, bodyRemaining };
  }

  public hitTest(pt: Vector2D): boolean {
    const s = this.scale;
    const minX = this.pos.x - 100 * s;
    const maxX = this.pos.x + 115 * s;
    const minY = this.pos.y - 20 * s;
    const maxY = this.pos.y + 20 * s;

    return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
  }

  /**
   * Main Render Dispatcher
   */
  public render(ctx: CanvasRenderingContext2D) {
    if (!this.isVisible) return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    this.renderProfile(ctx);

    ctx.restore();
  }

  /**
   * Lateral Profile Render: Caribbean Trumpetfish (Aulostomus maculatus)
   * Follows the Smooth Low-Poly Organic Style Guide:
   * - Long tubular snout, tiny terminal mouth & barbel
   * - Slender rod-like elongated body with golden-amber and mottled brown gradients
   * - Electric blue and violet facial highlights
   * - Soft rear dorsal and anal fins
   * - Slender caudal peduncle with small rounded tail and black ocellus
   */
  private renderProfile(ctx: CanvasRenderingContext2D) {
    const s = this.scale;
    const breath = Math.sin(this.breathPhase) * 1.2;
    const finFlutter = Math.sin(this.finPhase) * 0.15;
    const finFlutterFast = Math.sin(this.finPhase * 1.6) * 0.22;

    // 1. Rear Soft Dorsal Fin (Far back at x = 55 to 82, mirroring anal fin)
    this.renderRearDorsalFin(ctx, s, finFlutter);

    // 2. Rear Anal Fin (Far back below dorsal at x = 55 to 82)
    this.renderRearAnalFin(ctx, s, finFlutter);

    // 3. Isolated Dorsal Spinelets along the elongated back (series of small low-poly spines)
    this.renderDorsalSpinelets(ctx, s);

    // 4. Slender Caudal Peduncle and Rounded Tail Fin with Black Ocellus (x = 82 to 112)
    this.renderCaudalTailFin(ctx, s, finFlutterFast);

    // 5. Ventral Pelvic Fin (Small, slender abdominal fins at x = 12)
    this.renderPelvicFin(ctx, s, finFlutter);

    // 6. Main Elongated Torso & Tubular Head Body Mask (Continuous Bézier Contours)
    this.renderElongatedBody(ctx, s, breath);

    // 7. Soft Low-Poly Facial & Flank Anatomical Facet Planes
    this.renderAnatomicalPlanes(ctx, s);

    // 8. Fleshy Chin Barbel at tip of lower jaw
    this.renderChinBarbel(ctx, s);

    // 9. Pectoral Fin (Near operculum at x = -16)
    this.renderPectoralFin(ctx, s, finFlutterFast);

    // 10. Expressive Small Golden Eye with Glint (x = -36, y = -3)
    this.renderSmallEye(ctx, s);

    // 11. Parasites & Cleaning Rings
    this.renderParasites(ctx);
  }

  /**
   * Main Elongated Torso & Long Tubular Snout
   */
  private renderElongatedBody(ctx: CanvasRenderingContext2D, s: number, breath: number) {
    ctx.save();

    // Body Contour: Starts at tiny mouth tip (-95, 0), runs along long tubular rostrum,
    // forehead nape (-32, -6.5), long flat back to soft dorsal base (55, -6),
    // down to thin caudal peduncle (82, -2), around tail base (96, 0),
    // along thin lower peduncle (82, 2), anal fin base (55, 6),
    // long flat belly (0, 6.5 + breath*0.3), throat (-24, 5.5), and underside of long tube snout (-94, 2)
    ctx.beginPath();
    ctx.moveTo(-95 * s, -1 * s);

    // Upper tube snout
    ctx.bezierCurveTo(-82 * s, -1.8 * s, -60 * s, -2.8 * s, -45 * s, -4.5 * s);
    // Cranium & Forehead Nape
    ctx.bezierCurveTo(-38 * s, -6.0 * s, -30 * s, -6.8 * s, -18 * s, -6.8 * s);
    // Elongated Back Ridge
    ctx.bezierCurveTo(6 * s, -6.8 * s, 32 * s, -6.5 * s, 55 * s, -6.0 * s);
    // Soft Dorsal Base to Thin Caudal Peduncle
    ctx.bezierCurveTo(68 * s, -5.5 * s, 76 * s, -3.0 * s, 84 * s, -2.0 * s);
    // Peduncle to Tail Insertion
    ctx.bezierCurveTo(90 * s, -1.5 * s, 94 * s, -1.2 * s, 96 * s, 0 * s);

    // Lower Tail Insertion to Lower Peduncle
    ctx.bezierCurveTo(94 * s, 1.2 * s, 90 * s, 1.5 * s, 84 * s, 2.0 * s);
    // Anal Fin Base
    ctx.bezierCurveTo(76 * s, 3.0 * s, 68 * s, 5.5 * s, 55 * s, 6.0 * s);
    // Elongated Belly Line
    ctx.bezierCurveTo(32 * s, 6.5 * s, 6 * s, (6.8 + breath * 0.3) * s, -18 * s, (6.8 + breath * 0.3) * s);
    // Opercular Throat & Jaw Under-curve
    ctx.bezierCurveTo(-30 * s, (6.2 + breath * 0.2) * s, -38 * s, 5.0 * s, -45 * s, 3.5 * s);
    // Lower Tube Snout
    ctx.bezierCurveTo(-60 * s, 2.4 * s, -82 * s, 1.8 * s, -94 * s, 1.4 * s);

    // Tiny terminal mouth cleft
    ctx.lineTo(-95 * s, -1 * s);
    ctx.closePath();

    // Multi-stop Rich Golden-Amber, Mottled Olive-Brown & Warm Ochre Gradient
    const bodyGrad = ctx.createLinearGradient(-95 * s, -10 * s, 95 * s, 10 * s);
    bodyGrad.addColorStop(0.0, '#eab308'); // Golden yellow snout tip
    bodyGrad.addColorStop(0.15, '#d97706'); // Warm amber rostrum
    bodyGrad.addColorStop(0.3, '#ca8a04'); // Ochre cranium
    bodyGrad.addColorStop(0.45, '#854d0e'); // Mottled olive-brown dorsal flank
    bodyGrad.addColorStop(0.65, '#a16207'); // Rich amber torso
    bodyGrad.addColorStop(0.85, '#ca8a04'); // Golden rear peduncle
    bodyGrad.addColorStop(1.0, '#eab308'); // Bright golden tail base

    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Subtle edge contour stroke
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Ventral Underbelly Soft Glow (Warm Cream/Pale Golden Highlight)
    const bellyGrad = ctx.createLinearGradient(0, -6 * s, 0, 7 * s);
    bellyGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.2)');
    bellyGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
    bellyGrad.addColorStop(1.0, 'rgba(254, 240, 138, 0.35)');
    ctx.fillStyle = bellyGrad;
    ctx.fill();

    // Longitudinal Mottled Texture Striations (Iconic Trumpetfish Markings)
    ctx.strokeStyle = 'rgba(113, 63, 18, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // Mid-lateral stripe
    ctx.moveTo(-90 * s, 0.2 * s);
    ctx.bezierCurveTo(-50 * s, -0.5 * s, 0, 0, 80 * s, 0);
    ctx.stroke();

    // Upper lateral stripe
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.25)';
    ctx.beginPath();
    ctx.moveTo(-85 * s, -0.8 * s);
    ctx.bezierCurveTo(-45 * s, -2.5 * s, 0, -3.0 * s, 75 * s, -2.5 * s);
    ctx.stroke();

    // Electric Blue & Violet Facial Streaks along the long tube rostrum
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-92 * s, -0.4 * s);
    ctx.bezierCurveTo(-75 * s, -1.0 * s, -55 * s, -1.8 * s, -38 * s, -2.5 * s);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-88 * s, 0.8 * s);
    ctx.bezierCurveTo(-70 * s, 0.5 * s, -50 * s, 0.8 * s, -36 * s, 1.2 * s);
    ctx.stroke();

    // Fine Silvery Reticulated Bars across torso
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 0.8;
    for (let bx = -10; bx <= 60; bx += 14) {
      ctx.beginPath();
      ctx.moveTo(bx * s, -5.5 * s);
      ctx.lineTo((bx + 2) * s, 5.5 * s);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Soft Low-Poly Facial & Flank Anatomical Facet Planes
   */
  private renderAnatomicalPlanes(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();

    // Rostrum & Cranial Plane Facets
    const planes = [
      // Upper Snout Bridge
      {
        pts: [
          { x: -92 * s, y: -0.8 * s },
          { x: -65 * s, y: -2.0 * s },
          { x: -45 * s, y: -4.0 * s },
          { x: -65 * s, y: -0.5 * s },
        ],
        col: 'rgba(253, 224, 71, 0.25)',
      },
      // Lower Snout Plane
      {
        pts: [
          { x: -90 * s, y: 1.2 * s },
          { x: -65 * s, y: 0.5 * s },
          { x: -45 * s, y: 2.5 * s },
          { x: -65 * s, y: 1.8 * s },
        ],
        col: 'rgba(180, 83, 9, 0.22)',
      },
      // Forehead & Pre-orbital Cheek
      {
        pts: [
          { x: -45 * s, y: -4.0 * s },
          { x: -30 * s, y: -6.0 * s },
          { x: -22 * s, y: -2.0 * s },
          { x: -35 * s, y: 0.5 * s },
        ],
        col: 'rgba(250, 204, 21, 0.2)',
      },
      // Opercular Flap
      {
        pts: [
          { x: -30 * s, y: -2.0 * s },
          { x: -18 * s, y: -1.0 * s },
          { x: -18 * s, y: 4.5 * s },
          { x: -28 * s, y: 3.5 * s },
        ],
        col: 'rgba(202, 138, 4, 0.25)',
      },
    ];

    for (const p of planes) {
      ctx.beginPath();
      ctx.moveTo(p.pts[0].x, p.pts[0].y);
      for (let i = 1; i < p.pts.length; i++) {
        ctx.lineTo(p.pts[i].x, p.pts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = p.col;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Rear Soft Dorsal Fin (Positioned far back at x = 55 to 82)
   */
  private renderRearDorsalFin(ctx: CanvasRenderingContext2D, s: number, flutter: number) {
    ctx.save();
    ctx.translate(68 * s, -6 * s);
    ctx.rotate(flutter * 0.12);

    ctx.beginPath();
    ctx.moveTo(-13 * s, 0);
    // Smooth high undulating dorsal peak
    ctx.bezierCurveTo(-8 * s, -14 * s, 4 * s, -16 * s, 10 * s, -8 * s);
    ctx.bezierCurveTo(12 * s, -4 * s, 14 * s, -1 * s, 14 * s, 0);
    ctx.closePath();

    const finGrad = ctx.createLinearGradient(0, 0, 0, -16 * s);
    finGrad.addColorStop(0.0, 'rgba(202, 138, 4, 0.9)');
    finGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.85)');
    finGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.8)');
    finGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.95)');

    ctx.fillStyle = finGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Delicate radiating fin rays
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.5)';
    ctx.lineWidth = 0.75;
    for (let rx = -10; rx <= 10; rx += 3.5) {
      ctx.beginPath();
      ctx.moveTo(rx * s, 0);
      ctx.lineTo((rx * 0.8 + 2) * s, -12 * s);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Rear Anal Fin (Mirroring dorsal fin on ventral side at x = 55 to 82)
   */
  private renderRearAnalFin(ctx: CanvasRenderingContext2D, s: number, flutter: number) {
    ctx.save();
    ctx.translate(68 * s, 6 * s);
    ctx.rotate(-flutter * 0.12);

    ctx.beginPath();
    ctx.moveTo(-13 * s, 0);
    // Smooth undulating anal fin peak
    ctx.bezierCurveTo(-8 * s, 14 * s, 4 * s, 16 * s, 10 * s, 8 * s);
    ctx.bezierCurveTo(12 * s, 4 * s, 14 * s, 1 * s, 14 * s, 0);
    ctx.closePath();

    const finGrad = ctx.createLinearGradient(0, 0, 0, 16 * s);
    finGrad.addColorStop(0.0, 'rgba(202, 138, 4, 0.9)');
    finGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.85)');
    finGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.8)');
    finGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.95)');

    ctx.fillStyle = finGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Delicate fin rays
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.5)';
    ctx.lineWidth = 0.75;
    for (let rx = -10; rx <= 10; rx += 3.5) {
      ctx.beginPath();
      ctx.moveTo(rx * s, 0);
      ctx.lineTo((rx * 0.8 + 2) * s, 12 * s);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Isolated Dorsal Spinelets along the elongated back (series of tiny low-poly spines)
   */
  private renderDorsalSpinelets(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 0.7;

    for (let sx = -8; sx <= 48; sx += 7) {
      const h = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo((sx - 1.2) * s, -6.6 * s);
      ctx.lineTo((sx + 0.8) * s, -6.6 * s - h);
      ctx.lineTo((sx + 2.2) * s, -6.6 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Slender Caudal Peduncle & Small Rounded Tail Fin with Black Ocellus
   */
  private renderCaudalTailFin(ctx: CanvasRenderingContext2D, s: number, flutter: number) {
    ctx.save();
    ctx.translate(96 * s, 0);
    ctx.rotate(flutter * 0.18);

    // Small rounded paddle caudal fin
    ctx.beginPath();
    ctx.moveTo(0, -1.8 * s);
    ctx.bezierCurveTo(6 * s, -7 * s, 14 * s, -8 * s, 16 * s, -2 * s);
    ctx.bezierCurveTo(17 * s, 0, 17 * s, 2 * s, 16 * s, 4 * s);
    ctx.bezierCurveTo(14 * s, 8 * s, 6 * s, 7 * s, 0, 1.8 * s);
    ctx.closePath();

    const tailGrad = ctx.createLinearGradient(0, 0, 16 * s, 0);
    tailGrad.addColorStop(0.0, '#eab308');
    tailGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.85)');
    tailGrad.addColorStop(0.85, 'rgba(56, 189, 248, 0.75)');
    tailGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.9)');

    ctx.fillStyle = tailGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.8)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // Radiating rays
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 0.7;
    for (let a = -0.4; a <= 0.4; a += 0.16) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 15 * s, Math.sin(a) * 7 * s);
      ctx.stroke();
    }

    // Iconic Black Ocellus (Distinctive spot on tail)
    ctx.beginPath();
    ctx.arc(6 * s, 0, 2.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Ventral Pelvic Fin (Small, slender abdominal fins)
   */
  private renderPelvicFin(ctx: CanvasRenderingContext2D, s: number, flutter: number) {
    ctx.save();
    ctx.translate(12 * s, 6.8 * s);
    ctx.rotate(flutter * 0.15 + 0.2);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(2 * s, 6 * s);
    ctx.lineTo(5 * s, 5 * s);
    ctx.lineTo(2 * s, 0);
    ctx.closePath();

    ctx.fillStyle = 'rgba(234, 179, 8, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Fleshy Chin Barbel at tip of lower jaw
   */
  private renderChinBarbel(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    ctx.translate(-93 * s, 1.6 * s);
    const sway = Math.sin(this.animTime * 2.2) * 0.2;
    ctx.rotate(sway + 0.3);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(0.5 * s, 2.5 * s, 1.2 * s, 4.0 * s, 1.8 * s, 4.8 * s);
    ctx.bezierCurveTo(1.2 * s, 4.0 * s, 0.2 * s, 2.2 * s, -0.6 * s, 0);
    ctx.closePath();

    ctx.fillStyle = '#fde047';
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Pectoral Fin (Near operculum at x = -16)
   */
  private renderPectoralFin(ctx: CanvasRenderingContext2D, s: number, flutter: number) {
    ctx.save();
    ctx.translate(-16 * s, 2 * s);
    ctx.rotate(flutter * 0.25 - 0.1);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(4 * s, -3 * s, 9 * s, -2 * s, 10 * s, 1.5 * s);
    ctx.bezierCurveTo(9 * s, 4 * s, 4 * s, 3.5 * s, 0, 0);
    ctx.closePath();

    const pecGrad = ctx.createLinearGradient(0, 0, 10 * s, 0);
    pecGrad.addColorStop(0.0, 'rgba(234, 179, 8, 0.85)');
    pecGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.7)');
    pecGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.85)');

    ctx.fillStyle = pecGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
    ctx.lineWidth = 0.75;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Small Expressive Golden Eye with Specular Glint
   */
  private renderSmallEye(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    ctx.translate(-36 * s, -3.2 * s);

    // Outer dark bronze ring
    ctx.beginPath();
    ctx.arc(0, 0, 3.4 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();

    // Radiant Golden Amber Iris
    const irisGrad = ctx.createRadialGradient(-0.5 * s, -0.5 * s, 0.4 * s, 0, 0, 3.0 * s);
    irisGrad.addColorStop(0.0, '#fef08a');
    irisGrad.addColorStop(0.5, '#eab308');
    irisGrad.addColorStop(1.0, '#b45309');

    ctx.beginPath();
    ctx.arc(0, 0, 3.0 * s, 0, Math.PI * 2);
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Dark Pupil
    ctx.beginPath();
    ctx.arc(0.2 * s, 0, 1.6 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();

    // Specular Glint
    ctx.beginPath();
    ctx.arc(-0.6 * s, -0.7 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Parasites and removal animations
   */
  private renderParasites(ctx: CanvasRenderingContext2D) {
    const s = this.scale;

    for (const p of this.parasites) {
      const lp = this.getParasiteLocalPos(p);

      if (p.removed) {
        if (p.hoverTimer > 0) {
          ctx.save();
          ctx.translate(lp.x, lp.y);
          drawEatRing(ctx, parasiteUnit(s), p.hoverTimer);
          ctx.restore();
          p.hoverTimer -= 0.02;
        }
        continue;
      }

      ctx.save();
      ctx.translate(lp.x, lp.y);

      // Cleaned progress glow ring
      if (p.hoverTimer > 0) {
        const prog = clamp(p.hoverTimer / (p.type === 'teeth' ? 0.35 : 0.45), 0, 1);
        ctx.beginPath();
        ctx.arc(0, 0, 5.5 * (s / 3.6), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + prog * 0.6})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      drawParasite(ctx, parasiteUnit(s), this.animTime, p.id, p.type === 'teeth');

      ctx.restore();
    }
  }

  /**
   * Perspective Facing Player Render
   */
  private renderFacing(ctx: CanvasRenderingContext2D) {
    const s = this.scale * 0.85;
    const breath = Math.sin(this.breathPhase) * 1.5;

    ctx.save();

    // Facing head on: Slender vertically elongated diamond snout & cranium
    ctx.beginPath();
    ctx.moveTo(0, (-16 + breath * 0.2) * s);
    ctx.bezierCurveTo(8 * s, -10 * s, 10 * s, 4 * s, 6 * s, (14 + breath * 0.4) * s);
    ctx.bezierCurveTo(2 * s, 16 * s, -2 * s, 16 * s, -6 * s, (14 + breath * 0.4) * s);
    ctx.bezierCurveTo(-10 * s, 4 * s, -8 * s, -10 * s, 0, (-16 + breath * 0.2) * s);
    ctx.closePath();

    const faceGrad = ctx.createRadialGradient(0, 0, 2 * s, 0, 0, 15 * s);
    faceGrad.addColorStop(0.0, '#fde047');
    faceGrad.addColorStop(0.6, '#d97706');
    faceGrad.addColorStop(1.0, '#78350f');

    ctx.fillStyle = faceGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Eyes on either side
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 8 * s, -6 * s);

      ctx.beginPath();
      ctx.arc(0, 0, 3.0 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#eab308';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, 1.6 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#09090b';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(-0.5 * s, -0.5 * s, 0.6 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    }

    // Tiny terminal mouth opening at center
    ctx.beginPath();
    ctx.ellipse(0, 6 * s, 2.5 * s, 1.8 * s * this.mouthAperture, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Chin barbel
    ctx.beginPath();
    ctx.moveTo(0, 8.5 * s);
    ctx.lineTo(0.5 * s, 13 * s);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.restore();
  }
}

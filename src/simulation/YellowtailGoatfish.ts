import { Vector2D, Parasite } from '../types';
import { clamp } from '../utils/math';
import { subsampleParasites } from './parasiteFx';
import { ClientFishBase, CleaningTargetSpot } from './ClientFishBase';

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
export class YellowtailGoatfish extends ClientFishBase {
  // Scaled up by 20% (from 2.0 to 2.4)
  public scale: number = 2.4;
  public barbelPhase: number = 0;
  public mouthAperture: number = 0.8;

  protected hitBox = { minX: -45, maxX: 55, minY: -28, maxY: 28 };

  constructor(canvasWidth: number, canvasHeight: number) {
    super();
    // Start offscreen to the right; the director swims the fish in from here
    this.pos = {
      x: canvasWidth + 450,
      y: canvasHeight * 0.48,
    };

    this.initParasites();
    this.parasites = subsampleParasites(this.parasites, 15);
  }

  /**
   * Initialize parasites over the chin barbels, subterminal mouth, and slender body
   */
  protected initParasites() {
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
      { x: -18.0, y: 1.0, part: 'operculum' as const },
      { x: -16.0, y: 4.0, part: 'operculum' as const },
      { x: -13.0, y: -1.0, part: 'operculum' as const },
      { x: -10.0, y: 6.0, part: 'operculum' as const },
      { x: -6.0, y: 2.0, part: 'operculum' as const },
      { x: -8.0, y: 4.0, part: 'operculum' as const },
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

  public update(_w: number, _h: number, dt: number = 1) {
    const safeDt = clamp(dt, 0.2, 2.0);
    this.animTime += 0.03 * safeDt;
    this.breathPhase += 0.035 * safeDt;
    this.finPhase += 0.06 * safeDt;
    this.barbelPhase += 0.045 * safeDt;

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
}

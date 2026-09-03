import { Vector2D, Parasite } from '../types';
import { clamp } from '../utils/math';
import { subsampleParasites } from './parasiteFx';
import { ClientFishBase, CleaningTargetSpot } from './ClientFishBase';

/**
 * Queen Parrotfish (Scarus vetula)
 * "Smooth Low-Poly" Style Guide Implementation:
 * - Deep, oval laterally compressed body with soft anatomical curves
 * - Rounded head, smooth forehead dome, and rounded cheeks
 * - Parrot-like beak with fused enamel dental plates (smooth, non-jagged)
 * - Flowing fins with soft, continuous curved contours (dorsal with orange/yellow band)
 * - Large, gentle body planes with harmonious turquoise, teal, cyan, and emerald gradients
 * - Smooth contrasting yellow/orange facial mask banding
 * - Smooth lunate caudal tail with soft flowing upper & lower lobes
 */
export class QueenParrotfish extends ClientFishBase {
  // Scaled up by 20% (from 3.4 to 4.08)
  public scale: number = 4.08;
  public mouthAperture: number = 0.85; // Rhythmic beak aperture

  protected hitBox = { minX: -45, maxX: 45, minY: -40, maxY: 36 };

  constructor(canvasWidth: number, canvasHeight: number) {
    super();
    // Start offscreen to the right; the director swims the fish in from here
    this.pos = {
      x: canvasWidth + 450,
      y: canvasHeight * 0.48,
    };

    this.initParasites();
    this.parasites = subsampleParasites(this.parasites, 21);
  }

  /**
   * Initialize parasites over the fused beak dental plates and body flanks
   */
  protected initParasites() {
    this.parasites = [];
    let id = 100;

    // 1. Parasites on the upper & lower fused beak dental plates
    const upperBeakCoords = [
      { x: -39.0, y: -4.0 },
      { x: -37.5, y: -3.0 },
      { x: -36.0, y: -4.5 },
      { x: -40.0, y: -5.5 },
      { x: -34.5, y: -3.5 },
      { x: -33.0, y: -2.5 },
      { x: -36.8, y: -3.8 },
      { x: -31.5, y: -3.0 },
      { x: -38.5, y: -5.0 },
      { x: -33.8, y: -4.2 },
      { x: -30.0, y: -2.0 },
      { x: -38.0, y: -3.2 },
      { x: -35.5, y: -2.2 },
      { x: -32.0, y: -3.5 },
    ];

    for (const c of upperBeakCoords) {
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

    const lowerBeakCoords = [
      { x: -40.0, y: 6.5 },
      { x: -38.5, y: 5.0 },
      { x: -37.0, y: 6.2 },
      { x: -41.0, y: 7.5 },
      { x: -35.5, y: 5.2 },
      { x: -34.0, y: 4.0 },
      { x: -37.8, y: 5.5 },
      { x: -32.5, y: 4.5 },
      { x: -39.5, y: 7.0 },
      { x: -34.8, y: 5.8 },
      { x: -31.0, y: 3.5 },
      { x: -38.8, y: 5.2 },
      { x: -36.5, y: 4.2 },
      { x: -33.0, y: 5.5 },
    ];

    for (const c of lowerBeakCoords) {
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

    // 2. Body Parasites across rounded head and deep oval torso
    const headCoords = [
      { x: -36.0, y: -11.0, part: 'body' as const },
      { x: -32.0, y: -15.0, part: 'body' as const },
      { x: -28.0, y: -18.0, part: 'body' as const },
      { x: -24.0, y: -21.0, part: 'body' as const },
      { x: -26.0, y: -12.0, part: 'body' as const },
      { x: -20.0, y: -23.0, part: 'body' as const },
      { x: -16.0, y: -25.0, part: 'body' as const },
      { x: -12.0, y: -26.5, part: 'body' as const },
      { x: -19.0, y: -14.0, part: 'body' as const },
      { x: -15.0, y: -10.0, part: 'body' as const },
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

    // Rounded Cheek & Operculum
    const cheekCoords = [
      { x: -14.0, y: 3.5, part: 'operculum' as const },
      { x: -10.5, y: -1.5, part: 'operculum' as const },
      { x: -6.0, y: -7.0, part: 'operculum' as const },
      { x: -4.0, y: 1.5, part: 'operculum' as const },
      { x: -12.5, y: 7.0, part: 'operculum' as const },
      { x: -8.0, y: 5.0, part: 'operculum' as const },
      { x: -2.5, y: 7.5, part: 'operculum' as const },
      { x: -15.0, y: 9.5, part: 'body' as const },
    ];

    for (const c of cheekCoords) {
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

    // Deep Dorsal Slope
    const dorsalCoords = [
      { x: -3.0, y: -26.0, part: 'body' as const },
      { x: 3.0, y: -27.5, part: 'body' as const },
      { x: 9.0, y: -28.0, part: 'body' as const },
      { x: 15.0, y: -26.5, part: 'body' as const },
      { x: 21.0, y: -25.0, part: 'body' as const },
      { x: 27.0, y: -22.5, part: 'body' as const },
      { x: 33.0, y: -20.0, part: 'body' as const },
      { x: 39.0, y: -17.0, part: 'body' as const },
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

    // Lateral Midline & Oval Torso
    const midTorsoCoords = [
      { x: 0.0, y: -10.0, part: 'body' as const },
      { x: 6.0, y: -7.0, part: 'body' as const },
      { x: 12.0, y: -5.0, part: 'body' as const },
      { x: 18.0, y: -3.0, part: 'body' as const },
      { x: 24.0, y: -5.0, part: 'body' as const },
      { x: 30.0, y: -3.0, part: 'body' as const },
      { x: 36.0, y: -1.0, part: 'body' as const },
      { x: 42.0, y: -2.5, part: 'body' as const },
      { x: 48.0, y: 0.0, part: 'body' as const },
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

    // Smooth Ventral Belly
    const bellyCoords = [
      { x: -2.0, y: 15.0, part: 'belly' as const },
      { x: 4.0, y: 19.5, part: 'belly' as const },
      { x: 10.0, y: 22.0, part: 'belly' as const },
      { x: 16.0, y: 23.0, part: 'belly' as const },
      { x: 22.0, y: 21.0, part: 'belly' as const },
      { x: 28.0, y: 18.5, part: 'belly' as const },
      { x: 34.0, y: 16.0, part: 'belly' as const },
      { x: 40.0, y: 13.0, part: 'belly' as const },
      { x: 46.0, y: 9.5, part: 'body' as const },
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
      lx = (p.localX * s) - (Math.sin(this.breathPhase) * 1.8);
    }

    return { x: lx, y: ly };
  }

  public update(_w: number, _h: number, dt: number = 1) {
    const safeDt = clamp(dt, 0.2, 2.0);
    this.animTime += 0.03 * safeDt;
    this.breathPhase += 0.035 * safeDt;
    this.finPhase += 0.055 * safeDt;

    // Beak aperture flex
    this.mouthAperture = 0.85 + Math.sin(this.breathPhase) * 0.04;
  }

  public getCleaningStationSpots(): CleaningTargetSpot[] {
    const s = this.scale;

    const profBeak: Vector2D = {
      x: this.pos.x - 36 * s,
      y: this.pos.y + 1 * s,
    };
    const profGill: Vector2D = {
      x: this.pos.x - 16 * s,
      y: this.pos.y - 3 * s,
    };
    const profFlank: Vector2D = {
      x: this.pos.x + 8 * s,
      y: this.pos.y - 10 * s,
    };

    return [
      {
        id: 'beak',
        name: 'Fused Beak Dental Plates',
        pos: profBeak,
      },
      {
        id: 'opercular-mask',
        name: 'Opercular Facial Slit',
        pos: profGill,
      },
      {
        id: 'dorsal-flank',
        name: 'Turquoise Dorsal Crest',
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

    this.renderProfile(ctx, s, breath, finFlutter, 1.0);

    ctx.restore();
  }

  // =========================================================================
  // PROFILE VIEW RENDERING (Queen Parrotfish - Scarus vetula)
  // "Smooth Low-Poly" Style:
  // Deep oval body, rounded forehead dome & cheeks, smooth parrot beak with fused
  // enamel plates, flowing dorsal fin with warm orange/yellow band, smooth lunate tail.
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

    // 1. Smooth Flowing Dorsal Fin (Along the back with yellow/orange band and cyan trim)
    this.renderSmoothDorsalFin(ctx, s, finFlutter);

    // 2. Smooth Flowing Anal Fin & Pelvic Fin
    this.renderSmoothAnalFin(ctx, s, finFlutter);
    this.renderSmoothPelvicFin(ctx, s, finFlutter);

    // 3. Smooth Lunate Caudal Tail (Flowing upper & lower lobes)
    this.renderSmoothCaudalFin(ctx, s, finFlutter);

    // 4. Smooth Oral Beak Cavity
    this.renderSmoothBeakCavity(ctx, s);

    // 5. Deep Oval Main Body with Soft Anatomical Planes & Color Gradients
    this.renderSmoothMainBody(ctx, s, breath);

    // 6. Smooth Parrot Beak with Fused Dental Cutting Plates (Non-jagged)
    this.renderSmoothBeakAndPlates(ctx, s);

    // 7. Smooth Contrasting Yellow/Orange/Chartreuse Facial Mask & Markings
    this.renderSmoothFacialMask(ctx, s, breath);

    // 8. Round Expressive Eye
    this.renderSmoothEye(ctx, s);

    // 9. Translucent Smooth Pectoral Fin
    this.renderSmoothPectoralFin(ctx, s, finFlutter);

    // 10. Parasites on Beak & Body
    this.renderParasites(ctx);

    ctx.restore();
  }

  /**
   * Smooth oral cavity interior
   */
  private renderSmoothBeakCavity(ctx: CanvasRenderingContext2D, s: number) {
    const mouthOpen = this.mouthAperture;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-31 * s, -2 * s);
    ctx.quadraticCurveTo(-38 * s, -4 * s, -40 * s, -4 * s);
    ctx.quadraticCurveTo(-32 * s, 1 * s, -26 * s, 1 * s);
    ctx.quadraticCurveTo(-32 * s, 4 * s, -39 * s, 8 * mouthOpen * s);
    ctx.quadraticCurveTo(-36 * s, 8 * mouthOpen * s, -24 * s, 7 * s);
    ctx.closePath();

    const cavityGrad = ctx.createLinearGradient(-40 * s, 0, -24 * s, 0);
    cavityGrad.addColorStop(0, '#021e1e');
    cavityGrad.addColorStop(1, '#042f2e');
    ctx.fillStyle = cavityGrad;
    ctx.fill();
    ctx.restore();
  }

  /**
   * Deep, oval laterally compressed main body with soft geometric planes
   * and smooth curved perimeter contours.
   */
  private renderSmoothMainBody(ctx: CanvasRenderingContext2D, s: number, breath: number) {
    const bShift = breath * 1.5;
    const mouthOpen = this.mouthAperture;

    // 1. Overall Deep Oval Body Silhouette with Smooth Curved Perimeter
    ctx.save();
    ctx.beginPath();
    // Start at upper beak root
    ctx.moveTo(-38 * s, -6 * s);
    // Smooth high forehead dome
    ctx.bezierCurveTo(-35 * s, -16 * s, -25 * s, -25 * s, -10 * s, -29 * s);
    // Deep dorsal arch
    ctx.bezierCurveTo(8 * s, -31 * s, 28 * s, -27 * s, 46 * s, -18 * s);
    // Peduncle top
    ctx.quadraticCurveTo(56 * s, -12 * s, 62 * s, -7 * s);
    // Peduncle rear
    ctx.lineTo(62 * s, 7 * s);
    // Peduncle bottom
    ctx.quadraticCurveTo(56 * s, 11 * s, 44 * s, 16 * s);
    // Deep smooth belly curve
    ctx.bezierCurveTo(26 * s, 24 * s + bShift, 6 * s, 26 * s + bShift, -10 * s, 19 * s + bShift);
    // Rounded throat & chin
    ctx.quadraticCurveTo(-26 * s, 16 * s, -34 * s, 10 * mouthOpen * s);
    // Lower beak root
    ctx.lineTo(-40 * s, 6 * mouthOpen * s);
    // Inside beak shelf
    ctx.quadraticCurveTo(-30 * s, 2 * s, -26 * s, 1 * s);
    ctx.quadraticCurveTo(-32 * s, -2 * s, -38 * s, -6 * s);
    ctx.closePath();

    // Vibrant turquoise to teal background wash
    const bodyGrad = ctx.createLinearGradient(-30 * s, -25 * s, 40 * s, 25 * s);
    bodyGrad.addColorStop(0, '#06b6d4');   // Turquoise cyan
    bodyGrad.addColorStop(0.35, '#0891b2'); // Rich turquoise
    bodyGrad.addColorStop(0.7, '#0f766e');  // Deep teal
    bodyGrad.addColorStop(1, '#042f2e');   // Dark ocean teal
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.restore();

    // 2. Soft Anatomical Planes (Smooth Low-Poly Character)
    // Head Dome / Forehead (Soft turquoise-cyan plane)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-38 * s, -6 * s);
    ctx.quadraticCurveTo(-28 * s, -18 * s, -10 * s, -29 * s);
    ctx.quadraticCurveTo(-14 * s, -12 * s, -20 * s, -4 * s);
    ctx.quadraticCurveTo(-30 * s, -3 * s, -38 * s, -6 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(34, 211, 238, 0.45)'; // Bright cyan forehead highlight
    ctx.fill();
    ctx.restore();

    // Upper Dorsal Flank (Rich teal-emerald slope)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-10 * s, -29 * s);
    ctx.bezierCurveTo(8 * s, -31 * s, 28 * s, -27 * s, 46 * s, -18 * s);
    ctx.quadraticCurveTo(24 * s, -12 * s, 4 * s, -12 * s);
    ctx.quadraticCurveTo(-8 * s, -18 * s, -10 * s, -29 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 118, 110, 0.55)';
    ctx.fill();
    ctx.restore();

    // Mid-Torso Lateral Shimmer Plane (Vibrant emerald / seafoam green wash)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-16 * s, -6 * s);
    ctx.quadraticCurveTo(8 * s, -12 * s, 36 * s, -8 * s);
    ctx.quadraticCurveTo(48 * s, 0, 36 * s, 10 * s);
    ctx.quadraticCurveTo(12 * s, 12 * s, -12 * s, 8 * s);
    ctx.quadraticCurveTo(-4 * s, 0, -16 * s, -6 * s);
    ctx.closePath();

    const midGrad = ctx.createRadialGradient(10 * s, 0, 4 * s, 10 * s, 0, 32 * s);
    midGrad.addColorStop(0, 'rgba(45, 212, 191, 0.7)');  // Seafoam cyan
    midGrad.addColorStop(0.6, 'rgba(16, 185, 129, 0.4)'); // Emerald green
    midGrad.addColorStop(1, 'rgba(8, 145, 178, 0.1)');
    ctx.fillStyle = midGrad;
    ctx.fill();
    ctx.restore();

    // Soft Oval Belly Plane
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-10 * s, 19 * s + bShift);
    ctx.bezierCurveTo(6 * s, 26 * s + bShift, 26 * s, 24 * s + bShift, 44 * s, 16 * s);
    ctx.quadraticCurveTo(24 * s, 10 * s, 4 * s, 8 * s);
    ctx.quadraticCurveTo(-8 * s, 12 * s, -10 * s, 19 * s + bShift);
    ctx.closePath();

    const bellyGrad = ctx.createLinearGradient(0, 8 * s, 0, 26 * s);
    bellyGrad.addColorStop(0, 'rgba(6, 182, 212, 0.3)');
    bellyGrad.addColorStop(1, 'rgba(103, 232, 249, 0.65)'); // Lighter turquoise belly
    ctx.fillStyle = bellyGrad;
    ctx.fill();
    ctx.restore();

    // Peduncle Soft Transition Plane
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(46 * s, -18 * s);
    ctx.quadraticCurveTo(56 * s, -12 * s, 62 * s, -7 * s);
    ctx.lineTo(62 * s, 7 * s);
    ctx.quadraticCurveTo(56 * s, 11 * s, 44 * s, 16 * s);
    ctx.quadraticCurveTo(40 * s, 0, 46 * s, -18 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(13, 148, 136, 0.45)';
    ctx.fill();
    ctx.restore();

    // Subtle, soft polygonal facet lines to maintain stylized low-poly character with rounded feel
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.9;

    ctx.beginPath();
    // Forehead to mid-flank
    ctx.moveTo(-20 * s, -22 * s);
    ctx.quadraticCurveTo(-6 * s, -12 * s, 8 * s, -12 * s);
    // Dorsal arch to mid
    ctx.moveTo(8 * s, -30 * s);
    ctx.lineTo(16 * s, -10 * s);
    ctx.lineTo(28 * s, -26 * s);
    ctx.lineTo(34 * s, -6 * s);
    ctx.lineTo(46 * s, -18 * s);
    // Mid to belly
    ctx.moveTo(-2 * s, 6 * s);
    ctx.lineTo(12 * s, 22 * s + bShift);
    ctx.lineTo(24 * s, 6 * s);
    ctx.lineTo(36 * s, 18 * s);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Smooth Parrot-like Beak with Fused Enamel Dental Plates
   * Non-jagged, rounded anatomical contours with smooth fused plates.
   */
  private renderSmoothBeakAndPlates(ctx: CanvasRenderingContext2D, s: number) {
    const mouthOpen = this.mouthAperture;

    // 1. Upper Beak (Parrot beak curvature - smooth rounded beak nose)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-28 * s, -8 * s);
    ctx.quadraticCurveTo(-34 * s, -12 * s, -39 * s, -6 * s);
    // Smooth curved beak cutting edge
    ctx.quadraticCurveTo(-41 * s, -3 * s, -33 * s, -1 * s);
    ctx.quadraticCurveTo(-28 * s, -3 * s, -28 * s, -8 * s);
    ctx.closePath();

    const upperBeakGrad = ctx.createLinearGradient(-39 * s, -10 * s, -30 * s, 0);
    upperBeakGrad.addColorStop(0, '#14b8a6'); // Teal/turquoise enamel
    upperBeakGrad.addColorStop(1, '#06b6d4');
    ctx.fillStyle = upperBeakGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();

    // Upper Fused Dental Plates (Smooth rounded enamel tiles along beak rim)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-39 * s, -5.5 * s);
    ctx.quadraticCurveTo(-40.5 * s, -3 * s, -33 * s, -1.2 * s);
    ctx.lineTo(-33 * s, -3 * s);
    ctx.quadraticCurveTo(-38 * s, -4.5 * s, -39 * s, -5.5 * s);
    ctx.closePath();
    ctx.fillStyle = '#ccfbf1'; // Ivory enamel
    ctx.fill();

    // Subtle fused plate segment dividers
    ctx.strokeStyle = 'rgba(15, 118, 110, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-37.5 * s, -4.5 * s); ctx.lineTo(-37 * s, -2.5 * s);
    ctx.moveTo(-35.5 * s, -3.8 * s); ctx.lineTo(-35 * s, -1.8 * s);
    ctx.stroke();
    ctx.restore();

    // 2. Lower Beak (Smooth rounded parrot mandible)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-24 * s, 9 * s);
    ctx.quadraticCurveTo(-32 * s, 14 * mouthOpen * s, -40.5 * s, 7.5 * mouthOpen * s);
    // Smooth lower cutting edge
    ctx.quadraticCurveTo(-34 * s, 2.5 * mouthOpen * s, -26 * s, 3 * mouthOpen * s);
    ctx.closePath();

    const lowerBeakGrad = ctx.createLinearGradient(-40 * s, 12 * s, -26 * s, 2 * s);
    lowerBeakGrad.addColorStop(0, '#0d9488');
    lowerBeakGrad.addColorStop(1, '#14b8a6');
    ctx.fillStyle = lowerBeakGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();

    // Lower Fused Dental Plates
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-40 * s, 7 * mouthOpen * s);
    ctx.quadraticCurveTo(-34 * s, 2.5 * mouthOpen * s, -26.5 * s, 3 * mouthOpen * s);
    ctx.lineTo(-27 * s, 5 * mouthOpen * s);
    ctx.quadraticCurveTo(-34 * s, 4.5 * mouthOpen * s, -39 * s, 8 * mouthOpen * s);
    ctx.closePath();
    ctx.fillStyle = '#ccfbf1';
    ctx.fill();

    ctx.strokeStyle = 'rgba(13, 148, 136, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-37 * s, 5.8 * mouthOpen * s); ctx.lineTo(-36.5 * s, 3.8 * mouthOpen * s);
    ctx.moveTo(-34.5 * s, 4.8 * mouthOpen * s); ctx.lineTo(-34 * s, 2.8 * mouthOpen * s);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Smooth Contrasting Yellow/Orange/Chartreuse Facial Mask & Markings
   * Smooth curves sweeping around the eye and across the rounded cheeks.
   */
  private renderSmoothFacialMask(ctx: CanvasRenderingContext2D, s: number, breath: number) {
    const flare = breath * 1.8;

    // 1. Smooth Orange/Yellow Orbital Band (Encircling eye and sweeping backward)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-34 * s, -12 * s);
    ctx.quadraticCurveTo(-26 * s, -20 * s, -16 * s, -16 * s);
    ctx.quadraticCurveTo(-10 * s, -12 * s, -6 * s, -14 * s);
    ctx.quadraticCurveTo(-12 * s, -8 * s, -18 * s, -9 * s);
    ctx.quadraticCurveTo(-24 * s, -6 * s, -34 * s, -12 * s);
    ctx.closePath();

    const bandGrad1 = ctx.createLinearGradient(-34 * s, -18 * s, -6 * s, -8 * s);
    bandGrad1.addColorStop(0, '#f97316'); // Vibrant orange
    bandGrad1.addColorStop(0.5, '#facc15'); // Golden yellow
    bandGrad1.addColorStop(1, '#84cc16'); // Yellow-green chartreuse
    ctx.fillStyle = bandGrad1;
    ctx.fill();
    ctx.restore();

    // 2. Smooth Suborbital / Cheek Orange Crescent Band (Under eye sweeping to operculum)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-34 * s, -4 * s);
    ctx.quadraticCurveTo(-24 * s, 0, -14 * s, 2 * s);
    ctx.quadraticCurveTo(-6 * s, 6 * s, -2 * s, 10 * s);
    ctx.quadraticCurveTo(-10 * s, 12 * s, -18 * s, 8 * s);
    ctx.quadraticCurveTo(-26 * s, 4 * s, -34 * s, -4 * s);
    ctx.closePath();

    const bandGrad2 = ctx.createLinearGradient(-34 * s, -4 * s, -2 * s, 10 * s);
    bandGrad2.addColorStop(0, '#ea580c');
    bandGrad2.addColorStop(0.6, '#f97316');
    bandGrad2.addColorStop(1, '#facc15');
    ctx.fillStyle = bandGrad2;
    ctx.fill();
    ctx.restore();

    // 3. Rounded Opercular Flap (Smooth curved gill margin with cyan & yellow badge)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-8 * s - flare, -15 * s);
    ctx.quadraticCurveTo(-2 * s - flare, -2 * s, -4 * s - flare, 12 * s);
    ctx.quadraticCurveTo(-12 * s, 6 * s, -14 * s, -4 * s);
    ctx.closePath();

    const opGrad = ctx.createLinearGradient(-14 * s, -10 * s, -2 * s, 8 * s);
    opGrad.addColorStop(0, '#06b6d4');
    opGrad.addColorStop(0.7, '#0891b2');
    opGrad.addColorStop(1, '#f97316'); // Warm orange rim
    ctx.fillStyle = opGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Round, vibrant tropical eye
   */
  private renderSmoothEye(ctx: CanvasRenderingContext2D, s: number) {
    const eyeX = -24 * s;
    const eyeY = -12 * s;
    const eyeRadius = 5.4 * s;

    ctx.save();
    // Orange/Coral outer ring
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius + 1.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();

    // Golden Yellow Iris with Chartreuse Inner Ring
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(eyeX, eyeY, 1 * s, eyeX, eyeY, eyeRadius);
    irisGrad.addColorStop(0, '#facc15');
    irisGrad.addColorStop(0.7, '#eab308');
    irisGrad.addColorStop(1, '#84cc16');
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Deep Pupil
    ctx.beginPath();
    ctx.arc(eyeX - 0.3 * s, eyeY, eyeRadius * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = '#021e1e';
    ctx.fill();

    // Crisp Specular Highlights
    ctx.beginPath();
    ctx.arc(eyeX - 1.5 * s, eyeY - 1.5 * s, 1.7 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(eyeX + 1.2 * s, eyeY + 1.2 * s, 0.8 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Smooth Flowing Dorsal Fin (Along the entire back with smooth continuous curves,
   * vibrant orange/yellow central submarginal gradient, and cyan outer edge).
   */
  private renderSmoothDorsalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 2.0;

    ctx.save();
    ctx.beginPath();
    // Root along the dorsal spine
    ctx.moveTo(-10 * s, -29 * s);
    ctx.quadraticCurveTo(8 * s, -31 * s, 26 * s, -28 * s);
    ctx.quadraticCurveTo(38 * s, -24 * s, 48 * s, -17 * s);

    // Smooth flowing trailing edge & top curve
    ctx.bezierCurveTo(46 * s, -28 * s + wave * 0.8, 36 * s, -38 * s + wave, 24 * s, -40 * s + wave * 0.7);
    ctx.bezierCurveTo(12 * s, -41 * s + wave * 0.5, 0, -38 * s + wave * 0.3, -8 * s, -33 * s + wave * 0.2);
    ctx.closePath();

    // Smooth gradient: Turquoise base -> Vibrant Orange/Yellow band -> Cyan/Blue outer rim
    const finGrad = ctx.createLinearGradient(15 * s, -28 * s, 15 * s, -41 * s);
    finGrad.addColorStop(0, '#0f766e');    // Teal base
    finGrad.addColorStop(0.3, '#0891b2');  // Turquoise mid
    finGrad.addColorStop(0.65, '#f97316'); // Bright Orange submarginal band
    finGrad.addColorStop(0.85, '#facc15'); // Golden Yellow band
    finGrad.addColorStop(1, '#38bdf8');    // Electric Blue/Cyan tip
    ctx.fillStyle = finGrad;
    ctx.fill();

    // Smooth outer glow stroke
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Smooth Flowing Anal Fin
   */
  private renderSmoothAnalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.8;

    ctx.save();
    ctx.beginPath();
    // Root along ventral rear
    ctx.moveTo(26 * s, 22 * s);
    ctx.quadraticCurveTo(38 * s, 16 * s, 50 * s, 11 * s);
    // Smooth flowing trailing edge
    ctx.bezierCurveTo(48 * s, 24 * s + wave * 0.8, 38 * s, 30 * s + wave, 28 * s, 26 * s + wave * 0.5);
    ctx.closePath();

    const analGrad = ctx.createLinearGradient(35 * s, 14 * s, 35 * s, 30 * s);
    analGrad.addColorStop(0, '#0f766e');
    analGrad.addColorStop(0.4, '#0891b2');
    analGrad.addColorStop(0.7, '#f97316'); // Orange band
    analGrad.addColorStop(1, '#38bdf8');   // Cyan trim
    ctx.fillStyle = analGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Smooth Pelvic Fin
   */
  private renderSmoothPelvicFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 1.4;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 24 * s);
    ctx.quadraticCurveTo(8 * s, 24 * s, 12 * s, 22 * s);
    ctx.quadraticCurveTo(6 * s, 34 * s + wave, 2 * s, 32 * s + wave);
    ctx.closePath();

    const pelvGrad = ctx.createLinearGradient(4 * s, 22 * s, 4 * s, 34 * s);
    pelvGrad.addColorStop(0, '#0891b2');
    pelvGrad.addColorStop(0.6, '#f97316');
    pelvGrad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = pelvGrad;
    ctx.fill();
    ctx.restore();
  }

  /**
   * Smooth Lunate Caudal Tail (Flowing upper & lower lobes, soft lunate crescent)
   */
  private renderSmoothCaudalFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const wave = finFlutter * 3.2;

    ctx.save();
    ctx.beginPath();
    // Peduncle root
    ctx.moveTo(62 * s, -7 * s);
    // Smooth flowing upper filament lobe
    ctx.bezierCurveTo(72 * s, -14 * s + wave * 0.5, 84 * s, -24 * s + wave * 0.8, 98 * s, -22 * s + wave);
    // Smooth lunate crescent trailing inner edge
    ctx.bezierCurveTo(88 * s, -8 * s + wave * 0.7, 85 * s, 0 + wave * 0.6, 88 * s, 8 * s + wave * 0.7);
    // Smooth lower filament lobe
    ctx.bezierCurveTo(84 * s, 24 * s + wave * 0.8, 72 * s, 14 * s + wave * 0.5, 62 * s, 7 * s);
    ctx.closePath();

    // Vibrant teal & turquoise with warm orange/yellow crescent
    const tailGrad = ctx.createLinearGradient(62 * s, 0, 95 * s, 0);
    tailGrad.addColorStop(0, '#0891b2');
    tailGrad.addColorStop(0.4, '#06b6d4');
    tailGrad.addColorStop(0.75, '#f97316'); // Warm orange interior crescent
    tailGrad.addColorStop(0.9, '#facc15');  // Yellow highlight
    tailGrad.addColorStop(1, '#38bdf8');    // Cyan ribbon tips
    ctx.fillStyle = tailGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Translucent Smooth Labriform Pectoral Fin (Soft rounded paddle fan)
   */
  private renderSmoothPectoralFin(ctx: CanvasRenderingContext2D, s: number, finFlutter: number) {
    const scullAngle = finFlutter * 0.35;

    ctx.save();
    const rootX = 2 * s;
    const rootY = 3 * s;
    ctx.translate(rootX, rootY);
    ctx.rotate(scullAngle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(10 * s, -12 * s, 22 * s, -10 * s, 26 * s, -2 * s);
    ctx.bezierCurveTo(28 * s, 6 * s, 20 * s, 16 * s, 8 * s, 14 * s);
    ctx.closePath();

    const pecGrad = ctx.createLinearGradient(0, 0, 26 * s, 4 * s);
    pecGrad.addColorStop(0, 'rgba(8, 145, 178, 0.75)');
    pecGrad.addColorStop(0.4, 'rgba(34, 197, 94, 0.85)'); // Green mid
    pecGrad.addColorStop(0.75, 'rgba(249, 115, 22, 0.8)'); // Orange fan
    pecGrad.addColorStop(1, 'rgba(56, 189, 248, 0.85)');  // Cyan rim
    ctx.fillStyle = pecGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }
}

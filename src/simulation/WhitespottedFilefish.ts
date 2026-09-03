import { Vector2D, Parasite } from '../types';
import { lerp } from '../utils/math';
import { subsampleParasites } from './parasiteFx';
import { ClientFishBase, CleaningTargetSpot } from './ClientFishBase';

/**
 * Whitespotted Filefish (Cantherhines macrocerus)
 *
 * Visual & Anatomical Design:
 * - Size: ~25–35 cm (scale ~4.8)
 * - Deep-bodied, laterally compressed, oval silhouette with steep dorsal crest & ventral keel flap
 * - Rough, leathery sandpaper-like skin texture rendered with nuanced slate-gray and rich earth-brown gradients
 * - Hundreds of crisp, scattered pearlescent white spots across the flanks, head, and caudal peduncle
 * - Small terminal mouth with tiny chisel-like incisor teeth
 * - Prominent tall erectable first dorsal spine located over the eye with locking spike and membrane
 * - Small, delicate, rapidly fluttering pectoral fins
 * - High soft dorsal and anal fins set far back with rhythmic undulation
 * - Rounded fan-shaped caudal fin with robust peduncle spines
 * - Complete parasite cleaning network across chisel teeth, dorsal spine, flanks, and pelvic keel
 */
export class WhitespottedFilefish extends ClientFishBase {
  // Scaled up by 20% (from 2.0 to 2.4)
  public scale: number = 2.4;
  public spinePhase: number = 0;
  public mouthAperture: number = 0.7; // Small mouth rhythmic aperture

  // White spot coordinates (relative to fish local origin)
  private whiteSpots: { x: number; y: number; r: number; alpha: number }[] = [];

  constructor(canvasWidth: number, canvasHeight: number) {
    super();
    // Start offscreen to the right; the director swims the fish in from here
    this.pos = {
      x: canvasWidth + 420,
      y: canvasHeight * 0.47,
    };

    this.initWhiteSpots();
    this.initParasites();
    this.parasites = subsampleParasites(this.parasites, 15);
  }

  /**
   * Pre-generate the characteristic numerous white spots of Cantherhines macrocerus
   */
  private initWhiteSpots() {
    this.whiteSpots = [];
    
    // Deterministic random generator for consistent spots
    let seed = 42;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Body flank area bounding polygon check
    for (let i = 0; i < 140; i++) {
      const rx = -32 + seededRandom() * 72; // -32 to +40
      const ry = -22 + seededRandom() * 46; // -22 to +24

      // Filter to approximate the deep-bodied oval filefish silhouette
      const normX = (rx - 4) / 38;
      const normY = ry / 24;
      if (normX * normX + normY * normY <= 1.05) {
        // Exclude eye region
        const eyeDist = Math.hypot(rx - (-22), ry - (-8));
        if (eyeDist > 4.5) {
          const r = 0.7 + seededRandom() * 1.3;
          const alpha = 0.75 + seededRandom() * 0.25;
          this.whiteSpots.push({ x: rx, y: ry, r, alpha });
        }
      }
    }

    // Additional spots on caudal peduncle and base of dorsal/anal fins
    for (let i = 0; i < 30; i++) {
      const px = 34 + seededRandom() * 22;
      const py = -10 + seededRandom() * 20;
      const r = 0.6 + seededRandom() * 1.0;
      const alpha = 0.65 + seededRandom() * 0.35;
      this.whiteSpots.push({ x: px, y: py, r, alpha });
    }
  }

  /**
   * Initialize parasites over the small chisel teeth, tall dorsal spine, and rough leathery flank
   */
  protected initParasites() {
    this.parasites = [];
    let id = 400;

    // 1. Parasites on small chisel-beak mouth
    const mouthCoords = [
      { x: -36.0, y: 1.5, type: 'teeth' as const, part: 'upperTeeth' as const },
      { x: -34.5, y: 0.5, type: 'teeth' as const, part: 'upperTeeth' as const },
      { x: -37.2, y: 2.5, type: 'teeth' as const, part: 'upperTeeth' as const },
      { x: -35.5, y: -0.5, type: 'teeth' as const, part: 'upperTeeth' as const },
      { x: -33.5, y: 1.0, type: 'teeth' as const, part: 'upperTeeth' as const },
      { x: -35.2, y: 3.8, type: 'teeth' as const, part: 'lowerTeeth' as const },
      { x: -36.8, y: 4.5, type: 'teeth' as const, part: 'lowerTeeth' as const },
      { x: -33.8, y: 3.2, type: 'teeth' as const, part: 'lowerTeeth' as const },
      { x: -34.8, y: 5.2, type: 'teeth' as const, part: 'lowerTeeth' as const },
      { x: -32.5, y: 4.0, type: 'teeth' as const, part: 'lowerTeeth' as const },
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

    // 2. Parasites around the tall dorsal spine
    const spineCoords = [
      { x: -21.0, y: -26.0 },
      { x: -19.5, y: -31.0 },
      { x: -18.0, y: -36.0 },
      { x: -22.5, y: -21.0 },
      { x: -16.5, y: -24.0 },
    ];

    for (const c of spineCoords) {
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

    // 3. Parasites along the rough leathery head, operculum & steep forehead
    const headCoords = [
      { x: -30.0, y: -5.0, part: 'body' as const },
      { x: -26.0, y: -12.0, part: 'body' as const },
      { x: -23.0, y: -18.0, part: 'body' as const },
      { x: -18.0, y: -2.0, part: 'operculum' as const },
      { x: -15.0, y: -4.0, part: 'operculum' as const },
      { x: -12.0, y: 2.0, part: 'operculum' as const },
      { x: -14.0, y: 4.5, part: 'operculum' as const },
      { x: -18.0, y: 6.0, part: 'operculum' as const },
      { x: -10.0, y: 0.5, part: 'operculum' as const },
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

    // 4. Parasites on deep flank & leathery body
    const flankCoords = [
      { x: -6.0, y: -16.0 },
      { x: 2.0, y: -18.0 },
      { x: 10.0, y: -17.0 },
      { x: 18.0, y: -14.0 },
      { x: -4.0, y: -6.0 },
      { x: 4.0, y: -4.0 },
      { x: 12.0, y: -2.0 },
      { x: 20.0, y: 0.0 },
      { x: -2.0, y: 6.0 },
      { x: 6.0, y: 8.0 },
      { x: 14.0, y: 9.0 },
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

    // 5. Parasites on ventral keel flap and pelvic spine
    const pelvicCoords = [
      { x: -10.0, y: 15.0 },
      { x: -2.0, y: 20.0 },
      { x: 6.0, y: 22.0 },
      { x: 14.0, y: 18.0 },
      { x: 22.0, y: 14.0 },
    ];

    for (const c of pelvicCoords) {
      this.parasites.push({
        id: id++,
        type: 'body',
        localX: c.x,
        localY: c.y,
        attachPart: 'belly',
        hoverTimer: 0,
        removed: false,
      });
    }

    // 6. Parasites on caudal peduncle
    const peduncleCoords = [
      { x: 28.0, y: -6.0 },
      { x: 34.0, y: -2.0 },
      { x: 38.0, y: 3.0 },
      { x: 32.0, y: 6.0 },
    ];

    for (const c of peduncleCoords) {
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
      ly = (p.localY * s) + Math.sin(this.breathPhase) * 1.3;
    } else if (p.attachPart === 'operculum') {
      lx = (p.localX * s) - Math.sin(this.breathPhase) * 1.5;
    }

    return { x: lx, y: ly };
  }

  public hitTest(pos: Vector2D): boolean {
    if (this.state === 'exited' || !this.isVisible) return false;
    const dx = pos.x - this.pos.x;
    const dy = pos.y - this.pos.y;
    const r = 100 * (this.scale / 4.8);
    return dx * dx + dy * dy < r * r;
  }

  public getCleaningStationSpots(): CleaningTargetSpot[] {
    const s = this.scale;
    const spots: CleaningTargetSpot[] = [];

    // Profile spots
    spots.push(
      {
        id: 'filefish-mouth',
        name: 'Chisel-Beak Mouth',
        pos: { x: this.pos.x - 36 * s, y: this.pos.y + 2.5 * s },
      },
      {
        id: 'filefish-spine',
        name: 'Tall Dorsal Spine',
        pos: { x: this.pos.x - 19 * s, y: this.pos.y - 29 * s },
      },
      {
        id: 'filefish-flank',
        name: 'Rough Leathery Flank',
        pos: { x: this.pos.x + 4 * s, y: this.pos.y - 2 * s },
      },
      {
        id: 'filefish-keel',
        name: 'Ventral Dewlap Keel',
        pos: { x: this.pos.x + 3 * s, y: this.pos.y + 19 * s },
      },
      {
        id: 'filefish-peduncle',
        name: 'Caudal Peduncle Spines',
        pos: { x: this.pos.x + 35 * s, y: this.pos.y },
      }
    );

    return spots;
  }

  public update(_w: number, _h: number, dt: number) {
    this.animTime += dt * 0.035;
    this.breathPhase += dt * 0.045;
    this.finPhase += dt * 0.16; // Rapid flutter characteristic of filefish fins
    this.spinePhase += dt * 0.03;

    // Small mouth subtle rhythmic pulsing
    this.mouthAperture = 0.65 + Math.sin(this.breathPhase * 1.5) * 0.25;
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
   * Anatomical deep-bodied filefish silhouette with rough skin texture,
   * tall dorsal spine, small mouth, white spots, and delicate fins.
   */
  private renderProfile(ctx: CanvasRenderingContext2D) {
    const s = this.scale;
    const spineFlex = Math.sin(this.spinePhase) * 0.06;
    const breathOffset = Math.sin(this.breathPhase) * 1.5;
    const finWave = Math.sin(this.finPhase);

    // 1. Soft Dorsal Fin (Rear upper edge)
    this.renderSoftDorsal(ctx, s, finWave);

    // 2. Anal Fin (Rear lower edge)
    this.renderAnalFin(ctx, s, finWave);

    // 3. Caudal Fin (Fan-shaped tail with peduncle spines)
    this.renderCaudalFin(ctx, s, finWave);

    // 4. Main Leathery Body (Charcoal slate-gray / rich earthy brown with rough texture)
    this.renderMainBodyProfile(ctx, s, breathOffset);

    // 5. Leathery Rough Texture Cross-Hatching & Stippling
    this.renderRoughSkinTexture(ctx, s);

    // 6. Pearlescent White Spot Field
    this.renderWhiteSpotsField(ctx, s);

    // 7. Tall First Dorsal Spine (Above the eye with locking spinelet)
    this.renderTallDorsalSpine(ctx, s, spineFlex);

    // 8. Small Chisel Mouth & Lips
    this.renderSmallMouth(ctx, s);

    // 9. Eye & Orbital Rims
    this.renderEye(ctx, s);

    // 10. Small, Rapid Fluttering Pectoral Fin
    this.renderPectoralFin(ctx, s, finWave);

    // 11. Parasites & Host Station Highlight Markers
    this.renderParasites(ctx);
  }

  /**
   * Soft Dorsal Fin: Set far back, translucent amber/pale with undulating soft rays
   */
  private renderSoftDorsal(ctx: CanvasRenderingContext2D, s: number, finWave: number) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(12 * s, -20 * s);
    // Cresting top edge
    ctx.bezierCurveTo(
      20 * s, -34 * s + finWave * 3,
      36 * s, -32 * s - finWave * 3,
      44 * s, -14 * s
    );
    ctx.lineTo(40 * s, -12 * s);
    ctx.closePath();

    const grad = ctx.createLinearGradient(12 * s, -30 * s, 44 * s, -14 * s);
    grad.addColorStop(0, 'rgba(215, 175, 110, 0.75)');
    grad.addColorStop(0.5, 'rgba(160, 130, 85, 0.55)');
    grad.addColorStop(1, 'rgba(100, 85, 65, 0.35)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(235, 195, 130, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Delicate soft rays
    ctx.strokeStyle = 'rgba(255, 235, 190, 0.35)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const rx = lerp(15 * s, 42 * s, t);
      const ry1 = lerp(-20 * s, -13 * s, t);
      const ry2 = lerp(-31 * s + Math.sin(this.finPhase + i) * 2, -18 * s, t);
      ctx.beginPath();
      ctx.moveTo(rx, ry1);
      ctx.lineTo(rx + 2 * s, ry2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Anal Fin: Mirrors dorsal fin along bottom rear edge
   */
  private renderAnalFin(ctx: CanvasRenderingContext2D, s: number, finWave: number) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(16 * s, 18 * s);
    ctx.bezierCurveTo(
      24 * s, 32 * s - finWave * 3,
      38 * s, 28 * s + finWave * 3,
      44 * s, 12 * s
    );
    ctx.lineTo(40 * s, 10 * s);
    ctx.closePath();

    const grad = ctx.createLinearGradient(16 * s, 28 * s, 44 * s, 12 * s);
    grad.addColorStop(0, 'rgba(215, 175, 110, 0.75)');
    grad.addColorStop(0.5, 'rgba(160, 130, 85, 0.55)');
    grad.addColorStop(1, 'rgba(100, 85, 65, 0.35)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(235, 195, 130, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 235, 190, 0.35)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const rx = lerp(19 * s, 41 * s, t);
      const ry1 = lerp(18 * s, 11 * s, t);
      const ry2 = lerp(29 * s - Math.sin(this.finPhase + i) * 2, 16 * s, t);
      ctx.beginPath();
      ctx.moveTo(rx, ry1);
      ctx.lineTo(rx + 2 * s, ry2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Caudal Fin: Rounded fan-like tail with dark marginal bands and strong peduncle spines
   */
  private renderCaudalFin(ctx: CanvasRenderingContext2D, s: number, _finWave: number) {
    ctx.save();
    const sway = Math.sin(this.animTime * 1.5) * 3;

    ctx.beginPath();
    ctx.moveTo(44 * s, -11 * s);
    ctx.bezierCurveTo(
      56 * s, -18 * s + sway,
      68 * s, -12 * s + sway,
      70 * s, 0 + sway
    );
    ctx.bezierCurveTo(
      68 * s, 12 * s + sway,
      56 * s, 18 * s + sway,
      44 * s, 11 * s
    );
    ctx.closePath();

    const grad = ctx.createRadialGradient(44 * s, 0, 5 * s, 65 * s, sway, 35 * s);
    grad.addColorStop(0, '#5a4d3f');
    grad.addColorStop(0.5, '#7a6852');
    grad.addColorStop(0.85, '#3e3428');
    grad.addColorStop(1, '#241f18');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 170, 130, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Caudal fin rays
    ctx.strokeStyle = 'rgba(220, 190, 150, 0.3)';
    ctx.lineWidth = 0.9;
    for (let i = -4; i <= 4; i++) {
      const ty = (i / 4) * 10 * s;
      const ey = (i / 4) * 15 * s + sway;
      ctx.beginPath();
      ctx.moveTo(44 * s, ty * 0.7);
      ctx.lineTo(67 * s, ey);
      ctx.stroke();
    }

    // Prominent peduncular spines characteristic of Cantherhines macrocerus (orange/amber spines)
    ctx.fillStyle = '#ff9d3b';
    ctx.beginPath();
    ctx.moveTo(38 * s, -4 * s);
    ctx.lineTo(44 * s, -5.5 * s);
    ctx.lineTo(40 * s, -2.5 * s);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(38 * s, 3 * s);
    ctx.lineTo(44 * s, 4.5 * s);
    ctx.lineTo(40 * s, 1.5 * s);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Main Leathery Body Profile:
   * Deep-bodied, steep sloping forehead, ventral dewlap flap, charcoal-gray/earth-brown ground
   */
  private renderMainBodyProfile(ctx: CanvasRenderingContext2D, s: number, breathOffset: number) {
    ctx.save();

    // Filefish anatomical contour
    ctx.beginPath();
    // Start at small terminal snout
    ctx.moveTo(-36 * s, 1.5 * s);
    // Steep sloping forehead up toward dorsal spine base
    ctx.bezierCurveTo(
      -32 * s, -10 * s,
      -26 * s, -18 * s,
      -20 * s, -23 * s
    );
    // High dorsal crest
    ctx.bezierCurveTo(
      -10 * s, -25 * s,
      5 * s, -24 * s,
      16 * s, -19 * s
    );
    // Down to caudal peduncle top
    ctx.bezierCurveTo(
      28 * s, -14 * s,
      38 * s, -10 * s,
      44 * s, -10 * s
    );
    // Caudal peduncle rear edge
    ctx.lineTo(44 * s, 10 * s);
    // Ventral edge forward
    ctx.bezierCurveTo(
      38 * s, 10 * s,
      28 * s, 14 * s,
      18 * s, 18 * s
    );
    // Ventral pelvic dewlap keel (prominent in filefishes)
    ctx.bezierCurveTo(
      8 * s, 23 * s + breathOffset,
      -8 * s, 21 * s + breathOffset,
      -18 * s, 14 * s
    );
    // Chin and throat to lower mouth
    ctx.bezierCurveTo(
      -26 * s, 10 * s,
      -33 * s, 6 * s,
      -36 * s, 3.5 * s
    );
    ctx.closePath();

    // Base color gradient: Slate-gray upper back to earthy umber/olive flanks
    const bodyGrad = ctx.createLinearGradient(-30 * s, -25 * s, 30 * s, 20 * s);
    bodyGrad.addColorStop(0, '#4a535b'); // Slate gray
    bodyGrad.addColorStop(0.3, '#5c584f'); // Muted olive-slate
    bodyGrad.addColorStop(0.65, '#6a5e4d'); // Warm leathery earth brown
    bodyGrad.addColorStop(1, '#3b352b'); // Dark charcoal umber ventral
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Edge highlight / anatomical rim
    ctx.strokeStyle = 'rgba(180, 175, 160, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ventral pelvic dewlap spine tip
    ctx.fillStyle = '#2d2720';
    ctx.beginPath();
    ctx.moveTo(-2 * s, 21 * s + breathOffset);
    ctx.lineTo(3 * s, 24.5 * s + breathOffset);
    ctx.lineTo(6 * s, 21 * s + breathOffset);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Rough Sandpaper/Shagreen Skin Texture:
   * Leathery facet cross-hatch shading and fine stippling
   */
  private renderRoughSkinTexture(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 25, 20, 0.18)';
    ctx.lineWidth = 0.7;

    // Diagonal subtle micro-grooves suggesting rough filefish denticles (sandpaper skin)
    for (let x = -28 * s; x < 38 * s; x += 6 * s) {
      ctx.beginPath();
      ctx.moveTo(x, -16 * s);
      ctx.lineTo(x + 10 * s, 14 * s);
      ctx.stroke();
    }
    for (let x = -20 * s; x < 44 * s; x += 6 * s) {
      ctx.beginPath();
      ctx.moveTo(x, 14 * s);
      ctx.lineTo(x + 10 * s, -16 * s);
      ctx.stroke();
    }

    // Subtle gill slit / operculum curve
    ctx.beginPath();
    ctx.arc(-14 * s, 3 * s, 9 * s, -0.9, 0.8);
    ctx.strokeStyle = 'rgba(40, 35, 30, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Pearlescent White Spots:
   * The signature feature of the Whitespotted Filefish (Cantherhines macrocerus)
   */
  private renderWhiteSpotsField(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();

    for (const spot of this.whiteSpots) {
      const sx = spot.x * s;
      const sy = spot.y * s;
      const sr = spot.r * (s / 4.8);

      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.8, sr), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${spot.alpha})`;
      ctx.fill();

      // Soft pearlescent halo
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.4, sr * 1.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240, 245, 255, ${spot.alpha * 0.25})`;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Tall Erectable First Dorsal Spine:
   * Originates right over the eye, stout, barbed, with locking secondary spinelet and membrane
   */
  private renderTallDorsalSpine(ctx: CanvasRenderingContext2D, s: number, spineFlex: number) {
    ctx.save();
    ctx.translate(-20 * s, -23 * s);
    ctx.rotate(spineFlex);

    // Spine membrane connecting back to dorsal contour
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(4 * s, -18 * s);
    ctx.bezierCurveTo(8 * s, -12 * s, 12 * s, -4 * s, 14 * s, 2 * s);
    ctx.closePath();
    ctx.fillStyle = 'rgba(140, 120, 95, 0.45)';
    ctx.fill();

    // Main stout first dorsal spine
    ctx.beginPath();
    ctx.moveTo(-2 * s, 1 * s);
    ctx.lineTo(0, -22 * s); // Tall spine tip
    ctx.lineTo(3.2 * s, -21 * s);
    ctx.lineTo(3.5 * s, 1 * s);
    ctx.closePath();

    const spineGrad = ctx.createLinearGradient(0, -22 * s, 0, 1 * s);
    spineGrad.addColorStop(0, '#d8d4cb');
    spineGrad.addColorStop(0.3, '#8f8474');
    spineGrad.addColorStop(1, '#4e463c');
    ctx.fillStyle = spineGrad;
    ctx.fill();
    ctx.strokeStyle = '#2b251d';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Micro barbs along front edge of spine
    ctx.fillStyle = '#f0ece2';
    for (let i = 0; i < 5; i++) {
      const by = lerp(-4 * s, -19 * s, i / 4);
      ctx.beginPath();
      ctx.moveTo(-1.2 * s, by);
      ctx.lineTo(-2.8 * s, by - 1 * s);
      ctx.lineTo(-0.8 * s, by - 2 * s);
      ctx.fill();
    }

    // Tiny second locking spinelet behind main spine
    ctx.beginPath();
    ctx.moveTo(3.5 * s, 0);
    ctx.lineTo(5.5 * s, -5 * s);
    ctx.lineTo(6.5 * s, 0);
    ctx.closePath();
    ctx.fillStyle = '#7a7062';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Small Terminal Chisel-Beak Mouth & Lips
   */
  private renderSmallMouth(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    const aperture = this.mouthAperture;

    // Pale fleshy lips around small snout
    ctx.beginPath();
    ctx.ellipse(-36.2 * s, 2.5 * s, 2.5 * s, 3.2 * s, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#b8a896';
    ctx.fill();
    ctx.strokeStyle = '#6e5e4e';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Dark oral opening
    ctx.beginPath();
    ctx.ellipse(-36.5 * s, 2.5 * s, 1.2 * s, 2.0 * s * aperture, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a140e';
    ctx.fill();

    // Specialized incisor chisel teeth (pale ivory)
    ctx.fillStyle = '#fffaee';
    // Upper incisor
    ctx.beginPath();
    ctx.moveTo(-36.5 * s, 1.2 * s);
    ctx.lineTo(-37.8 * s, 1.8 * s);
    ctx.lineTo(-36.2 * s, 2.2 * s);
    ctx.fill();

    // Lower incisor
    ctx.beginPath();
    ctx.moveTo(-36.5 * s, 3.8 * s * aperture);
    ctx.lineTo(-37.8 * s, 3.2 * s * aperture);
    ctx.lineTo(-36.2 * s, 2.8 * s * aperture);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Eye & Orbital Rims
   */
  private renderEye(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    const ex = -22 * s;
    const ey = -8 * s;
    const er = 4.2 * s;

    // Orbital fleshy socket ring
    ctx.beginPath();
    ctx.arc(ex, ey, er + 1.6 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#3a342c';
    ctx.fill();
    ctx.strokeStyle = '#8a7d6e';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Radiating ocular camouflage lines
    ctx.strokeStyle = '#9a8d7e';
    ctx.lineWidth = 0.8;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * (er + 0.5 * s), ey + Math.sin(a) * (er + 0.5 * s));
      ctx.lineTo(ex + Math.cos(a) * (er + 2.8 * s), ey + Math.sin(a) * (er + 2.8 * s));
      ctx.stroke();
    }

    // Eyeball
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(ex - 1 * s, ey - 1 * s, 0.5 * s, ex, ey, er);
    irisGrad.addColorStop(0, '#c89d58'); // Amber-gold iris
    irisGrad.addColorStop(0.7, '#6b542e');
    irisGrad.addColorStop(1, '#2a2012');
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(ex, ey, er * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0c';
    ctx.fill();

    // Specular corneal glint
    ctx.beginPath();
    ctx.arc(ex - 1.2 * s, ey - 1.2 * s, 1.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Small Pectoral Fin:
   * Small, translucent fan-shaped fin that flutters rapidly
   */
  private renderPectoralFin(ctx: CanvasRenderingContext2D, s: number, finWave: number) {
    ctx.save();
    const px = -10 * s;
    const py = 5 * s;
    const angle = finWave * 0.25;

    ctx.translate(px, py);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(3 * s, -4 * s, 8 * s, -3 * s, 9 * s, 2 * s);
    ctx.bezierCurveTo(8 * s, 6 * s, 3 * s, 5 * s, 0, 0);
    ctx.closePath();

    ctx.fillStyle = 'rgba(230, 205, 160, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 210, 0.8)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Fin rays
    ctx.strokeStyle = 'rgba(255, 245, 220, 0.5)';
    ctx.lineWidth = 0.7;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(8.5 * s, i * 1.5 * s + 1 * s);
      ctx.stroke();
    }

    ctx.restore();
  }
}

import { Vector2D, FishConfig } from '../types';
import { CleanerFishBase, CleanerTuning } from './CleanerFishBase';

const HOGFISH_CONFIG: FishConfig = {
  scale: 1.25,
  segmentCount: 16,
  segmentLength: 9.5,
  baseSpeed: 2.8,
  maxSpeed: 5.5,
  turnSpeed: 0.055,
  waveFrequency: 0.20,
  waveAmplitude: 5.0,
};

// Anatomical body half-widths matching the juvenile Spanish hogfish (Bodianus rufus)
// Streamlined profile with pointed acute snout, gentle dorsal nape, and stout caudal peduncle
const HOGFISH_BODY_RADII: number[] = [
  2.7,  // 0: Pointed snout tip
  5.2,  // 1: Forehead / Eye
  7.6,  // 2: Nape / Opercular margin
  9.2,  // 3: Pectoral base / 1st dorsal spine origin
  9.8,  // 4: Anterior dorsal ridge (moderate, sleek arch)
  9.5,  // 5: Mid-body
  8.8,  // 6: Mid-posterior transition
  7.8,  // 7: Anterior anal fin
  6.6,  // 8: Rear torso (yellow flank)
  5.5,  // 9: Rear body
  4.5,  // 10: Peduncle start
  3.6,  // 11: Caudal peduncle
  2.8,  // 12: Narrow peduncle
  2.2,  // 13: Tail base
  1.7,  // 14: Caudal fin root
  1.2,  // 15: Caudal tip anchor
];

const HOGFISH_TUNING: CleanerTuning = {
  segmentHeightRatio: 1.1,
  refreshSegmentRadii: false,
  mouthOffset: 14,
  hitRadius: 45,
  idleBobY: 0.12,
  idleBobX: 0.06,
  followRestSpeed: 0.8,
  dartDuration: 70,
  dartSpeedMin: 0.8,
  dartSpeedRange: 0.2,
  danceSpeed: 0.9,
  cleanApproachMinSpeed: 1.2,
  cleanInspectSpeed: 0.6,
  spineMaxBend: 0.26,
  spineWavePower: 1.35,
  spineWaveLag: 0.44,
  spineWaveScale: 0.038,
  spineIdleWaveFactor: 0.18,
};

export class SpanishHogfish extends CleanerFishBase {
  constructor(startX: number, startY: number) {
    super(HOGFISH_CONFIG, HOGFISH_BODY_RADII, HOGFISH_TUNING, {
      x: startX,
      y: startY,
      heading: Math.random() * Math.PI * 2,
      speed: HOGFISH_CONFIG.baseSpeed,
      targetPoint: { x: startX + 150, y: startY },
    });
  }

  protected resetPosition(width: number, height: number): Vector2D {
    return { x: width / 2, y: height / 2 };
  }

  /**
   * Main Render Method:
   * Accurately reproduces the low-poly polygonal reference design of the Cleaner Wrasse.
   */
  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const scale = this.config.scale;

    // 1. Compute mesh vertices along the animated spine
    // Top contour (dorsal), Upper-Mid line, Center line, Lower-Mid line, Bottom contour (ventral)
    const topPts: Vector2D[] = [];
    const upperMidPts: Vector2D[] = [];
    const centerPts: Vector2D[] = [];
    const lowerMidPts: Vector2D[] = [];
    const bottomPts: Vector2D[] = [];

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const norm = seg.angle + Math.PI / 2;
      const r = seg.width;

      topPts.push({
        x: seg.pos.x + Math.cos(norm) * r,
        y: seg.pos.y + Math.sin(norm) * r,
      });

      // Upper mid is ~0.35 r up from center
      upperMidPts.push({
        x: seg.pos.x + Math.cos(norm) * (r * 0.35),
        y: seg.pos.y + Math.sin(norm) * (r * 0.35),
      });

      centerPts.push({
        x: seg.pos.x,
        y: seg.pos.y,
      });

      // Lower mid is ~0.35 r down from center
      lowerMidPts.push({
        x: seg.pos.x - Math.cos(norm) * (r * 0.35),
        y: seg.pos.y - Math.sin(norm) * (r * 0.35),
      });

      bottomPts.push({
        x: seg.pos.x - Math.cos(norm) * r,
        y: seg.pos.y - Math.sin(norm) * r,
      });
    }

    const headAngle = this.segments[0].angle;
    const snoutTip: Vector2D = {
      x: this.segments[0].pos.x + Math.cos(headAngle) * (14 * scale),
      y: this.segments[0].pos.y + Math.sin(headAngle) * (14 * scale),
    };

    const tailAnchor: Vector2D = this.segments[this.segments.length - 1].pos;

    // 2. Render Underlay Fins (Dorsal, Anal, Pelvic)
    this.renderLowPolyDorsalFin(ctx, scale);
    this.renderLowPolyAnalFin(ctx, scale);
    this.renderLowPolyPelvicFin(ctx, scale);

    // 3. Render Caudal Tail Fin (Radiant Sunny Yellow Fan Tail)
    this.renderLowPolyCaudalFin(ctx, scale, tailAnchor);

    // 4. Render Main Low-Poly Faceted Body (Bicolored: Royal Purple Mantle + Canary Yellow Belly & Flanks + Yellow Snout Ridge)
    this.renderLowPolyBody(ctx, snoutTip, tailAnchor, topPts, upperMidPts, centerPts, lowerMidPts, bottomPts);

    // 5. Render Pectoral Fin (Translucent golden yellow fan fluttering on flank)
    this.renderLowPolyPectoralFin(ctx, scale);

    // 6. Render Eye & Snout/Mouth Lines matching Reference (Golden Iris, Pinkish-Lavender Chin, Pointed Snout)
    this.renderFacialFeatures(ctx, scale, snoutTip);

    ctx.restore();
  }

  /**
   * Dorsal Fin: Long continuous sail running from segment 2 to 12.
   * - Anterior spiny section (seg 2-7): Royal violet/purple membranes with sharp ray spines
   *   and a dark indigo/blue spot near spines 1-3 (classic juvenile Bodianus rufus trait).
   * - Posterior soft section (seg 8-12): Radiant sunny canary yellow membranes with spiny ray tips.
   */
  private renderLowPolyDorsalFin(ctx: CanvasRenderingContext2D, scale: number) {
    ctx.save();
    const segStart = 2;
    const segEnd = 12;

    const finTopPts: Vector2D[] = [];
    const finBasePts: Vector2D[] = [];

    for (let i = segStart; i <= segEnd; i++) {
      const seg = this.segments[i];
      const norm = seg.angle + Math.PI / 2;
      const baseR = seg.width;

      // Profile: spiny anterior peak near seg 3-4, then uniform dorsal sail
      const t = (i - segStart) / (segEnd - segStart);
      const isAnteriorSpiny = i <= 5;
      const finHeight = (isAnteriorSpiny ? 5.2 + Math.sin(t * Math.PI) * 4.2 : 4.6 + Math.sin(t * Math.PI) * 3.2) * scale;

      finBasePts.push({
        x: seg.pos.x + Math.cos(norm) * (baseR * 0.92),
        y: seg.pos.y + Math.sin(norm) * (baseR * 0.92),
      });

      finTopPts.push({
        x: seg.pos.x + Math.cos(norm) * (baseR + finHeight),
        y: seg.pos.y + Math.sin(norm) * (baseR + finHeight),
      });
    }

    // Palette: Purple anterior transition to yellow posterior
    const purpleFinColors = ['#4c1d95', '#581c87', '#6d28d9', '#7c3aed', '#8b5cf6', '#9333ea'];
    const yellowFinColors = ['#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a'];

    for (let i = 0; i < finBasePts.length - 1; i++) {
      const segIdx = segStart + i;
      const isPurpleZone = segIdx < 7;
      const isTransition = segIdx === 7;

      let col1: string;
      let col2: string;
      if (isPurpleZone) {
        // Dark indigo spot near first 2 spines (seg 2-3)
        if (i <= 1) {
          col1 = '#2e1065';
          col2 = '#1e1b4b';
        } else {
          col1 = purpleFinColors[i % purpleFinColors.length];
          col2 = purpleFinColors[(i + 1) % purpleFinColors.length];
        }
      } else if (isTransition) {
        col1 = '#7c3aed';
        col2 = '#eab308';
      } else {
        col1 = yellowFinColors[(i - 5) % yellowFinColors.length];
        col2 = yellowFinColors[(i - 4) % yellowFinColors.length];
      }

      const p1 = finBasePts[i];
      const p2 = finTopPts[i];
      const p3 = finTopPts[i + 1];
      const p4 = finBasePts[i + 1];

      const strokeCol = isPurpleZone ? 'rgba(216, 180, 254, 0.25)' : 'rgba(254, 240, 138, 0.3)';
      this.drawTriangle(ctx, p1, p2, p4, col1, strokeCol);
      this.drawTriangle(ctx, p2, p3, p4, col2, strokeCol);
    }

    // Spiny ray tips outline along the crest
    ctx.beginPath();
    ctx.moveTo(finBasePts[0].x, finBasePts[0].y);
    for (let i = 0; i < finTopPts.length; i++) {
      ctx.lineTo(finTopPts[i].x, finTopPts[i].y);
    }
    ctx.lineTo(finBasePts[finBasePts.length - 1].x, finBasePts[finBasePts.length - 1].y);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 0.9 * scale;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Anal Fin: Ventral rear sunny canary yellow fin (segments 7 to 13)
   */
  private renderLowPolyAnalFin(ctx: CanvasRenderingContext2D, scale: number) {
    ctx.save();
    const segStart = 7;
    const segEnd = 13;

    const finBasePts: Vector2D[] = [];
    const finTipPts: Vector2D[] = [];

    for (let i = segStart; i <= segEnd; i++) {
      const seg = this.segments[i];
      const norm = seg.angle - Math.PI / 2;
      const baseR = seg.width;

      const t = (i - segStart) / (segEnd - segStart);
      const finHeight = (5.5 + Math.sin(t * Math.PI) * 7.0) * scale;

      finBasePts.push({
        x: seg.pos.x + Math.cos(norm) * (baseR * 0.92),
        y: seg.pos.y + Math.sin(norm) * (baseR * 0.92),
      });

      finTipPts.push({
        x: seg.pos.x + Math.cos(norm) * (baseR + finHeight),
        y: seg.pos.y + Math.sin(norm) * (baseR + finHeight),
      });
    }

    const analColors = ['#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a', '#eab308'];

    for (let i = 0; i < finBasePts.length - 1; i++) {
      const p1 = finBasePts[i];
      const p2 = finTipPts[i];
      const p3 = finTipPts[i + 1];
      const p4 = finBasePts[i + 1];

      this.drawTriangle(ctx, p1, p2, p4, analColors[i % analColors.length], 'rgba(255, 255, 255, 0.2)');
      this.drawTriangle(ctx, p2, p3, p4, analColors[(i + 1) % analColors.length], 'rgba(255, 255, 255, 0.2)');
    }

    ctx.restore();
  }

  /**
   * Pelvic / Ventral Fin: Vibrant sunny canary yellow triangular fins on belly (segment 3-4)
   */
  private renderLowPolyPelvicFin(ctx: CanvasRenderingContext2D, scale: number) {
    ctx.save();
    const seg = this.segments[3];
    const norm = seg.angle - Math.PI / 2;
    const base1 = {
      x: seg.pos.x + Math.cos(norm) * (seg.width * 0.9),
      y: seg.pos.y + Math.sin(norm) * (seg.width * 0.9),
    };
    const nextSeg = this.segments[4];
    const nextNorm = nextSeg.angle - Math.PI / 2;
    const base2 = {
      x: nextSeg.pos.x + Math.cos(nextNorm) * (nextSeg.width * 0.9),
      y: nextSeg.pos.y + Math.sin(nextNorm) * (nextSeg.width * 0.9),
    };

    // Pointed triangular tip extending backwards & downwards
    const tipAngle = seg.angle - Math.PI / 2 - 0.42;
    const tip = {
      x: base1.x + Math.cos(tipAngle) * (14.5 * scale),
      y: base1.y + Math.sin(tipAngle) * (14.5 * scale),
    };

    this.drawTriangle(ctx, base1, tip, base2, '#facc15', 'rgba(255, 255, 255, 0.28)');
    ctx.restore();
  }

  /**
   * Caudal (Tail) Fin: Broad fan-shaped canary yellow caudal fin matching the reference juvenile Spanish Hogfish.
   * Completely vibrant yellow with radiating fin rays and soft trailing edge.
   */
  private renderLowPolyCaudalFin(ctx: CanvasRenderingContext2D, scale: number, tailAnchor: Vector2D) {
    ctx.save();
    const tailSeg = this.segments[this.segments.length - 1];
    const tailAngle = tailSeg.angle;
    const waveWiggle = Math.sin(this.swimPhase - 5.5) * 0.16;
    const effectiveAngle = tailAngle + Math.PI + waveWiggle;

    const tailLen = 33 * scale;

    // Tail anchor top & bottom
    const anchorNorm = tailSeg.angle + Math.PI / 2;
    const anchorTop = {
      x: tailAnchor.x + Math.cos(anchorNorm) * (4.5 * scale),
      y: tailAnchor.y + Math.sin(anchorNorm) * (4.5 * scale),
    };
    const anchorBottom = {
      x: tailAnchor.x - Math.cos(anchorNorm) * (4.5 * scale),
      y: tailAnchor.y - Math.sin(anchorNorm) * (4.5 * scale),
    };

    // Broad fan rays radiating out in vibrant canary yellow
    const topOuterCorner = {
      x: tailAnchor.x + Math.cos(effectiveAngle - 0.62) * tailLen,
      y: tailAnchor.y + Math.sin(effectiveAngle - 0.62) * tailLen,
    };
    const topMidRay = {
      x: tailAnchor.x + Math.cos(effectiveAngle - 0.32) * (tailLen * 0.96),
      y: tailAnchor.y + Math.sin(effectiveAngle - 0.32) * (tailLen * 0.96),
    };
    const centerTrailingTip = {
      x: tailAnchor.x + Math.cos(effectiveAngle) * (tailLen * 0.92),
      y: tailAnchor.y + Math.sin(effectiveAngle) * (tailLen * 0.92),
    };
    const bottomMidRay = {
      x: tailAnchor.x + Math.cos(effectiveAngle + 0.32) * (tailLen * 0.96),
      y: tailAnchor.y + Math.sin(effectiveAngle + 0.32) * (tailLen * 0.96),
    };
    const bottomOuterCorner = {
      x: tailAnchor.x + Math.cos(effectiveAngle + 0.62) * tailLen,
      y: tailAnchor.y + Math.sin(effectiveAngle + 0.62) * tailLen,
    };

    // Inner mid-fan anchor point for faceted depth
    const midFan = {
      x: tailAnchor.x + Math.cos(effectiveAngle) * (tailLen * 0.48),
      y: tailAnchor.y + Math.sin(effectiveAngle) * (tailLen * 0.48),
    };

    // Triangulate radiant yellow fan rays
    this.drawTriangle(ctx, anchorTop, topOuterCorner, topMidRay, '#facc15', 'rgba(255, 255, 255, 0.25)');
    this.drawTriangle(ctx, anchorTop, topMidRay, midFan, '#fde047', 'rgba(255, 255, 255, 0.22)');
    this.drawTriangle(ctx, topMidRay, centerTrailingTip, midFan, '#eab308', 'rgba(255, 255, 255, 0.22)');

    this.drawTriangle(ctx, anchorBottom, bottomMidRay, bottomOuterCorner, '#facc15', 'rgba(255, 255, 255, 0.25)');
    this.drawTriangle(ctx, anchorBottom, midFan, bottomMidRay, '#fde047', 'rgba(255, 255, 255, 0.22)');
    this.drawTriangle(ctx, bottomMidRay, midFan, centerTrailingTip, '#eab308', 'rgba(255, 255, 255, 0.22)');

    this.drawTriangle(ctx, tailAnchor, anchorTop, midFan, '#eab308', 'rgba(255, 255, 255, 0.15)');
    this.drawTriangle(ctx, tailAnchor, midFan, anchorBottom, '#ca8a04', 'rgba(255, 255, 255, 0.15)');

    // Delicate radiating ray strokes
    ctx.beginPath();
    ctx.moveTo(anchorTop.x, anchorTop.y);
    ctx.lineTo(topOuterCorner.x, topOuterCorner.y);
    ctx.moveTo(tailAnchor.x, tailAnchor.y);
    ctx.lineTo(topMidRay.x, topMidRay.y);
    ctx.moveTo(tailAnchor.x, tailAnchor.y);
    ctx.lineTo(centerTrailingTip.x, centerTrailingTip.y);
    ctx.moveTo(tailAnchor.x, tailAnchor.y);
    ctx.lineTo(bottomMidRay.x, bottomMidRay.y);
    ctx.moveTo(anchorBottom.x, anchorBottom.y);
    ctx.lineTo(bottomOuterCorner.x, bottomOuterCorner.y);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 0.8 * scale;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Main Low-Poly Body Mesh:
   * Accurately reproduces the bicolored juvenile Spanish Hogfish (Bodianus rufus) from the reference image:
   * - Forehead & Snout: Bright golden yellow dorsal ridge on upper snout + pale lavender/pinkish chin and throat.
   * - Dorsal Mantle / Cape: Deep royal violet / vivid purple (#7c3aed, #6d28d9, #581c87, #4c1d95) covering upper head and back.
   * - Reticulated Scale Texture: Faceted mesh highlighting the distinctive textured scale rows of the purple mantle.
   * - Transition: Diagonal sloping boundary where purple scales scatter into sunny yellow.
   * - Belly & Posterior: Pure radiant sunny canary yellow (#fde047, #facc15, #eab308) across entire flank, belly, and caudal peduncle.
   */
  private renderLowPolyBody(
    ctx: CanvasRenderingContext2D,
    snoutTip: Vector2D,
    tailAnchor: Vector2D,
    topPts: Vector2D[],
    upperMidPts: Vector2D[],
    centerPts: Vector2D[],
    lowerMidPts: Vector2D[],
    bottomPts: Vector2D[]
  ) {
    ctx.save();

    const purplePalette = ['#6d28d9', '#7c3aed', '#581c87', '#4c1d95', '#8b5cf6', '#9333ea'];
    const yellowPalette = ['#fde047', '#facc15', '#eab308', '#ca8a04', '#fef08a'];
    const lavenderPalette = ['#f3e8ff', '#e9d5ff', '#fae8ff', '#fce7f3', '#f5d0fe'];

    const segCount = this.segments.length;

    // --- 1. Snout Forehead, Lips & Throat ---
    // Snout dorsal ridge: bright golden yellow
    this.drawTriangle(ctx, snoutTip, topPts[0], topPts[1], '#fde047', 'rgba(255, 255, 255, 0.25)');
    this.drawTriangle(ctx, snoutTip, topPts[1], upperMidPts[1], '#facc15', 'rgba(255, 255, 255, 0.25)');

    // Snout upper flank: royal purple leading to eye
    this.drawTriangle(ctx, snoutTip, upperMidPts[1], centerPts[1], '#7c3aed', 'rgba(255, 255, 255, 0.2)');
    this.drawTriangle(ctx, snoutTip, centerPts[1], lowerMidPts[1], '#6d28d9', 'rgba(255, 255, 255, 0.18)');

    // Snout lower jaw & chin: pale lavender-pink (matching reference photo)
    this.drawTriangle(ctx, snoutTip, lowerMidPts[1], bottomPts[1], '#e9d5ff', 'rgba(255, 255, 255, 0.15)');
    this.drawTriangle(ctx, snoutTip, bottomPts[0], bottomPts[1], '#f3e8ff', 'rgba(255, 255, 255, 0.15)');

    // --- 2. Iterate spine rings and create faceted low-poly quad strips with scale lattice ---
    for (let i = 1; i < segCount - 1; i++) {
      // --- LAYER A: Top Dorsal Zone ---
      // For segments 1 to 7: Royal purple dorsal mantle / arched nape
      // For segments >= 8: Sunny canary yellow dorsal margin
      const isDorsalPurple = i <= 6;
      const isDorsalTransition = i === 7;

      let topCol1: string;
      let topCol2: string;
      if (isDorsalPurple) {
        topCol1 = purplePalette[i % purplePalette.length];
        topCol2 = purplePalette[(i + 1) % purplePalette.length];
      } else if (isDorsalTransition) {
        topCol1 = '#8b5cf6';
        topCol2 = '#facc15';
      } else {
        topCol1 = yellowPalette[(i - 6) % yellowPalette.length];
        topCol2 = yellowPalette[(i - 5) % yellowPalette.length];
      }

      const topStroke = isDorsalPurple ? 'rgba(216, 180, 254, 0.25)' : 'rgba(254, 240, 138, 0.25)';
      this.drawTriangle(ctx, topPts[i], topPts[i + 1], upperMidPts[i], topCol1, topStroke);
      this.drawTriangle(ctx, topPts[i + 1], upperMidPts[i + 1], upperMidPts[i], topCol2, topStroke);

      // --- LAYER B: Upper Lateral Zone (Reticulated scale pattern on purple cape) ---
      // Purple from seg 1 to 6; transition at 7; sunny yellow from seg 8 onward
      let midCol1: string;
      let midCol2: string;
      if (i <= 5) {
        midCol1 = purplePalette[(i + 2) % purplePalette.length];
        midCol2 = purplePalette[(i + 3) % purplePalette.length];
      } else if (i === 6) {
        midCol1 = '#7c3aed';
        midCol2 = '#eab308'; // Mottled transition scale
      } else if (i === 7) {
        midCol1 = '#9333ea';
        midCol2 = '#fde047';
      } else {
        midCol1 = yellowPalette[(i - 5) % yellowPalette.length];
        midCol2 = yellowPalette[(i - 4) % yellowPalette.length];
      }

      const midStroke = i <= 6 ? 'rgba(216, 180, 254, 0.22)' : 'rgba(254, 240, 138, 0.22)';
      this.drawTriangle(ctx, upperMidPts[i], upperMidPts[i + 1], centerPts[i], midCol1, midStroke);
      this.drawTriangle(ctx, upperMidPts[i + 1], centerPts[i + 1], centerPts[i], midCol2, midStroke);

      // --- LAYER C: Lower Lateral Zone ---
      // Head/cheek has mauve/amber flush; mid-body starts yellow belly earlier (seg 4-5)
      let lowCol1: string;
      let lowCol2: string;
      if (i <= 2) {
        lowCol1 = '#8b5cf6';
        lowCol2 = '#7c3aed';
      } else if (i === 3) {
        lowCol1 = '#7c3aed';
        lowCol2 = '#f59e0b'; // Amber transition near pectoral
      } else if (i === 4) {
        lowCol1 = '#eab308';
        lowCol2 = '#facc15';
      } else {
        lowCol1 = yellowPalette[i % yellowPalette.length];
        lowCol2 = yellowPalette[(i + 1) % yellowPalette.length];
      }

      const lowStroke = i <= 3 ? 'rgba(216, 180, 254, 0.2)' : 'rgba(254, 240, 138, 0.2)';
      this.drawTriangle(ctx, centerPts[i], centerPts[i + 1], lowerMidPts[i], lowCol1, lowStroke);
      this.drawTriangle(ctx, centerPts[i + 1], lowerMidPts[i + 1], lowerMidPts[i], lowCol2, lowStroke);

      // --- LAYER D: Ventral Belly (Pale lavender throat into pure sunny canary yellow belly) ---
      let bellyCol1: string;
      let bellyCol2: string;
      if (i <= 2) {
        bellyCol1 = lavenderPalette[i % lavenderPalette.length];
        bellyCol2 = lavenderPalette[(i + 1) % lavenderPalette.length];
      } else {
        bellyCol1 = yellowPalette[i % yellowPalette.length];
        bellyCol2 = yellowPalette[(i + 1) % yellowPalette.length];
      }

      const bellyStroke = i <= 2 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(254, 240, 138, 0.2)';
      this.drawTriangle(ctx, lowerMidPts[i], lowerMidPts[i + 1], bottomPts[i], bellyCol1, bellyStroke);
      this.drawTriangle(ctx, lowerMidPts[i + 1], bottomPts[i + 1], bottomPts[i], bellyCol2, bellyStroke);
    }

    // --- 3. Close mesh at caudal peduncle / tail anchor in bright sunny yellow ---
    const prev = segCount - 2;

    this.drawTriangle(ctx, topPts[prev], tailAnchor, upperMidPts[prev], '#fde047', 'rgba(254, 240, 138, 0.25)');
    this.drawTriangle(ctx, upperMidPts[prev], tailAnchor, centerPts[prev], '#facc15', 'rgba(254, 240, 138, 0.25)');
    this.drawTriangle(ctx, centerPts[prev], tailAnchor, lowerMidPts[prev], '#eab308', 'rgba(254, 240, 138, 0.25)');
    this.drawTriangle(ctx, lowerMidPts[prev], tailAnchor, bottomPts[prev], '#facc15', 'rgba(254, 240, 138, 0.25)');

    ctx.restore();
  }

  /**
   * Pectoral Fin: Fan-like translucent sunny yellow/golden fin fluttering on the lateral flank
   */
  private renderLowPolyPectoralFin(ctx: CanvasRenderingContext2D, scale: number) {
    ctx.save();
    const seg = this.segments[2];
    const normal = seg.angle + Math.PI / 2;

    const finLen = 16 * scale;
    const flutterAmp = this.isRunning ? Math.sin(this.finPhase * 2.6) * 0.42 : Math.sin(this.finPhase) * 0.12;

    // Single lateral pectoral fin on the visible flank (slightly below midline)
    const root = {
      x: seg.pos.x - Math.cos(normal) * (seg.width * 0.22) - Math.cos(seg.angle) * (1.5 * scale),
      y: seg.pos.y - Math.sin(normal) * (seg.width * 0.22) - Math.sin(seg.angle) * (1.5 * scale),
    };

    const finBaseAngle = seg.angle + Math.PI - 0.28 + flutterAmp;

    // 3 low-poly fan ribs in translucent sunny yellow
    const rib1 = {
      x: root.x + Math.cos(finBaseAngle - 0.22) * (finLen * 0.75),
      y: root.y + Math.sin(finBaseAngle - 0.22) * (finLen * 0.75),
    };
    const rib2 = {
      x: root.x + Math.cos(finBaseAngle) * finLen,
      y: root.y + Math.sin(finBaseAngle) * finLen,
    };
    const rib3 = {
      x: root.x + Math.cos(finBaseAngle + 0.22) * (finLen * 0.88),
      y: root.y + Math.sin(finBaseAngle + 0.22) * (finLen * 0.88),
    };

    this.drawTriangle(ctx, root, rib1, rib2, 'rgba(250, 204, 21, 0.75)', 'rgba(254, 240, 138, 0.4)');
    this.drawTriangle(ctx, root, rib2, rib3, 'rgba(234, 179, 8, 0.82)', 'rgba(254, 240, 138, 0.4)');

    ctx.restore();
  }

  /**
   * Facial Features:
   * - Single profile eye with radiant golden-yellow iris matching reference photo
   * - Delicate coral/pink mouth slit on pointed snout tip
   * - Amber/orange opercular cheek glow
   * - Opercular gill line on visible flank
   */
  private renderFacialFeatures(ctx: CanvasRenderingContext2D, scale: number, snoutTip: Vector2D) {
    ctx.save();
    const head = this.segments[1];
    const headAngle = head.angle;
    const norm = headAngle + Math.PI / 2;

    // Single lateral eye for profile view: situated on upper flank between midline and forehead ridge
    const eyeOffsetFwd = 2.4 * scale;
    const eyeOffsetLat = head.width * 0.16;

    const eyeX = head.pos.x + Math.cos(headAngle) * eyeOffsetFwd + Math.cos(norm) * eyeOffsetLat;
    const eyeY = head.pos.y + Math.sin(headAngle) * eyeOffsetFwd + Math.sin(norm) * eyeOffsetLat;

    // Warm Amber Opercular Flush behind the eye
    ctx.beginPath();
    ctx.arc(
      eyeX - Math.cos(headAngle) * (2.8 * scale),
      eyeY - Math.sin(headAngle) * (2.8 * scale),
      3.8 * scale,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.fill();

    // Golden-Yellow Iris (distinctive Bodianus rufus trait from reference image)
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 3.4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.strokeStyle = 'rgba(202, 138, 4, 0.7)';
    ctx.lineWidth = 0.8 * scale;
    ctx.stroke();

    // Fine dark inner ring
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2.5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();

    // Deep Black Pupil
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 1.9 * scale, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();

    // Crisp White Catchlight
    ctx.beginPath();
    ctx.arc(
      eyeX + Math.cos(headAngle - 0.7) * (0.95 * scale),
      eyeY + Math.sin(headAngle - 0.7) * (0.95 * scale),
      0.85 * scale,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Delicate coral-pink mouth slit on pointed snout tip
    ctx.beginPath();
    ctx.moveTo(snoutTip.x, snoutTip.y);
    ctx.lineTo(
      snoutTip.x - Math.cos(headAngle) * (5.5 * scale),
      snoutTip.y - Math.sin(headAngle) * (5.5 * scale)
    );
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();

    // Operculum (Single curved gill line on visible lateral flank)
    const gillSeg = this.segments[2];
    const gillNorm = gillSeg.angle + Math.PI / 2;
    const gTop = {
      x: gillSeg.pos.x + Math.cos(gillNorm) * (gillSeg.width * 0.75),
      y: gillSeg.pos.y + Math.sin(gillNorm) * (gillSeg.width * 0.75),
    };
    const gMid = {
      x: gillSeg.pos.x - Math.cos(gillSeg.angle) * (2.2 * scale),
      y: gillSeg.pos.y - Math.sin(gillSeg.angle) * (2.2 * scale),
    };
    const gBot = {
      x: gillSeg.pos.x - Math.cos(gillNorm) * (gillSeg.width * 0.65),
      y: gillSeg.pos.y - Math.sin(gillNorm) * (gillSeg.width * 0.65),
    };

    ctx.beginPath();
    ctx.moveTo(gTop.x, gTop.y);
    ctx.quadraticCurveTo(gMid.x, gMid.y, gBot.x, gBot.y);
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.45)';
    ctx.lineWidth = 1.0 * scale;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Helper to render a low-poly facet triangle with optional edge highlight
   */
  private drawTriangle(
    ctx: CanvasRenderingContext2D,
    p1: Vector2D,
    p2: Vector2D,
    p3: Vector2D,
    fillColor: string,
    strokeColor?: string
  ) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.65;
      ctx.stroke();
    }
  }
}

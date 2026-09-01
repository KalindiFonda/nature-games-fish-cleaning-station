import { Vector2D } from '../types';

interface Facet {
  pts: Vector2D[];
  color: string;
  strokeColor?: string;
}

export class Reef {
  private wavePhase: number = 0;

  constructor() {}

  public update(_dt: number) {
    this.wavePhase += 0.02 * _dt;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();

    // The coral mountain reef is reduced by 50% in size while preserving the exact 30-degree slope angle.
    // Previous vertical span: height * 0.64 (startY = height * 0.36).
    // 50% reduced vertical span: height * 0.32 (startY = height * 0.68).
    // tan(30°) ≈ 0.577 => cot(30°) ≈ 1.732.
    const startY = height * 0.68;
    const slopeAngleRad = (30 * Math.PI) / 180; // 30 degrees
    const cot30 = 1 / Math.tan(slopeAngleRad); // ~1.732
    const bottomX = (height - startY) * cot30;

    // 1. Render Faceted Rock Base along the 30-degree descent
    this.renderFacetedRock(ctx, width, height, startY, bottomX);

    // 2. Render Marine Organisms on the slope (scaled down proportionally to fit the 50% mountain)
    ctx.save();
    // Tube Sponges at upper ledge
    this.renderTubeSponges(ctx, bottomX * 0.08, startY + (height - startY) * 0.08, 0.65);

    // Branching Staghorn Coral mid-upper slope
    this.renderStaghornCoral(ctx, bottomX * 0.30, startY + (height - startY) * 0.28, 0.65);

    // Tiered Plate / Shelf Coral on middle ridge
    this.renderPlateCoral(ctx, bottomX * 0.50, startY + (height - startY) * 0.50, 0.65);

    // Soft Anemone with gently swaying polyps
    this.renderSoftAnemone(ctx, bottomX * 0.70, startY + (height - startY) * 0.70, 0.65);

    // Brain Coral dome near the bottom base
    this.renderBrainCoral(ctx, bottomX * 0.90, startY + (height - startY) * 0.90, 0.65);
    ctx.restore();

    ctx.restore();
  }

  private drawPoly(ctx: CanvasRenderingContext2D, pts: Vector2D[], fill: string, stroke?: string) {
    if (pts.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.75;
      ctx.stroke();
    }
  }

  /**
   * Faceted low-poly reef rock wall descending at ~30 degrees
   */
  private renderFacetedRock(
    ctx: CanvasRenderingContext2D,
    _width: number,
    height: number,
    startY: number,
    bottomX: number
  ) {
    // Generate key ridge vertices along the 30° descent with natural craggy offsets
    const r0: Vector2D = { x: 0, y: startY };
    const r1: Vector2D = { x: bottomX * 0.12, y: startY + (height - startY) * 0.08 - 6 };
    const r2: Vector2D = { x: bottomX * 0.24, y: startY + (height - startY) * 0.22 + 4 };
    const r3: Vector2D = { x: bottomX * 0.38, y: startY + (height - startY) * 0.35 - 8 };
    const r4: Vector2D = { x: bottomX * 0.52, y: startY + (height - startY) * 0.50 + 5 };
    const r5: Vector2D = { x: bottomX * 0.68, y: startY + (height - startY) * 0.66 - 4 };
    const r6: Vector2D = { x: bottomX * 0.84, y: startY + (height - startY) * 0.82 + 6 };
    const r7: Vector2D = { x: bottomX, y: height };

    // Intermediate internal facet vertices (stepping down inside the rock mass)
    const m0: Vector2D = { x: 0, y: startY + (height - startY) * 0.25 };
    const m1: Vector2D = { x: bottomX * 0.15, y: startY + (height - startY) * 0.32 };
    const m2: Vector2D = { x: bottomX * 0.30, y: startY + (height - startY) * 0.48 };
    const m3: Vector2D = { x: bottomX * 0.45, y: startY + (height - startY) * 0.65 };
    const m4: Vector2D = { x: bottomX * 0.62, y: startY + (height - startY) * 0.82 };
    const m5: Vector2D = { x: bottomX * 0.80, y: height };

    // Deep base vertices
    const b0: Vector2D = { x: 0, y: startY + (height - startY) * 0.60 };
    const b1: Vector2D = { x: bottomX * 0.18, y: startY + (height - startY) * 0.70 };
    const b2: Vector2D = { x: bottomX * 0.35, y: startY + (height - startY) * 0.85 };
    const b3: Vector2D = { x: bottomX * 0.55, y: height };
    const corner: Vector2D = { x: 0, y: height };

    // Facet Palette: Deep ocean slate, indigo basalt, teal granite, and shaded rock
    const cRidgeLit = '#1e293b';     // Slate top light
    const cRidgeMid = '#0f172a';     // Dark ridge facet
    const cBasalt1 = '#1e1b4b';      // Deep indigo basalt
    const cBasalt2 = '#172554';      // Marine midnight blue
    const cTealRock1 = '#0f2937';    // Subdued teal stone
    const cTealRock2 = '#06202a';    // Deep marine slate
    const cDeepCavity = '#020617';   // Abyss crevice
    const cPurpleShadow = '#180d2b'; // Shadow crevice
    const cLedgeAccent = '#334155';  // Highlighted rock rim

    const facets: Facet[] = [
      // Top Ridge Layer (Front-facing illuminated rock facets)
      { pts: [r0, r1, m0], color: cRidgeLit, strokeColor: cLedgeAccent },
      { pts: [r1, m1, m0], color: cTealRock1 },
      { pts: [r1, r2, m1], color: cRidgeMid, strokeColor: cLedgeAccent },
      { pts: [r2, m2, m1], color: cBasalt1 },
      { pts: [r2, r3, m2], color: cRidgeLit, strokeColor: cLedgeAccent },
      { pts: [r3, m3, m2], color: cDeepCavity },
      { pts: [r3, r4, m3], color: cRidgeMid, strokeColor: cLedgeAccent },
      { pts: [r4, m4, m3], color: cTealRock2 },
      { pts: [r4, r5, m4], color: cRidgeLit, strokeColor: cLedgeAccent },
      { pts: [r5, m5, m4], color: cPurpleShadow },
      { pts: [r5, r6, m5], color: cRidgeMid, strokeColor: cLedgeAccent },
      { pts: [r6, r7, m5], color: cBasalt2, strokeColor: cLedgeAccent },

      // Mid Rock Body Layer
      { pts: [m0, m1, b0], color: cTealRock2 },
      { pts: [m1, b1, b0], color: cDeepCavity },
      { pts: [m1, m2, b1], color: cBasalt2 },
      { pts: [m2, b2, b1], color: cPurpleShadow },
      { pts: [m2, m3, b2], color: cTealRock1 },
      { pts: [m3, b3, b2], color: cDeepCavity },
      { pts: [m3, m4, b3], color: cBasalt1 },
      { pts: [m4, m5, b3], color: cTealRock2 },

      // Deep Lower Base to Corner (0, height)
      { pts: [b0, b1, corner], color: cDeepCavity },
      { pts: [b1, b2, corner], color: cPurpleShadow },
      { pts: [b2, b3, corner], color: cDeepCavity },
      { pts: [b3, { x: bottomX, y: height }, corner], color: cDeepCavity },
    ];

    for (const f of facets) {
      this.drawPoly(ctx, f.pts, f.color, f.strokeColor);
    }
  }

  /**
   * Faceted Tube Sponges (Golden Amber / Saffron Yellow with dark purple interiors)
   */
  private renderTubeSponges(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0) {
    const tubes = [
      { ox: 0, oy: 0, h: 48, w: 12, angle: -0.12 },
      { ox: 14, oy: 6, h: 62, w: 14, angle: -0.04 },
      { ox: 28, oy: 12, h: 38, w: 11, angle: 0.1 },
    ];

    for (const t of tubes) {
      const tx = x + t.ox * scale;
      const ty = y + t.oy * scale;
      const hw = (t.w / 2) * scale;
      const h = t.h * scale;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(t.angle);

      // Tube Cylindrical Facets
      // Left Highlighted Facet
      this.drawPoly(
        ctx,
        [
          { x: -hw, y: 0 },
          { x: -hw, y: -h },
          { x: 0, y: -h + 2 * scale },
          { x: 0, y: 2 * scale },
        ],
        '#f59e0b',
        '#fbbf24'
      );

      // Right Shaded Facet
      this.drawPoly(
        ctx,
        [
          { x: 0, y: 2 * scale },
          { x: 0, y: -h + 2 * scale },
          { x: hw, y: -h },
          { x: hw, y: 0 },
        ],
        '#b45309',
        '#d97706'
      );

      // Outer Rim Lip
      this.drawPoly(
        ctx,
        [
          { x: -hw, y: -h },
          { x: 0, y: -h - 3 * scale },
          { x: hw, y: -h },
          { x: 0, y: -h + 2 * scale },
        ],
        '#fde68a'
      );

      // Deep Hollow Osculum (Opening)
      this.drawPoly(
        ctx,
        [
          { x: -hw * 0.65, y: -h },
          { x: 0, y: -h - 1.8 * scale },
          { x: hw * 0.65, y: -h },
          { x: 0, y: -h + 1.2 * scale },
        ],
        '#451a03'
      );

      ctx.restore();
    }
  }

  /**
   * Faceted Branching Staghorn Coral (Lavender / Soft Violet / Radiant Peach)
   */
  private renderStaghornCoral(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const branches = [
      // Main central trunk and branches
      { pts: [{ x: 0, y: 0 }, { x: -8, y: -24 }, { x: -4, y: -46 }, { x: 2, y: -46 }, { x: 4, y: -22 }], col: '#a855f7' },
      { pts: [{ x: 2, y: -22 }, { x: 12, y: -38 }, { x: 22, y: -54 }, { x: 26, y: -52 }, { x: 16, y: -34 }], col: '#c084fc' },
      { pts: [{ x: -6, y: -26 }, { x: -18, y: -42 }, { x: -22, y: -58 }, { x: -17, y: -60 }, { x: -10, y: -40 }], col: '#9333ea' },
      { pts: [{ x: 14, y: -36 }, { x: 6, y: -56 }, { x: 10, y: -58 }, { x: 18, y: -38 }], col: '#e879f9' },
      { pts: [{ x: -16, y: -40 }, { x: -8, y: -62 }, { x: -4, y: -62 }, { x: -12, y: -38 }], col: '#d946ef' },
    ];

    for (const b of branches) {
      this.drawPoly(ctx, b.pts, b.col, 'rgba(255,255,255,0.3)');
    }

    // Glowing tip facets (white-pink tips)
    const tips = [
      { x: -1, y: -46 },
      { x: 24, y: -53 },
      { x: -19, y: -59 },
      { x: 8, y: -57 },
      { x: -6, y: -62 },
    ];
    for (const tip of tips) {
      this.drawPoly(
        ctx,
        [
          { x: tip.x - 3, y: tip.y },
          { x: tip.x, y: tip.y - 4 },
          { x: tip.x + 3, y: tip.y },
        ],
        '#fae8ff'
      );
    }

    ctx.restore();
  }

  /**
   * Tiered Shelf / Table Plate Coral (Turquoise & Sea Green)
   */
  private renderPlateCoral(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const plates = [
      // Lower larger shelf plate
      {
        base: [{ x: -10, y: 0 }, { x: -18, y: -8 }, { x: 28, y: -8 }, { x: 12, y: 0 }],
        top: [{ x: -24, y: -8 }, { x: 0, y: -16 }, { x: 36, y: -8 }, { x: 8, y: -2 }],
        cTop: '#14b8a6',
        cBot: '#0f766e',
        cRim: '#5eead4',
      },
      // Upper stepped shelf plate
      {
        base: [{ x: 4, y: -12 }, { x: -4, y: -22 }, { x: 32, y: -22 }, { x: 18, y: -12 }],
        top: [{ x: -8, y: -22 }, { x: 14, y: -28 }, { x: 38, y: -22 }, { x: 16, y: -16 }],
        cTop: '#2dd4bf',
        cBot: '#115e59',
        cRim: '#99f6e4',
      },
    ];

    for (const p of plates) {
      // Underside shadow facet
      this.drawPoly(ctx, p.base, p.cBot);
      // Top sunlit tier facet
      this.drawPoly(ctx, p.top, p.cTop, p.cRim);
    }

    ctx.restore();
  }

  /**
   * Soft Coral / Sea Anemone with gently swaying polyps (Electric Cyan & Royal Blue)
   */
  private renderSoftAnemone(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Base mound
    this.drawPoly(
      ctx,
      [
        { x: -14, y: 4 },
        { x: -18, y: -4 },
        { x: 0, y: -8 },
        { x: 18, y: -4 },
        { x: 14, y: 4 },
      ],
      '#1e1b4b'
    );

    // Gently swaying tentacles (8-10 stylized low-poly polyps)
    const tentacles = [
      { bx: -12, by: -4, len: 26, angle: -0.65, phaseOff: 0 },
      { bx: -8, by: -6, len: 32, angle: -0.4, phaseOff: 0.8 },
      { bx: -3, by: -8, len: 36, angle: -0.15, phaseOff: 1.5 },
      { bx: 2, by: -8, len: 38, angle: 0.1, phaseOff: 2.2 },
      { bx: 8, by: -6, len: 33, angle: 0.35, phaseOff: 2.9 },
      { bx: 13, by: -4, len: 25, angle: 0.6, phaseOff: 3.6 },
      { bx: -5, by: -3, len: 28, angle: -0.25, phaseOff: 4.2 },
      { bx: 5, by: -3, len: 30, angle: 0.2, phaseOff: 5.0 },
    ];

    for (const t of tentacles) {
      const sway = Math.sin(this.wavePhase + t.phaseOff) * 0.18;
      const currentAngle = t.angle + sway;

      const midX = t.bx + Math.sin(currentAngle) * (t.len * 0.55);
      const midY = t.by - Math.cos(currentAngle) * (t.len * 0.55);
      const tipX = t.bx + Math.sin(currentAngle + sway * 0.8) * t.len;
      const tipY = t.by - Math.cos(currentAngle + sway * 0.8) * t.len;

      // Draw faceted tapered tentacle
      this.drawPoly(
        ctx,
        [
          { x: t.bx - 2, y: t.by },
          { x: midX - 1.5, y: midY },
          { x: tipX, y: tipY },
          { x: midX + 1.5, y: midY },
          { x: t.bx + 2, y: t.by },
        ],
        '#0284c7',
        '#38bdf8'
      );

      // Bioluminescent tip dot
      ctx.beginPath();
      ctx.arc(tipX, tipY, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = '#67e8f9';
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Brain / Mound Coral (Warm Amber & Sand Gold)
   */
  private renderBrainCoral(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Faceted geodesic hemisphere dome
    const domeFacets = [
      { pts: [{ x: -22, y: 6 }, { x: -20, y: -8 }, { x: -8, y: -18 }, { x: -8, y: 2 }], col: '#b45309' },
      { pts: [{ x: -8, y: 2 }, { x: -8, y: -18 }, { x: 8, y: -18 }, { x: 6, y: 2 }], col: '#d97706' },
      { pts: [{ x: 6, y: 2 }, { x: 8, y: -18 }, { x: 20, y: -8 }, { x: 22, y: 6 }], col: '#92400e' },
      { pts: [{ x: -20, y: -8 }, { x: -14, y: -24 }, { x: 0, y: -28 }, { x: -8, y: -18 }], col: '#f59e0b' },
      { pts: [{ x: -8, y: -18 }, { x: 0, y: -28 }, { x: 14, y: -24 }, { x: 8, y: -18 }], col: '#fbbf24' },
      { pts: [{ x: 8, y: -18 }, { x: 14, y: -24 }, { x: 20, y: -8 }], col: '#b45309' },
    ];

    for (const f of domeFacets) {
      this.drawPoly(ctx, f.pts, f.col, '#78350f');
    }

    // Stylized low-poly grooves
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, -20);
    ctx.lineTo(-4, -12);
    ctx.lineTo(2, -14);
    ctx.lineTo(10, -8);
    ctx.stroke();

    ctx.restore();
  }
}

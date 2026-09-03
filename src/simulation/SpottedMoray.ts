import { Vector2D, Parasite } from '../types';
import { lerp, clamp } from '../utils/math';
import { parasiteUnit, drawParasite, drawEatRing, subsampleParasites } from './parasiteFx';
import { ClientFishBase, ClientFishState, CleaningTargetSpot } from './ClientFishBase';

/**
 * Spotted Moray Eel (Gymnothorax moringa)
 * "Smooth Low-Poly" Style Guide Implementation:
 * - Size: ~60–150 cm
 * - Long, sinuous snake-like body emerging from behind the coral reef wall (anterior ~15–20% visible)
 * - No obvious paired fins (no pectoral or pelvic fins)
 * - Large muscular rounded head with arched occipital crest and sinuous S-curved spine
 * - Huge gaping predatory mouth with buccal pumping respiration
 * - Prominent needle-sharp fang-like teeth along upper, lower, and vomerine dental arches
 * - Small beady eyes positioned anteriorly and high on the snout
 * - Pair of tubular anterior nostrils protruding from the snout tip
 * - Cream/pale tan base coloration covered in organic dark chocolate/black leopard spots
 * - Thick continuous dorsal fin crest beginning along the nape with pale golden margin
 */
export class SpottedMoray extends ClientFishBase {
  public creviceOrigin: Vector2D = { x: 0, y: 0 };
  public targetPos: Vector2D = { x: 0, y: 0 };
  public heading: number = -0.32; // Diagonally up-right from reef crevice

  // Scaled up by 20% (from 5.6 to 6.72)
  public scale: number = 6.72;

  // Unlike the other clients the moray drives its own entrance and exit:
  // the ClientDirector reads `state` / `targetPos` and switches `mode`.
  public state: ClientFishState = 'entering';
  public mode: 'queue' | 'active' = 'queue';
  public targetExtension: number = 0.28;
  public entrySpeed: number = 2.0;
  public exitSpeed: number = 2.4;

  // Extension fraction from behind reef: 0.0 (fully behind reef) to 1.0 (emerged showing snake-like head & neck)
  public extension: number = 0.0;

  public weavePhase: number = 0;
  public mouthAperture: number = 1.0;

  constructor(canvasWidth: number, canvasHeight: number) {
    super();
    this.calculatePositions(canvasWidth, canvasHeight);
    this.pos = { ...this.creviceOrigin };
    this.extension = 0.0;
    this.initParasites();
    this.parasites = subsampleParasites(this.parasites, 24);
    // Perched on the tubular nostril at the very tip of the nose. The nostril
    // is fixed to the skull (it doesn't move with the jaw), so these are plain
    // body parasites, added after subsampling so they are always there.
    let noseId = 900;
    for (const c of [
      { x: 41.6, y: -8.2 },
      { x: 43.6, y: -9.9 },
    ]) {
      this.parasites.push({
        id: noseId++,
        type: 'body',
        localX: c.x,
        localY: c.y,
        attachPart: 'body',
        hoverTimer: 0,
        removed: false,
      });
    }
  }

  public calculatePositions(_width: number, height: number) {
    const startY = height * 0.68;
    const slopeAngleRad = (30 * Math.PI) / 180;
    const cot30 = 1 / Math.tan(slopeAngleRad);

    // Crevice opening point on the reef slope
    const creviceY = startY + (height - startY) * 0.36 + 20;
    const reefEdgeX = (creviceY - startY) * cot30;
    const creviceExitX = reefEdgeX - 15;

    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);
    const snoutLocalDist = 48 * this.scale;

    // When extension = 0.0 (fully retracted into crevice tunnel):
    // The entire head & snout tip are retracted at least 80px deep inside the solid reef rock
    const retractDistance = snoutLocalDist + 80;
    this.creviceOrigin = {
      x: creviceExitX - retractDistance * cosH,
      y: creviceY - retractDistance * sinH,
    };

    // Extended active station target (extension = 1.0): emerging diagonally up-right into water column
    const emergeDistance = 145 * (this.scale / 4.7);
    this.targetPos = {
      x: creviceExitX + emergeDistance * cosH,
      y: creviceY + emergeDistance * sinH,
    };
  }

  /**
   * Initialize parasites on needle teeth, tubular nostrils, snout, and spotted neck
   */
  protected initParasites() {
    this.parasites = [];
    let id = 500;

    // 1. Parasites on huge gaping mouth and needle teeth
    const mouthCoords = [
      { x: 40.0, y: -4.5, part: 'upperTeeth' as const },
      { x: 38.0, y: -4.0, part: 'upperTeeth' as const },
      { x: 34.0, y: -3.8, part: 'upperTeeth' as const },
      { x: 30.0, y: -3.5, part: 'upperTeeth' as const },
      { x: 26.0, y: -3.2, part: 'upperTeeth' as const },
      { x: 22.0, y: -3.0, part: 'upperTeeth' as const },
      { x: 18.0, y: -2.8, part: 'upperTeeth' as const },
      // Lower row sits ON the mandible (it tapers to a point at x=38, y=6)
      { x: 36.0, y: 6.2, part: 'lowerTeeth' as const },
      { x: 33.0, y: 6.4, part: 'lowerTeeth' as const },
      { x: 30.0, y: 6.3, part: 'lowerTeeth' as const },
      { x: 27.0, y: 6.0, part: 'lowerTeeth' as const },
      { x: 24.0, y: 5.8, part: 'lowerTeeth' as const },
      { x: 21.0, y: 5.5, part: 'lowerTeeth' as const },
      { x: 18.0, y: 5.0, part: 'lowerTeeth' as const },
      // Upper snout, inside the outline (the tip is at 42, -5)
      { x: 36.0, y: -6.0, part: 'upperTeeth' as const },
      { x: 32.0, y: -6.5, part: 'upperTeeth' as const },
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

    // 2. Body Parasites along snout, cheeks, throat, and visible neck
    const bodyCoords = [
      // Snout & Cranium
      { x: 34.0, y: -10.0, part: 'body' as const },
      { x: 22.0, y: -14.0, part: 'body' as const },
      { x: 10.0, y: -16.5, part: 'body' as const },
      { x: 0.0, y: -17.0, part: 'body' as const },
      // Cheeks, Gill Aperture & Throat
      // Around the gill pore at (-14, 2), well behind the jaw hinge so they
      // never sit inside the open mouth
      { x: -9.0, y: 0.5, part: 'operculum' as const },
      { x: -11.0, y: 4.5, part: 'operculum' as const },
      { x: -17.0, y: 5.5, part: 'operculum' as const },
      { x: -19.0, y: -0.5, part: 'operculum' as const },
      { x: -13.0, y: -3.0, part: 'operculum' as const },
      { x: -8.0, y: 11.0, part: 'belly' as const },
      { x: -18.0, y: 12.5, part: 'belly' as const },
      // Visible Muscular Neck (Anterior 15-20%)
      { x: -12.0, y: -16.0, part: 'body' as const },
      { x: -24.0, y: -14.5, part: 'body' as const },
      { x: -36.0, y: -12.0, part: 'body' as const },
      { x: -30.0, y: 10.0, part: 'belly' as const },
      { x: -42.0, y: 7.0, part: 'belly' as const },
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

  public getParasiteLocalUnrotated(p: Parasite): { x: number; y: number } {
    const s = this.scale;
    let lx = p.localX * s;
    let ly = p.localY * s;

    if (p.attachPart === 'lowerTeeth' || p.attachPart === 'upperTeeth') {
      // Ride the jaw: renderJawsAndTeeth rotates the mandible about its hinge
      // at (15, 2) and the upper arch about (15, -1), so rotate the parasite
      // around the same pivot by the same angle - it stays glued to the teeth
      const lower = p.attachPart === 'lowerTeeth';
      const hx = 15 * s;
      const hy = (lower ? 2 : -1) * s;
      const ang = (this.mouthAperture - 1.0) * (lower ? 0.18 : -0.06);
      const dx = lx - hx;
      const dy = ly - hy;
      lx = hx + dx * Math.cos(ang) - dy * Math.sin(ang);
      ly = hy + dx * Math.sin(ang) + dy * Math.cos(ang);
    } else if (p.attachPart === 'belly') {
      ly += Math.sin(this.breathPhase) * 1.5;
    } else if (p.attachPart === 'operculum') {
      lx -= Math.sin(this.breathPhase) * 1.8;
    }

    // Serpent undulation offset
    const snakeSway = Math.sin(this.animTime * 1.5 + p.localX / 30) * 2.0;
    ly += snakeSway;

    return { x: lx, y: ly };
  }

  public getParasiteLocalPos(p: Parasite): Vector2D {
    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);
    const loc = this.getParasiteLocalUnrotated(p);

    return {
      x: loc.x * cosH - loc.y * sinH,
      y: loc.x * sinH + loc.y * cosH,
    };
  }

  public setMode(mode: 'queue' | 'active') {
    this.mode = mode;
    if (mode === 'queue') {
      this.targetExtension = 0.36;
      if (this.state !== 'exited' && this.state !== 'exiting') {
        if (this.extension < this.targetExtension) {
          this.state = 'entering';
        } else {
          this.state = 'stationary';
        }
      }
    } else {
      this.targetExtension = 1.0;
      if (this.state !== 'exited' && this.state !== 'exiting') {
        this.state = 'entering';
      }
    }
  }

  public startExit() {
    if (this.state !== 'exited') this.state = 'exiting';
  }

  public update(width: number, height: number, dt: number = 1) {
    const safeDt = clamp(dt, 0.2, 2.0);
    this.animTime += 0.03 * safeDt;
    this.breathPhase += 0.04 * safeDt;
    this.weavePhase += 0.025 * safeDt;

    this.calculatePositions(width, height);

    // Mouth aperture breathing rhythm (buccal pumping)
    this.mouthAperture = 0.85 + Math.sin(this.breathPhase) * 0.25;

    // State machine: Emerge from behind reef / Retreat back behind reef
    if (this.state === 'entering') {
      this.extension += 0.012 * this.entrySpeed * safeDt;
      if (this.extension >= this.targetExtension) {
        this.extension = this.targetExtension;
        this.state = 'stationary';
      }
    } else if (this.state === 'stationary') {
      // Natural subtle undulation in place
      const waveAmp = this.mode === 'queue' ? 0.008 : 0.018;
      this.extension = this.targetExtension + Math.sin(this.animTime * 1.2) * waveAmp;
    } else if (this.state === 'exiting') {
      this.extension -= 0.012 * this.exitSpeed * safeDt;
      if (this.extension <= 0.0) {
        this.extension = 0.0;
        this.state = 'exited';
        this.isVisible = false;
      }
    }

    // Interpolate head center between crevice origin and extended target
    this.pos.x = lerp(this.creviceOrigin.x, this.targetPos.x, this.extension);
    this.pos.y = lerp(this.creviceOrigin.y, this.targetPos.y, this.extension);
  }

  public updateParasites(
    hogfishMouth: Vector2D | null,
    gobyMouth: Vector2D | null,
    _dt: number,
    hogfishScale: number = 0.9,
    gobyScale: number = 0.65
  ) {
    if (this.extension < 0.2) return;

    // Generous mouth touch radius matching the large scale of the moray eel
    const hogfishEatDist = 32 * Math.max(0.75, hogfishScale);
    const gobyEatDist = 28 * Math.max(0.75, gobyScale);

    for (const p of this.parasites) {
      if (p.removed) continue;

      const lp = this.getParasiteLocalPos(p);
      const wx = this.pos.x + lp.x;
      const wy = this.pos.y + lp.y;

      let isHovered = false;

      // Check Hogfish
      if (hogfishMouth) {
        const dHogfish = Math.hypot(wx - hogfishMouth.x, wy - hogfishMouth.y);
        if (dHogfish < hogfishEatDist) isHovered = true;
      }

      // Check Goby
      if (gobyMouth && !isHovered) {
        const dGoby = Math.hypot(wx - gobyMouth.x, wy - gobyMouth.y);
        if (dGoby < gobyEatDist) isHovered = true;
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

    if (this.extension < 0.25) return spots;

    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);

    const transform = (lx: number, ly: number) => ({
      x: this.pos.x + (lx * cosH - ly * sinH) * s,
      y: this.pos.y + (lx * sinH + ly * cosH) * s,
    });

    // Huge open mouth & Needle fangs
    spots.push({
      id: 'mouth',
      name: 'Open Mouth & Needle Fangs',
      pos: transform(32, 2),
    });

    // Snout Tip & Tubular Nostrils
    spots.push({
      id: 'nostrils',
      name: 'Snout & Tubular Nostrils',
      pos: transform(40, -8),
    });

    // Eye & Cranial Crest
    spots.push({
      id: 'head',
      name: 'Cranial Crest & Eye',
      pos: transform(15, -14),
    });

    // Throat & Branchial Pore
    spots.push({
      id: 'throat',
      name: 'Throat & Gill Pore',
      pos: transform(-5, 8),
    });

    // Muscular Sinuous Spotted Neck
    spots.push({
      id: 'neck',
      name: 'Spotted Neck',
      pos: transform(-28, -2),
    });

    return spots;
  }

  public getActiveParasitePositions(): Vector2D[] {
    if (this.extension < 0.2) return [];
    return this.parasites
      .filter((p) => !p.removed)
      .map((p) => {
        const lp = this.getParasiteLocalPos(p);
        return { x: this.pos.x + lp.x, y: this.pos.y + lp.y };
      });
  }

  public hitTest(pt: Vector2D): boolean {
    const s = this.scale;
    const cosH = Math.cos(this.heading);
    const sinH = Math.sin(this.heading);
    const hx = this.pos.x + 28 * s * cosH;
    const hy = this.pos.y + 28 * s * sinH;
    if (Math.hypot(pt.x - hx, pt.y - hy) < 95) return true;

    const minX = this.pos.x - 70 * s;
    const maxX = this.pos.x + 55 * s;
    const minY = this.pos.y - 45 * s;
    const maxY = this.pos.y + 45 * s;

    return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
  }

  /**
   * Main Render Dispatcher
   * Rendered behind the coral reef wall: only the eel is drawn without any artificial rock overlays,
   * so the reef naturally occludes the hidden posterior 85% of its serpentine body.
   */
  public render(ctx: CanvasRenderingContext2D) {
    if (!this.isVisible || this.extension <= 0.01) return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    this.renderProfile(ctx);

    ctx.restore();
  }

  /**
   * Lateral Profile Render: Curved & Snake-like Spotted Moray (Gymnothorax moringa)
   * Focuses on the expressive, sinuous anterior ~15–20%:
   * - Serpentine S-curved arched spine and undulating muscular neck
   * - Continuous flowing dorsal fin ribbon with pale golden margin
   * - Huge gaping predatory jaws (upper rostrum + lower mandible)
   * - Needle-sharp fang teeth
   * - Small beady eye & tubular anterior nostrils
   * - Cream/pale tan ground with organic dark chocolate leopard spots
   */
  private renderProfile(ctx: CanvasRenderingContext2D) {
    const s = this.scale;
    const breath = Math.sin(this.breathPhase) * 1.5;
    const snakeWave = Math.sin(this.animTime * 1.6) * 3.5;

    ctx.save();
    ctx.rotate(this.heading);

    // 1. Serpentine Continuous Dorsal Fin Ribbon along the wavy nape & deep spine
    this.renderDorsalFinRidge(ctx, s, snakeWave);

    // 2. Sinuous Muscular Snake-like Neck & Arched Cranium Body Mass
    this.renderMoraySnakeBody(ctx, s, breath, snakeWave);

    // 3. Huge Open Mouth & Cavernous Oral Cavity with Needle Teeth
    this.renderJawsAndTeeth(ctx, s);

    // 4. Soft Anatomical Low-Poly Facet Planes
    this.renderAnatomicalPlanes(ctx, s);

    // 5. Dense Leopard Spots / Dark Rosettes Pattern following the curve
    this.renderLeopardSpots(ctx, s, snakeWave);

    // 6. Tubular Anterior Nostrils on tip of snout
    this.renderTubularNostrils(ctx, s);

    // 7. Small Beady Golden-Amber Eye
    this.renderSmallEye(ctx, s);

    // 8. Dark Branchial / Gill Pore Aperture
    this.renderGillPore(ctx, s);

    // 9. Parasites & Progress Rings
    this.renderParasites(ctx);

    ctx.restore();
  }

  /**
   * Serpentine Continuous Dorsal Fin Ridge starting on the nape and flowing back deep behind the reef
   */
  private renderDorsalFinRidge(ctx: CanvasRenderingContext2D, s: number, snakeWave: number) {
    ctx.save();

    // Sinuous dorsal fin flowing along the undulating S-curved spine
    ctx.beginPath();
    ctx.moveTo(-10 * s, -17.5 * s);
    // Fore-crest arch
    ctx.bezierCurveTo(
      -26 * s,
      (-23 + snakeWave * 0.4) * s,
      -55 * s,
      (-22 - snakeWave * 0.5) * s,
      -85 * s,
      (-20 + snakeWave * 0.6) * s
    );
    // Deep rear extension into the rock crevice
    ctx.bezierCurveTo(
      -110 * s,
      (-18 - snakeWave * 0.4) * s,
      -135 * s,
      (-12 + snakeWave * 0.3) * s,
      -160 * s,
      (-8 + snakeWave * 0.2) * s
    );
    ctx.lineTo(-160 * s, (-2 + snakeWave * 0.2) * s);
    ctx.bezierCurveTo(
      -135 * s,
      (-6 + snakeWave * 0.3) * s,
      -110 * s,
      (-12 - snakeWave * 0.4) * s,
      -85 * s,
      (-14 + snakeWave * 0.6) * s
    );
    ctx.bezierCurveTo(
      -55 * s,
      (-16 - snakeWave * 0.5) * s,
      -26 * s,
      (-18 + snakeWave * 0.4) * s,
      -10 * s,
      -17.5 * s
    );
    ctx.closePath();

    const finGrad = ctx.createLinearGradient(-10 * s, -24 * s, -140 * s, 10 * s);
    finGrad.addColorStop(0.0, 'rgba(254, 240, 138, 0.95)'); // Bright pale golden/cream rim
    finGrad.addColorStop(0.25, 'rgba(250, 204, 21, 0.85)'); // Amber mid
    finGrad.addColorStop(0.65, 'rgba(161, 98, 7, 0.9)'); // Dark chocolate
    finGrad.addColorStop(1.0, 'rgba(120, 53, 15, 0.95)'); // Deep sepia

    ctx.fillStyle = finGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Sinuous Muscular Snake-like Neck & Arched Cranium Body Mass
   * Designed with a pronounced serpentine S-curve, deep muscular tapers, and organic undulation
   */
  private renderMoraySnakeBody(
    ctx: CanvasRenderingContext2D,
    s: number,
    breath: number,
    snakeWave: number
  ) {
    ctx.save();

    ctx.beginPath();
    ctx.moveTo(42 * s, -5 * s);

    // 1. Snout & High Arched Cranium
    ctx.bezierCurveTo(34 * s, -11 * s, 22 * s, -16.5 * s, 8 * s, -18 * s);
    // 2. High Muscular Occipital Crest arching back
    ctx.bezierCurveTo(
      -8 * s,
      (-20 + snakeWave * 0.3) * s,
      -30 * s,
      (-19 - snakeWave * 0.4) * s,
      -55 * s,
      (-16 + snakeWave * 0.5) * s
    );
    // 3. Serpentine S-curved Spine extending deep behind reef
    ctx.bezierCurveTo(
      -80 * s,
      (-13 - snakeWave * 0.6) * s,
      -115 * s,
      (-8 + snakeWave * 0.4) * s,
      -160 * s,
      (-4 + snakeWave * 0.2) * s
    );

    // 4. Rear trunk depth cut-off
    ctx.lineTo(-160 * s, (16 + snakeWave * 0.2) * s);

    // 5. Sinuous Undulating Ventral Belly & Lower Spine
    ctx.bezierCurveTo(
      -115 * s,
      (14 + snakeWave * 0.4) * s,
      -80 * s,
      (12 - snakeWave * 0.6) * s,
      -55 * s,
      (10 + snakeWave * 0.5) * s
    );
    // 6. Muscular Swollen Throat & Buccal Jowls (breathing expansion)
    ctx.bezierCurveTo(
      -32 * s,
      (12 + breath * 0.3 - snakeWave * 0.4) * s,
      -15 * s,
      (16 + breath * 0.5 + snakeWave * 0.3) * s,
      0,
      (14 + breath * 0.3) * s
    );
    // 7. Lower Jaw Hinge to Mandible
    ctx.bezierCurveTo(14 * s, 9 * s, 26 * s, 8 * s, 36 * s, 6 * s);

    // 8. Closure back to snout tip
    ctx.lineTo(42 * s, -5 * s);
    ctx.closePath();

    // Multi-stop Cream/Tan Warm Ivory to Rich Ochre Base Gradient
    const bodyGrad = ctx.createLinearGradient(42 * s, -16 * s, -120 * s, 20 * s);
    bodyGrad.addColorStop(0.0, '#fefce8'); // Pale cream/tan snout
    bodyGrad.addColorStop(0.18, '#fde68a'); // Warm ivory cheek
    bodyGrad.addColorStop(0.4, '#fbbf24'); // Golden ochre cranium
    bodyGrad.addColorStop(0.65, '#f59e0b'); // Warm tan/amber neck
    bodyGrad.addColorStop(0.85, '#b45309'); // Rich sepia trunk
    bodyGrad.addColorStop(1.0, '#78350f'); // Deep crevice trunk

    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.5)';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Ventral Throat Soft Pale Glow & Muscular Jowl Shading
    const throatGrad = ctx.createLinearGradient(0, -12 * s, 0, 16 * s);
    throatGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.12)');
    throatGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.04)');
    throatGrad.addColorStop(1.0, 'rgba(254, 243, 199, 0.45)');
    ctx.fillStyle = throatGrad;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Huge Gaping Mouth, Cavernous Oral Cavity, and Needle-sharp Fangs
   */
  private renderJawsAndTeeth(ctx: CanvasRenderingContext2D, s: number) {
    const aperture = this.mouthAperture;

    ctx.save();

    // 1. Cavernous Deep Purple/Burgundy Oral Cavity
    ctx.beginPath();
    ctx.moveTo(15 * s, -1 * s); // Jaw hinge point
    ctx.lineTo(40 * s, -3 * s - (aperture - 1.0) * 2 * s); // Upper jaw tip
    ctx.lineTo(37 * s, 6 * s + (aperture - 1.0) * 6 * s); // Lower jaw tip
    ctx.closePath();

    const mouthGrad = ctx.createLinearGradient(15 * s, 0, 40 * s, 0);
    mouthGrad.addColorStop(0.0, '#2e1065'); // Deep dark violet throat
    mouthGrad.addColorStop(0.6, '#4c0519'); // Dark crimson oral mucosa
    mouthGrad.addColorStop(1.0, '#881337'); // Fleshy mouth margin

    ctx.fillStyle = mouthGrad;
    ctx.fill();
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 2. Lower Jaw (Dentary Mandible) with dynamic opening motion
    ctx.save();
    ctx.translate(15 * s, 2 * s);
    ctx.rotate((aperture - 1.0) * 0.18);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(10 * s, 2 * s, 20 * s, 3 * s, 23 * s, 4 * s);
    ctx.bezierCurveTo(20 * s, 7 * s, 8 * s, 7 * s, 0, 4 * s);
    ctx.closePath();

    ctx.fillStyle = '#fde68a';
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Lower Needle Teeth (Sharp backward-curving fangs)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 0.5;

    const lowerTeethX = [4, 8, 12, 16, 19, 22];
    for (const tx of lowerTeethX) {
      const toothH = (tx > 14 ? 3.8 : 2.6) * s;
      ctx.beginPath();
      ctx.moveTo((tx - 0.8) * s, 2.2 * s);
      ctx.lineTo((tx - 0.2) * s, 2.2 * s - toothH);
      ctx.lineTo((tx + 0.8) * s, 2.2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // 3. Upper Jaw Needle Teeth & Prominent Vomerine Fangs
    ctx.save();
    ctx.translate(15 * s, -1 * s);
    ctx.rotate(-(aperture - 1.0) * 0.06);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 0.5;

    // Upper dental arch fangs
    const upperTeethX = [6, 10, 14, 18, 21, 24];
    for (const tx of upperTeethX) {
      const toothH = (tx > 16 ? 4.2 : 3.0) * s;
      ctx.beginPath();
      ctx.moveTo((tx - 0.8) * s, -1.8 * s);
      ctx.lineTo((tx - 0.2) * s, -1.8 * s + toothH);
      ctx.lineTo((tx + 0.8) * s, -1.8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Prominent Central Depressible Vomerine Fang (Signature moray trait)
    ctx.beginPath();
    ctx.moveTo(13 * s, -1.5 * s);
    ctx.lineTo(13.5 * s, 3.2 * s);
    ctx.lineTo(15 * s, -1.5 * s);
    ctx.closePath();
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  }

  /**
   * Soft Low-Poly Anatomical Planes
   */
  private renderAnatomicalPlanes(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();

    const planes = [
      // Snout Bridge Plane
      {
        pts: [
          { x: 40 * s, y: -6 * s },
          { x: 26 * s, y: -12 * s },
          { x: 18 * s, y: -6 * s },
          { x: 30 * s, y: -4 * s },
        ],
        col: 'rgba(254, 240, 138, 0.22)',
      },
      // Forehead Muscular Dome
      {
        pts: [
          { x: 26 * s, y: -12 * s },
          { x: 8 * s, y: -16 * s },
          { x: 5 * s, y: -8 * s },
          { x: 18 * s, y: -6 * s },
        ],
        col: 'rgba(245, 158, 11, 0.18)',
      },
      // Muscular Nape Arch
      {
        pts: [
          { x: 8 * s, y: -16 * s },
          { x: -18 * s, y: -16 * s },
          { x: -15 * s, y: -6 * s },
          { x: 5 * s, y: -8 * s },
        ],
        col: 'rgba(217, 119, 6, 0.2)',
      },
      // Cheek / Suborbital Plane
      {
        pts: [
          { x: 18 * s, y: -6 * s },
          { x: 5 * s, y: -8 * s },
          { x: 2 * s, y: 4 * s },
          { x: 16 * s, y: 2 * s },
        ],
        col: 'rgba(253, 224, 71, 0.15)',
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Dense Leopard Spots / Dark Chocolate & Black Mottled Rosettes
   * Follows the serpentine curve along the head, neck, and trunk
   */
  private renderLeopardSpots(ctx: CanvasRenderingContext2D, s: number, snakeWave: number) {
    ctx.save();

    const spots = [
      // Snout Tip & Rostrum
      { x: 38, y: -8, rx: 1.6, ry: 1.2, rot: 0.2 },
      { x: 34, y: -6, rx: 2.2, ry: 1.6, rot: -0.1 },
      { x: 32, y: -10, rx: 1.8, ry: 1.4, rot: 0.3 },
      { x: 28, y: -7, rx: 2.4, ry: 1.8, rot: 0.0 },

      // Forehead & Cranium
      { x: 24, y: -13, rx: 2.8, ry: 2.0, rot: -0.2 },
      { x: 18, y: -14, rx: 3.2, ry: 2.2, rot: 0.1 },
      { x: 12, y: -15, rx: 3.4, ry: 2.4, rot: -0.3 },
      { x: 4, y: -15.5, rx: 3.6, ry: 2.5, rot: 0.2 },
      { x: -4, y: -15, rx: 3.8, ry: 2.6, rot: -0.1 },

      // Cheek & Post-orbital Area
      { x: 20, y: -1, rx: 2.5, ry: 1.8, rot: 0.4 },
      { x: 14, y: 1, rx: 3.0, ry: 2.2, rot: -0.2 },
      { x: 8, y: -3, rx: 3.2, ry: 2.4, rot: 0.1 },
      { x: 2, y: 2, rx: 3.5, ry: 2.6, rot: 0.3 },
      { x: -6, y: -2, rx: 3.8, ry: 2.8, rot: -0.2 },

      // Throat & Lower Jaw Margin
      { x: 24, y: 5, rx: 1.8, ry: 1.2, rot: 0.1 },
      { x: 16, y: 6, rx: 2.2, ry: 1.6, rot: -0.3 },
      { x: 6, y: 8, rx: 3.0, ry: 2.0, rot: 0.2 },
      { x: -4, y: 10, rx: 3.4, ry: 2.4, rot: -0.1 },
      { x: -14, y: 11, rx: 3.8, ry: 2.6, rot: 0.3 },

      // Muscular Neck & Visible Sinuous Trunk (Anterior ~15-20%)
      { x: -12, y: -12 + snakeWave * 0.1, rx: 4.2, ry: 3.0, rot: 0.2 },
      { x: -20, y: -14 - snakeWave * 0.15, rx: 4.5, ry: 3.2, rot: -0.1 },
      { x: -28, y: -12 + snakeWave * 0.2, rx: 4.8, ry: 3.5, rot: 0.3 },
      { x: -38, y: -10 - snakeWave * 0.25, rx: 5.0, ry: 3.6, rot: -0.2 },
      { x: -48, y: -8 + snakeWave * 0.3, rx: 5.2, ry: 3.8, rot: 0.1 },
      { x: -58, y: -6 - snakeWave * 0.35, rx: 5.5, ry: 4.0, rot: -0.3 },
      { x: -70, y: -4 + snakeWave * 0.4, rx: 5.8, ry: 4.2, rot: 0.2 },
      { x: -84, y: -2 - snakeWave * 0.45, rx: 6.0, ry: 4.4, rot: -0.1 },
      { x: -98, y: 0 + snakeWave * 0.5, rx: 6.2, ry: 4.6, rot: 0.3 },
      { x: -115, y: 2 - snakeWave * 0.55, rx: 6.5, ry: 4.8, rot: -0.2 },

      { x: -16, y: -3 + snakeWave * 0.1, rx: 4.0, ry: 3.0, rot: -0.2 },
      { x: -26, y: -2 - snakeWave * 0.15, rx: 4.6, ry: 3.4, rot: 0.1 },
      { x: -36, y: 0 + snakeWave * 0.2, rx: 5.0, ry: 3.6, rot: -0.3 },
      { x: -46, y: 2 - snakeWave * 0.25, rx: 5.2, ry: 3.8, rot: 0.2 },
      { x: -56, y: 4 + snakeWave * 0.3, rx: 5.5, ry: 4.0, rot: -0.1 },
      { x: -68, y: 5 - snakeWave * 0.35, rx: 5.8, ry: 4.2, rot: 0.2 },
      { x: -80, y: 6 + snakeWave * 0.4, rx: 6.0, ry: 4.4, rot: -0.2 },
      { x: -95, y: 7 - snakeWave * 0.45, rx: 6.2, ry: 4.5, rot: 0.1 },

      { x: -24, y: 8 + snakeWave * 0.1, rx: 4.2, ry: 2.8, rot: 0.3 },
      { x: -34, y: 7 - snakeWave * 0.15, rx: 4.5, ry: 3.0, rot: -0.2 },
      { x: -44, y: 8 + snakeWave * 0.2, rx: 4.8, ry: 3.2, rot: 0.1 },
      { x: -54, y: 9 - snakeWave * 0.25, rx: 5.0, ry: 3.5, rot: -0.3 },
      { x: -66, y: 9 + snakeWave * 0.3, rx: 5.4, ry: 3.8, rot: 0.2 },
      { x: -80, y: 10 - snakeWave * 0.35, rx: 5.6, ry: 4.0, rot: -0.1 },
      { x: -96, y: 11 + snakeWave * 0.4, rx: 6.0, ry: 4.2, rot: 0.3 },
    ];

    for (const sp of spots) {
      ctx.save();
      ctx.translate(sp.x * s, sp.y * s);
      ctx.rotate(sp.rot);

      ctx.beginPath();
      ctx.ellipse(0, 0, sp.rx * s, sp.ry * s, 0, 0, Math.PI * 2);

      const spotGrad = ctx.createRadialGradient(0, 0, 0.2 * s, 0, 0, sp.rx * s);
      spotGrad.addColorStop(0.0, '#0c0a09'); // Black center
      spotGrad.addColorStop(0.7, '#292524'); // Dark chocolate
      spotGrad.addColorStop(1.0, '#451a03'); // Sepia rim

      ctx.fillStyle = spotGrad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(254, 240, 138, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Tubular Anterior Nostrils (Fleshy protruding tubes on tip of snout)
   */
  private renderTubularNostrils(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    ctx.translate(41 * s, -8.5 * s);

    // Flared tube projecting forward-upward
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(2 * s, -1 * s, 3.5 * s, -2.5 * s, 4.5 * s, -3.2 * s);
    ctx.bezierCurveTo(4.2 * s, -1.8 * s, 2.8 * s, 0.5 * s, 0.8 * s, 1.2 * s);
    ctx.closePath();

    ctx.fillStyle = '#fde68a';
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Dark pore orifice at tip of tube
    ctx.beginPath();
    ctx.ellipse(4.2 * s, -2.8 * s, 0.8 * s, 0.5 * s, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Small Beady Golden-Amber Eye (Positioned high and forward)
   */
  private renderSmallEye(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    ctx.translate(24 * s, -9.5 * s);

    // Dark orbital rim
    ctx.beginPath();
    ctx.arc(0, 0, 3.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1917';
    ctx.fill();

    // Glowing Golden Amber Iris
    const irisGrad = ctx.createRadialGradient(-0.4 * s, -0.4 * s, 0.3 * s, 0, 0, 2.8 * s);
    irisGrad.addColorStop(0.0, '#fef08a');
    irisGrad.addColorStop(0.5, '#eab308');
    irisGrad.addColorStop(1.0, '#78350f');

    ctx.beginPath();
    ctx.arc(0, 0, 2.8 * s, 0, Math.PI * 2);
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Dark Pupil
    ctx.beginPath();
    ctx.arc(0.2 * s, 0, 1.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();

    // Specular Glint
    ctx.beginPath();
    ctx.arc(-0.6 * s, -0.6 * s, 0.6 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Dark Branchial / Gill Pore Aperture
   */
  private renderGillPore(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    ctx.translate(-14 * s, 2 * s);

    // Iconic dark circular blotch around branchial pore
    ctx.beginPath();
    ctx.arc(0, 0, 4.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1917';
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Pore orifice
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.8 * s, 2.6 * s, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Parasites and removal animations
   */
  protected renderParasites(ctx: CanvasRenderingContext2D) {
    const s = this.scale;

    for (const p of this.parasites) {
      const loc = this.getParasiteLocalUnrotated(p);

      if (p.removed) {
        if (p.hoverTimer > 0) {
          ctx.save();
          ctx.translate(loc.x, loc.y);
          drawEatRing(ctx, parasiteUnit(s), p.hoverTimer);
          ctx.restore();
          p.hoverTimer -= 0.02;
        }
        continue;
      }

      ctx.save();
      ctx.translate(loc.x, loc.y);

      // Cleaned progress glow ring
      if (p.hoverTimer > 0) {
        const prog = clamp(p.hoverTimer / (p.type === 'teeth' ? 0.35 : 0.45), 0, 1);
        ctx.beginPath();
        ctx.arc(0, 0, 6.0 * (s / 3.8), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + prog * 0.6})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      drawParasite(ctx, parasiteUnit(s), this.animTime, p.id, p.type === 'teeth');

      ctx.restore();
    }
  }
}

import { Vector2D, Parasite } from '../types';
import { lerp } from '../utils/math';
import { parasiteUnit, drawParasite, drawEatRing } from './parasiteFx';

export interface CleaningTargetSpot {
  id: string;
  name: string;
  pos: Vector2D;
}

export interface GruntMember {
  id: number;
  offsetX: number; // in unscaled coordinates relative to school center
  offsetY: number;
  scaleMult: number; // relative size multiplier for perspective & distinction
  depthOrder: number; // 1 = background, 2 = midground, 3 = foreground
  breathPhaseOffset: number;
  finPhaseOffset: number;
  swayPhaseOffset: number;
}

/**
 * French Grunt School (Haemulon flavolineatum - Group of 3)
 *
 * Distinctly visible schooling trio:
 * - Member 0 (Leader / Front-Center): At the head of the school formation
 * - Member 1 (Upper-Trailing): Swimming above and behind, clearly visible in upper water
 * - Member 2 (Lower-Trailing): Swimming below and behind, clearly visible in lower water
 *
 * Each fish features:
 * - Pearlescent silver/cream body with high convex dorsal arch
 * - Vibrant golden-yellow head, snout, and forehead
 * - Distinctive golden-yellow horizontal (lower) and diagonal (upper) stripes
 * - Radiant electric blue facial accent stripes
 * - Large expressive eye with golden iris & black pupil
 * - Small terminal mouth with soft pale lips & scarlet red interior
 * - Translucent yellow dorsal, anal, pelvic, and forked caudal fins
 * - Dedicated parasites distributed across all 3 fish
 * - Schooling arrival into queue together, activation together, cleaning together, and departure together
 */
export class FrenchGrunt {
  public pos: Vector2D = { x: 0, y: 0 };
  public targetPos: Vector2D = { x: 0, y: 0 };
  public heading: number = Math.PI;

  public scale: number = 2.04;

  public state: 'entering' | 'stationary' | 'exiting' | 'exited' = 'entering';
  public entrySpeed: number = 2.7;
  public exitSpeed: number = 3.3;

  public animTime: number = 0;
  public breathPhase: number = 0;
  public finPhase: number = 0;
  public mouthAperture: number = 0.8;

  public isVisible: boolean = true;
  public facingPlayer: boolean = false;
  public turnProgress: number = 0;

  // Parasites distributed across all 3 fish in the school
  public parasites: Parasite[] = [];

  // Cavity gates driven by ClientDirector
  public gillOpen: number = 1;
  public mouthGate: number = 1;

  // The 3 distinctly visible school members
  public readonly members: GruntMember[] = [
    // Member 0: Lead fish (out in front, center-low)
    {
      id: 0,
      offsetX: -26,
      offsetY: -3,
      scaleMult: 1.0,
      depthOrder: 3,
      breathPhaseOffset: 0,
      finPhaseOffset: 0,
      swayPhaseOffset: 0,
    },
    // Member 1: Upper-trailing fish (visible above and behind leader)
    {
      id: 1,
      offsetX: 28,
      offsetY: -36,
      scaleMult: 0.92,
      depthOrder: 1,
      breathPhaseOffset: 1.7,
      finPhaseOffset: 1.4,
      swayPhaseOffset: 2.1,
    },
    // Member 2: Lower-trailing fish (visible below and behind leader)
    {
      id: 2,
      offsetX: 22,
      offsetY: 34,
      scaleMult: 0.95,
      depthOrder: 2,
      breathPhaseOffset: 3.5,
      finPhaseOffset: 2.9,
      swayPhaseOffset: 4.2,
    },
  ];

  constructor(canvasWidth: number, canvasHeight: number) {
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
   * Initializes parasites across all 3 fish members.
   * Each fish receives between 10 and 12 parasites, for a total of between 30 and 36 across the school.
   */
  private initParasites() {
    this.parasites = [];
    let idCounter = 500;

    // Anatomical site templates for a French Grunt
    const teethSites: Array<{ type: 'teeth'; localX: number; localY: number; attachPart: 'upperTeeth' | 'lowerTeeth' }> = [
      { type: 'teeth', localX: -33.5, localY: 1.2, attachPart: 'upperTeeth' },
      { type: 'teeth', localX: -32.5, localY: 2.6, attachPart: 'lowerTeeth' },
      { type: 'teeth', localX: -31.6, localY: 2.0, attachPart: 'lowerTeeth' },
    ];

    const operculumSites: Array<{ type: 'body'; localX: number; localY: number; attachPart: 'operculum' }> = [
      { type: 'body', localX: -14.0, localY: -1.5, attachPart: 'operculum' },
      { type: 'body', localX: -13.0, localY: 3.2, attachPart: 'operculum' },
      { type: 'body', localX: -15.2, localY: 1.0, attachPart: 'operculum' },
    ];

    const bellySites: Array<{ type: 'body'; localX: number; localY: number; attachPart: 'belly' }> = [
      { type: 'body', localX: -5.5, localY: 8.5, attachPart: 'belly' },
      { type: 'body', localX: 3.2, localY: 10.2, attachPart: 'belly' },
      { type: 'body', localX: 11.5, localY: 7.2, attachPart: 'belly' },
    ];

    const bodyFlankSites: Array<{ type: 'body'; localX: number; localY: number; attachPart: 'body' }> = [
      { type: 'body', localX: -22.0, localY: -10.5, attachPart: 'body' }, // forehead
      { type: 'body', localX: -17.0, localY: -13.0, attachPart: 'body' }, // crown
      { type: 'body', localX: -9.0, localY: -14.5, attachPart: 'body' },  // upper anterior
      { type: 'body', localX: 1.0, localY: -13.5, attachPart: 'body' },   // upper dorsal
      { type: 'body', localX: 11.0, localY: -11.0, attachPart: 'body' },  // upper rear
      { type: 'body', localX: -4.0, localY: -3.5, attachPart: 'body' },   // mid flank
      { type: 'body', localX: 4.0, localY: -1.0, attachPart: 'body' },    // mid center
      { type: 'body', localX: 13.0, localY: 0.5, attachPart: 'body' },    // mid posterior
      { type: 'body', localX: 20.5, localY: -4.5, attachPart: 'body' },   // upper peduncle
      { type: 'body', localX: 22.0, localY: 1.5, attachPart: 'body' },    // lower peduncle
    ];

    for (let fishIdx = 0; fishIdx < 3; fishIdx++) {
      // Each fish receives between 10 and 12 parasites
      const targetCount = 10 + Math.floor(Math.random() * 3); // 10, 11, or 12

      const teethPicks = [...teethSites].sort(() => Math.random() - 0.5).slice(0, 2);
      const opercPicks = [...operculumSites].sort(() => Math.random() - 0.5).slice(0, 2);
      const bellyPicks = [...bellySites].sort(() => Math.random() - 0.5).slice(0, 2);
      const remainingNeeded = targetCount - (teethPicks.length + opercPicks.length + bellyPicks.length);
      const flankPicks = [...bodyFlankSites].sort(() => Math.random() - 0.5).slice(0, remainingNeeded);

      const combined = [...teethPicks, ...opercPicks, ...bellyPicks, ...flankPicks];

      for (const site of combined) {
        idCounter++;
        const jitterX = (Math.random() - 0.5) * 0.8;
        const jitterY = (Math.random() - 0.5) * 0.8;
        this.parasites.push({
          id: idCounter,
          type: site.type,
          localX: site.localX + jitterX,
          localY: site.localY + jitterY,
          attachPart: site.attachPart,
          hoverTimer: 0,
          removed: false,
          fishIndex: fishIdx,
        });
      }
    }
  }

  /**
   * Returns member offset position relative to school center (this.pos)
   */
  public getMemberLocalPos(m: GruntMember): Vector2D {
    const s = this.scale;
    const swayX = Math.sin(this.animTime * 1.8 + m.swayPhaseOffset) * 2.2 * s;
    const swayY = Math.cos(this.animTime * 1.5 + m.swayPhaseOffset) * 1.8 * s;
    return {
      x: m.offsetX * s + swayX,
      y: m.offsetY * s + swayY,
    };
  }

  /**
   * World positions for all 3 members (used for sparkles and target AI)
   */
  public getMembersWorldPositions(): Vector2D[] {
    return this.members.map((m) => {
      const local = this.getMemberLocalPos(m);
      return {
        x: this.pos.x + local.x,
        y: this.pos.y + local.y,
      };
    });
  }

  /**
   * Returns parasite local position relative to that specific member's center
   */
  public getParasiteMemberLocalPos(p: Parasite, memberScale: number, memberId: number): Vector2D {
    const mem = this.members[memberId] || this.members[0];
    let lx = p.localX * memberScale;
    let ly = p.localY * memberScale;
    const breath = this.breathPhase + mem.breathPhaseOffset;

    if (p.attachPart === 'lowerTeeth') {
      ly = p.localY * this.mouthAperture * memberScale;
    } else if (p.attachPart === 'belly') {
      ly = p.localY * memberScale + Math.sin(breath) * 1.4;
    } else if (p.attachPart === 'operculum') {
      lx = p.localX * memberScale - Math.sin(breath) * 1.5;
    }
    return { x: lx, y: ly };
  }

  /**
   * Parasite position relative to the school center (this.pos)
   */
  public getParasiteLocalPos(p: Parasite): Vector2D {
    const memberId = p.fishIndex ?? 0;
    const mem = this.members[memberId] || this.members[0];
    const memPos = this.getMemberLocalPos(mem);
    const ms = this.scale * mem.scaleMult;
    const pl = this.getParasiteMemberLocalPos(p, ms, memberId);
    return {
      x: memPos.x + pl.x,
      y: memPos.y + pl.y,
    };
  }

  /**
   * Parasite world position on canvas
   */
  public getParasiteWorldPos(p: Parasite): Vector2D {
    const local = this.getParasiteLocalPos(p);
    return {
      x: this.pos.x + local.x,
      y: this.pos.y + local.y,
    };
  }

  /**
   * Updates parasite eating detection across all 3 fish
   */
  public updateParasites(
    wrasseMouth: Vector2D | null,
    gobiMouth: Vector2D | null,
    _dt: number,
    wrasseScale: number = 0.9,
    gobiScale: number = 0.65
  ) {
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
        if (d <= wrasseEatDist) isEaten = true;
      }

      if (!isEaten && gobiMouth) {
        const d = Math.hypot(wPos.x - gobiMouth.x, wPos.y - gobiMouth.y);
        if (d <= gobiEatDist) isEaten = true;
      }

      if (isEaten) {
        p.removed = true;
        p.hoverTimer = 1;
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

  /**
   * Parasite statistics across ALL fish in the school.
   * Fully cleaned is only achieved when remaining === 0 (all parasites from all 3 fish eaten).
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

  /**
   * Hit test against ANY of the 3 fish in the school
   */
  public hitTest(pos: Vector2D): boolean {
    if (this.state === 'exited' || !this.isVisible) return false;
    for (const m of this.members) {
      const memPos = this.getMemberLocalPos(m);
      const mx = this.pos.x + memPos.x;
      const my = this.pos.y + memPos.y;
      const dx = pos.x - mx;
      const dy = pos.y - my;
      const r = 85 * ((this.scale * m.scaleMult) / 4.5);
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  /**
   * Cleaning spots covering mouth, head, and flank across all 3 fish
   */
  public getCleaningStationSpots(): CleaningTargetSpot[] {
    const spots: CleaningTargetSpot[] = [];
    const memberLabels = ['Lead Grunt', 'Upper Grunt', 'Lower Grunt'];

    this.members.forEach((m, idx) => {
      const memPos = this.getMemberLocalPos(m);
      const ms = this.scale * m.scaleMult;
      const label = memberLabels[idx];

      spots.push(
        {
          id: `grunt-${idx}-mouth`,
          name: `${label} Mouth & Lips`,
          pos: { x: this.pos.x + memPos.x - 33 * ms, y: this.pos.y + memPos.y + 2 * ms },
        },
        {
          id: `grunt-${idx}-head`,
          name: `${label} Golden Head & Operculum`,
          pos: { x: this.pos.x + memPos.x - 18 * ms, y: this.pos.y + memPos.y - 4 * ms },
        },
        {
          id: `grunt-${idx}-stripes`,
          name: `${label} Striped Flanks`,
          pos: { x: this.pos.x + memPos.x + 6 * ms, y: this.pos.y + memPos.y - 1 * ms },
        }
      );
    });

    return spots;
  }

  public update(_canvasWidth: number, _canvasHeight: number, dt: number) {
    this.animTime += dt * 0.038;
    this.breathPhase += dt * 0.048;
    this.finPhase += dt * 0.12;

    // Small mouth rhythmic pulsing
    this.mouthAperture = 0.75 + Math.sin(this.breathPhase * 1.4) * 0.25;
    this.turnProgress = 0;
    this.facingPlayer = false;
  }

  /**
   * Main Render Dispatcher:
   * Renders the 3 fish sorted by depthOrder (background to foreground)
   */
  public render(ctx: CanvasRenderingContext2D) {
    if (!this.isVisible || this.state === 'exited') return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // Sort: Member 1 (Upper-trailing, background) -> Member 2 (Lower-trailing) -> Member 0 (Leader, foreground)
    const sortedMembers = [...this.members].sort((a, b) => a.depthOrder - b.depthOrder);
    for (const mem of sortedMembers) {
      this.renderMemberFish(ctx, mem);
    }

    ctx.restore();
  }

  /**
   * Renders an individual French Grunt in the school formation
   */
  private renderMemberFish(ctx: CanvasRenderingContext2D, mem: GruntMember) {
    const memPos = this.getMemberLocalPos(mem);
    const s = this.scale * mem.scaleMult;
    const breath = this.breathPhase + mem.breathPhaseOffset;
    const breathOffset = Math.sin(breath) * 1.6;
    const finWave = Math.sin(this.finPhase + mem.finPhaseOffset);

    ctx.save();
    ctx.translate(memPos.x, memPos.y);

    // 1. Spiny & Soft Dorsal Fin
    this.renderDorsalFin(ctx, s, finWave);

    // 2. Anal Fin
    this.renderAnalFin(ctx, s, finWave);

    // 3. Caudal Tail
    this.renderCaudalFin(ctx, s, finWave, mem.swayPhaseOffset);

    // 4. Pelvic Fin
    this.renderPelvicFin(ctx, s, finWave);

    // 5. Main Deep Body Profile with operculum and inner gill filament slit
    this.renderMainBody(ctx, s, breathOffset);

    // 6. Yellow Horizontal & Diagonal Stripes on Flanks
    this.renderYellowBodyStripes(ctx, s);

    // 7. Electric Blue / Slate-Gray Facial Accent Markings
    this.renderFacialMarkings(ctx, s);

    // 8. Large Expressive Eye
    this.renderLargeExpressiveEye(ctx, s);

    // 9. Small Grunt Mouth & Scarlet Red Gape
    this.renderSmallMouth(ctx, s);

    // 10. Translucent Yellow Pectoral Fin
    this.renderPectoralFin(ctx, s, finWave);

    // 11. Parasites belonging to this specific member
    this.renderMemberParasites(ctx, mem.id, s);

    ctx.restore();
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
    dGrad.addColorStop(0, 'rgba(255, 215, 0, 0.92)');
    dGrad.addColorStop(0.5, 'rgba(240, 190, 40, 0.78)');
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
    aGrad.addColorStop(0, 'rgba(255, 215, 0, 0.88)');
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
  private renderCaudalFin(
    ctx: CanvasRenderingContext2D,
    s: number,
    _finWave: number,
    phaseOffset: number
  ) {
    ctx.save();
    const sway = Math.sin(this.animTime * 1.6 + phaseOffset) * 3.5;

    ctx.beginPath();
    ctx.moveTo(34 * s, -8 * s);
    ctx.bezierCurveTo(46 * s, -18 * s + sway, 56 * s, -16 * s + sway, 58 * s, -12 * s + sway);
    ctx.bezierCurveTo(50 * s, -4 * s + sway, 46 * s, 0 + sway, 44 * s, 0 + sway);
    ctx.bezierCurveTo(46 * s, 0 + sway, 50 * s, 4 * s + sway, 58 * s, 12 * s + sway);
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
    ctx.fillStyle = 'rgba(255, 215, 0, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 240, 120, 0.8)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Main Deep Body Profile:
   * Anatomical deep-bodied oval shape, convex forehead, silver/cream ground with golden head
   */
  private renderMainBody(ctx: CanvasRenderingContext2D, s: number, breathOffset: number) {
    ctx.save();

    // Contour path of deep-bodied French Grunt
    ctx.beginPath();
    ctx.moveTo(-33 * s, 1.5 * s);
    ctx.bezierCurveTo(-28 * s, -8 * s, -22 * s, -16 * s, -16 * s, -19 * s);
    ctx.bezierCurveTo(-4 * s, -23 * s, 12 * s, -21 * s, 22 * s, -15 * s);
    ctx.bezierCurveTo(28 * s, -11 * s, 32 * s, -8 * s, 34 * s, -8 * s);
    ctx.lineTo(34 * s, 8 * s);
    ctx.bezierCurveTo(32 * s, 8 * s, 28 * s, 11 * s, 20 * s, 14 * s);
    ctx.bezierCurveTo(8 * s, 19 * s + breathOffset, -10 * s, 18 * s + breathOffset, -22 * s, 11 * s);
    ctx.bezierCurveTo(-27 * s, 7 * s, -31 * s, 4 * s, -33 * s, 3.5 * s);
    ctx.closePath();

    // Golden yellow head blending into shimmering silver/cream flanks
    const bodyGrad = ctx.createLinearGradient(-33 * s, -10 * s, 34 * s, 10 * s);
    bodyGrad.addColorStop(0, '#ffd43b');
    bodyGrad.addColorStop(0.24, '#f7c948');
    bodyGrad.addColorStop(0.42, '#f1f5f9');
    bodyGrad.addColorStop(0.7, '#e2e8f0');
    bodyGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Specular highlight along upper back
    const dorsalSheen = ctx.createLinearGradient(0, -22 * s, 0, 0);
    dorsalSheen.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    dorsalSheen.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = dorsalSheen;
    ctx.fill();

    // Anatomical edge stroke
    ctx.strokeStyle = 'rgba(230, 200, 100, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Inner gill filament slit when operculum opens for cleaning
    if (this.gillOpen > 0.05) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(-13 * s, 2 * s, 2.8 * s, 7.5 * s * Math.min(1, this.gillOpen), 0.15, 0, Math.PI * 2);
      ctx.fillStyle = '#450a0a';
      ctx.fill();
      // Crimson filament combs
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.0;
      for (let g = -3; g <= 3; g++) {
        ctx.beginPath();
        ctx.moveTo(-14 * s, (2 + g * 1.8) * s);
        ctx.lineTo(-11 * s, (2.5 + g * 1.8) * s);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Operculum (gill cover) smooth curve
    ctx.beginPath();
    ctx.arc(-13 * s, 2 * s, 9 * s, -1.2, 0.9);
    ctx.strokeStyle = 'rgba(210, 170, 40, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Yellow Horizontal & Diagonal Stripes on Body:
   * Diagnostic feature of Haemulon flavolineatum
   */
  private renderYellowBodyStripes(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();

    // Oblique diagonal stripes above lateral line
    ctx.strokeStyle = '#f59e0b';
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

    // Strong horizontal stripes below lateral line
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
   * Electric Blue / Slate-Gray Facial Markings:
   * Diagnostic electric blue stripes wrapping snout and eye
   */
  private renderFacialMarkings(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();

    ctx.strokeStyle = '#38bdf8';
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
   * Large Expressive-Looking Eye
   */
  private renderLargeExpressiveEye(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    const ex = -20 * s;
    const ey = -4 * s;
    const er = 5.2 * s;

    // Orbital socket ring
    ctx.beginPath();
    ctx.arc(ex, ey, er + 1.6 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ca8a04';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Eyeball / Iris
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(ex - 1 * s, ey - 1 * s, 0.6 * s, ex, ey, er);
    irisGrad.addColorStop(0, '#fef08a');
    irisGrad.addColorStop(0.5, '#eab308');
    irisGrad.addColorStop(0.85, '#ca8a04');
    irisGrad.addColorStop(1, '#713f12');
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(ex, ey, er * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();

    // Specular corneal glint
    ctx.beginPath();
    ctx.arc(ex - 1.5 * s, ey - 1.5 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fill();

    // Secondary reflection
    ctx.beginPath();
    ctx.arc(ex + 1.2 * s, ey + 1.2 * s, 0.8 * s, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Relatively Small Grunt Mouth & Pale Lips with Scarlet Red Interior
   */
  private renderSmallMouth(ctx: CanvasRenderingContext2D, s: number) {
    ctx.save();
    const aperture = this.mouthAperture;

    // Fleshy pale lips
    ctx.beginPath();
    ctx.ellipse(-33 * s, 2.5 * s, 2.8 * s, 3.2 * s, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#fed7aa';
    ctx.fill();
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Scarlet interior mouth lining
    ctx.beginPath();
    ctx.ellipse(-33.5 * s, 2.5 * s, 1.4 * s, 2.2 * s * aperture, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();

    // Delicate incisor teeth
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
   * Pectoral Fin: Translucent golden-yellow fan fin
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

    ctx.fillStyle = 'rgba(255, 215, 0, 0.72)';
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
   * Parasite Rendering for a specific member fish
   */
  private renderMemberParasites(ctx: CanvasRenderingContext2D, memberId: number, s: number) {
    const unit = parasiteUnit(s);
    for (const p of this.parasites) {
      if ((p.fishIndex ?? 0) !== memberId) continue;
      const local = this.getParasiteMemberLocalPos(p, s, memberId);
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
}

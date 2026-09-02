import { Vector2D, FishSegment, FishConfig } from '../types';
import { dist, angleDiff, lerp, clamp, normalizeAngle } from '../utils/math';

interface FacetTriangle {
  p1: Vector2D;
  p2: Vector2D;
  p3: Vector2D;
  color: string;
  strokeColor?: string;
}

export class CleanerWrasse {
  public segments: FishSegment[] = [];
  public headPos: Vector2D = { x: 0, y: 0 };
  public heading: number = 0;
  public speed: number = 0;
  public targetSpeed: number = 2.8;
  public swimPhase: number = 0;
  public finPhase: number = 0;

  public isRunning: boolean = true;
  public behaviorMode: 'cruise' | 'dart' | 'dance' | 'hover' | 'follow' | 'clean' = 'cruise';
  public modeTimer: number = 0;
  public targetPoint: Vector2D = { x: 0, y: 0 };
  public userPointer: Vector2D | null = null;
  public isPointerActive: boolean = false;
  public cleaningSpots: Vector2D[] = [];

  public config: FishConfig = {
    scale: 1.25,
    segmentCount: 16,
    segmentLength: 9.5,
    baseSpeed: 2.8,
    maxSpeed: 5.5,
    turnSpeed: 0.055,
    waveFrequency: 0.20,
    waveAmplitude: 5.0,
  };

  // Anatomical body half-widths matching the reference low-poly cleaner wrasse silhouette
  private bodyRadii: number[] = [
    3.0,  // 0: Snout
    5.6,  // 1: Head / Eye
    8.0,  // 2: Operculum
    9.5,  // 3: Pectoral base / Mid-torso
    10.2, // 4: Anterior dorsal peak
    9.8,  // 5: Mid torso
    8.9,  // 6: Mid-posterior
    7.8,  // 7: Anterior anal fin
    6.6,  // 8: Posterior body
    5.4,  // 9: Posterior body
    4.3,  // 10: Peduncle start
    3.4,  // 11: Caudal peduncle
    2.7,  // 12: Narrow peduncle
    2.1,  // 13: Tail base
    1.6,  // 14: Fin root
    1.2,  // 15: Caudal tip anchor
  ];

  // Natural wandering parameters
  private wanderNoise: number = 0;
  private breathPhase: number = 0;

  constructor(startX: number, startY: number) {
    this.headPos = { x: startX, y: startY };
    this.targetPoint = { x: startX + 150, y: startY };
    this.heading = Math.random() * Math.PI * 2;
    this.speed = this.config.baseSpeed;

    // Initialize spine segments trailing behind the initial heading
    for (let i = 0; i < this.config.segmentCount; i++) {
      const segLen = this.config.segmentLength * this.config.scale;
      const x = startX - Math.cos(this.heading) * (i * segLen);
      const y = startY - Math.sin(this.heading) * (i * segLen);
      const r = (this.bodyRadii[i] || 2.5) * this.config.scale;
      this.segments.push({
        pos: { x, y },
        prevPos: { x, y },
        angle: this.heading,
        width: r,
        height: r * 1.1,
      });
    }
  }

  public stunTimer: number = 0;
  private spitDir: { x: number; y: number } = { x: 0, y: 0 };

  /** Knockback when a client clamps shut on the cleaner - spat out and
   * briefly out of control, exactly like getting chomped deserves. */
  public spit(from: { x: number; y: number }) {
    const dx = this.headPos.x - from.x;
    const dy = this.headPos.y - from.y;
    const d = Math.hypot(dx, dy) || 1;
    this.spitDir = { x: dx / d, y: dy / d };
    this.stunTimer = 48; // ~0.8s in frame units
  }

  public setCleaningSpots(spots: Vector2D[]) {
    this.cleaningSpots = spots;
  }

  public getMouthPos(): Vector2D {
    const s = this.config.scale;
    const angle = this.segments.length > 0 ? this.segments[0].angle : this.heading;
    const base = this.segments.length > 0 ? this.segments[0].pos : this.headPos;
    return {
      x: base.x + Math.cos(angle) * (14 * s),
      y: base.y + Math.sin(angle) * (14 * s),
    };
  }

  public setPointer(pos: Vector2D | null, active: boolean = false) {
    this.userPointer = pos;
    this.isPointerActive = active;
  }

  public toggleRunning(): boolean {
    this.isRunning = !this.isRunning;
    return this.isRunning;
  }

  public setRunning(running: boolean) {
    this.isRunning = running;
  }

  public hitTest(pos: Vector2D): boolean {
    const hitRadius = 45 * this.config.scale;
    if (dist(pos, this.headPos) < hitRadius) return true;
    for (const seg of this.segments) {
      if (dist(pos, seg.pos) < hitRadius) return true;
    }
    return false;
  }

  public update(width: number, height: number, dt: number = 1) {
    if (isNaN(this.headPos.x) || isNaN(this.headPos.y) || isNaN(this.heading)) {
      this.headPos = { x: width / 2, y: height / 2 };
      this.heading = 0;
      this.speed = this.config.baseSpeed;
    }

    const safeDt = clamp(dt, 0.2, 2.0);
    this.modeTimer += safeDt;
    this.breathPhase += 0.04 * safeDt;

    if (!this.isRunning) {
      this.targetSpeed = 0;
      this.speed = lerp(this.speed, 0, 0.06 * safeDt);
      this.finPhase += 0.04 * safeDt;
      this.swimPhase += 0.02 * safeDt;

      this.headPos.y += Math.sin(this.breathPhase * 0.4) * 0.12 * safeDt;
      this.headPos.x += Math.cos(this.breathPhase * 0.25) * 0.06 * safeDt;

      this.updateSpine(safeDt);
      return;
    }

    if (this.stunTimer > 0) {
      // Spat out: tumble away from the clamped jaw, tail thrashing
      this.stunTimer -= safeDt;
      // Tumble: flung heading plus a wobble as it cartwheels away
      this.heading =
        Math.atan2(this.spitDir.y, this.spitDir.x) + Math.sin(this.stunTimer * 0.55) * 0.7;
      const kick = 9 * (this.stunTimer / 48 + 0.25);
      this.headPos.x += this.spitDir.x * kick * safeDt;
      this.headPos.y += this.spitDir.y * kick * safeDt;
      this.swimPhase += 0.35 * safeDt;
      this.finPhase += 0.5 * safeDt;
      this.applyBoundaryRepulsion(width, height, safeDt);
      this.updateSpine(safeDt);
      return;
    }

    this.handleBehavior(width, height, safeDt);

    this.speed = lerp(this.speed, this.targetSpeed, 0.05 * safeDt);

    const speedRatio = Math.max(0.25, this.speed / this.config.baseSpeed);
    this.swimPhase += this.config.waveFrequency * speedRatio * safeDt;
    this.finPhase += (0.18 + speedRatio * 0.32) * safeDt;

    const moveDist = this.speed * safeDt;
    this.headPos.x += Math.cos(this.heading) * moveDist;
    this.headPos.y += Math.sin(this.heading) * moveDist;

    this.applyBoundaryRepulsion(width, height, safeDt);
    this.updateSpine(safeDt);
  }

  private handleBehavior(width: number, height: number, dt: number) {
    if (this.isPointerActive && this.userPointer) {
      this.behaviorMode = 'follow';
      const d = dist(this.headPos, this.userPointer);
      if (d > 35) {
        const targetAngle = Math.atan2(
          this.userPointer.y - this.headPos.y,
          this.userPointer.x - this.headPos.x
        );
        const diff = angleDiff(targetAngle, this.heading);
        const maxTurn = this.config.turnSpeed * 1.4;
        const turnStep = clamp(diff * 0.08, -maxTurn, maxTurn);
        this.heading = normalizeAngle(this.heading + turnStep * dt);
        this.targetSpeed = clamp(d * 0.04, this.config.baseSpeed * 0.8, this.config.maxSpeed);
      } else {
        this.targetSpeed = 0.8;
        const wiggle = Math.sin(this.swimPhase * 1.2) * 0.015;
        this.heading = normalizeAngle(this.heading + wiggle * dt);
      }
      return;
    }

    const modeDuration = this.behaviorMode === 'dart' ? 70 : this.behaviorMode === 'clean' ? 260 : 220 + Math.random() * 180;
    if (this.modeTimer > modeDuration) {
      this.modeTimer = 0;
      const roll = Math.random();

      // If grouper cleaning spots exist, high chance to visit the grouper's mouth or gills!
      if (this.cleaningSpots.length > 0 && roll < 0.38) {
        this.behaviorMode = 'clean';
        const spot = this.cleaningSpots[Math.floor(Math.random() * this.cleaningSpots.length)];
        this.targetPoint = {
          x: spot.x + (Math.random() - 0.5) * 20,
          y: spot.y + (Math.random() - 0.5) * 20,
        };
        this.targetSpeed = this.config.baseSpeed * 0.9;
      } else if (roll < 0.65) {
        this.behaviorMode = 'cruise';
        this.targetSpeed = this.config.baseSpeed * (0.85 + Math.random() * 0.3);
        const pad = 140;
        this.targetPoint = {
          x: pad + Math.random() * Math.max(100, width - pad * 2),
          y: pad + Math.random() * Math.max(100, height - pad * 2),
        };
      } else if (roll < 0.82) {
        this.behaviorMode = 'dart';
        this.targetSpeed = this.config.maxSpeed * (0.8 + Math.random() * 0.2);
        const pad = 140;
        this.targetPoint = {
          x: pad + Math.random() * Math.max(100, width - pad * 2),
          y: pad + Math.random() * Math.max(100, height - pad * 2),
        };
      } else if (roll < 0.93) {
        this.behaviorMode = 'dance';
        this.targetSpeed = 0.9;
      } else {
        this.behaviorMode = 'hover';
        this.targetSpeed = 0.4;
      }
    }

    const maxTurnRate = this.config.turnSpeed;

    switch (this.behaviorMode) {
      case 'clean': {
        const d = dist(this.headPos, this.targetPoint);
        const toTargetAngle = Math.atan2(
          this.targetPoint.y - this.headPos.y,
          this.targetPoint.x - this.headPos.x
        );
        const diff = angleDiff(toTargetAngle, this.heading);

        if (d > 35) {
          // Approach the grouper's mouth or gill
          const turnStep = clamp(diff * 0.05, -maxTurnRate * 1.1, maxTurnRate * 1.1);
          this.heading = normalizeAngle(this.heading + turnStep * dt);
          this.targetSpeed = clamp(d * 0.035, 1.2, this.config.baseSpeed);
        } else {
          // At the cleaning spot: perform characteristic inspection dance & pecks
          this.targetSpeed = 0.6;
          const cleaningDance = Math.sin(this.swimPhase * 1.8) * 0.035;
          this.heading = normalizeAngle(this.heading + cleaningDance * dt);
        }
        break;
      }

      case 'cruise': {
        this.wanderNoise += (Math.random() - 0.5) * 0.08 * dt;
        this.wanderNoise = clamp(this.wanderNoise, -0.4, 0.4);

        const toTargetAngle = Math.atan2(
          this.targetPoint.y - this.headPos.y,
          this.targetPoint.x - this.headPos.x
        );
        const diff = angleDiff(toTargetAngle, this.heading);
        const desiredTurn = diff * 0.03 + this.wanderNoise * 0.02;
        const turnStep = clamp(desiredTurn, -maxTurnRate, maxTurnRate);
        this.heading = normalizeAngle(this.heading + turnStep * dt);

        if (dist(this.headPos, this.targetPoint) < 80) {
          this.modeTimer = 300;
        }
        break;
      }

      case 'dart': {
        const toTargetAngle = Math.atan2(
          this.targetPoint.y - this.headPos.y,
          this.targetPoint.x - this.headPos.x
        );
        const diff = angleDiff(toTargetAngle, this.heading);
        const turnStep = clamp(diff * 0.06, -maxTurnRate * 1.2, maxTurnRate * 1.2);
        this.heading = normalizeAngle(this.heading + turnStep * dt);

        if (this.modeTimer > 40) {
          this.targetSpeed = lerp(this.targetSpeed, this.config.baseSpeed, 0.06 * dt);
        }
        break;
      }

      case 'dance': {
        const danceWiggle = Math.sin(this.swimPhase * 1.4) * 0.025;
        this.heading = normalizeAngle(this.heading + danceWiggle * dt);
        break;
      }

      case 'hover': {
        const gentleDrift = Math.sin(this.breathPhase * 0.8) * 0.008;
        this.heading = normalizeAngle(this.heading + gentleDrift * dt);
        break;
      }
    }
  }

  private applyBoundaryRepulsion(width: number, height: number, dt: number) {
    const margin = 110;
    let pushX = 0;
    let pushY = 0;

    if (this.headPos.x < margin) {
      pushX = (margin - this.headPos.x) / margin;
    } else if (this.headPos.x > width - margin) {
      pushX = -(this.headPos.x - (width - margin)) / margin;
    }

    if (this.headPos.y < margin) {
      pushY = (margin - this.headPos.y) / margin;
    } else if (this.headPos.y > height - margin) {
      pushY = -(this.headPos.y - (height - margin)) / margin;
    }

    const hardPad = 30;
    this.headPos.x = clamp(this.headPos.x, hardPad, width - hardPad);
    this.headPos.y = clamp(this.headPos.y, hardPad, height - hardPad);

    if (pushX !== 0 || pushY !== 0) {
      const avoidAngle = Math.atan2(pushY, pushX);
      const diff = angleDiff(avoidAngle, this.heading);
      const repulsionStrength = Math.min(1.0, Math.hypot(pushX, pushY));
      const turnStep = clamp(diff * 0.08 * repulsionStrength, -0.06, 0.06);
      this.heading = normalizeAngle(this.heading + turnStep * dt);
    }
  }

  private updateSpine(dt: number) {
    this.segments[0].pos.x = this.headPos.x;
    this.segments[0].pos.y = this.headPos.y;
    this.segments[0].angle = this.heading;

    const baseSegLen = this.config.segmentLength * this.config.scale;

    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];

      const dx = curr.pos.x - prev.pos.x;
      const dy = curr.pos.y - prev.pos.y;
      let currentDir = Math.atan2(dy, dx);
      if (isNaN(currentDir)) currentDir = prev.angle + Math.PI;

      const naturalTrailingAngle = prev.angle + Math.PI;
      const deviation = angleDiff(currentDir, naturalTrailingAngle);

      const maxBend = 0.26;
      const clampedDeviation = clamp(deviation, -maxBend, maxBend);
      const jointAngle = naturalTrailingAngle + clampedDeviation;

      const waveProgress = i / (this.segments.length - 1);
      const waveAmpFactor = Math.pow(waveProgress, 1.35);
      const waveFlex = Math.sin(this.swimPhase - i * 0.44) * (this.config.waveAmplitude * 0.038) * waveAmpFactor;
      const effectiveWave = this.speed > 0.08 ? waveFlex : waveFlex * 0.18;

      const finalAngle = jointAngle + effectiveWave;

      curr.pos.x = prev.pos.x + Math.cos(finalAngle) * baseSegLen;
      curr.pos.y = prev.pos.y + Math.sin(finalAngle) * baseSegLen;
      curr.angle = finalAngle - Math.PI;
    }
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

    // 3. Render Caudal Tail Fin (Faceted Sapphire Blue with Notched Margin & Central Black Wedge)
    this.renderLowPolyCaudalFin(ctx, scale, tailAnchor);

    // 4. Render Main Low-Poly Faceted Body (Yellow Forehead + Sky Blue + Deep Black Stripe + White Belly)
    this.renderLowPolyBody(ctx, scale, snoutTip, tailAnchor, topPts, upperMidPts, centerPts, lowerMidPts, bottomPts);

    // 5. Render Pectoral Fin (Translucent faceted fan on flank)
    this.renderLowPolyPectoralFin(ctx, scale);

    // 6. Render Eye & Snout/Mouth Lines matching Reference
    this.renderFacialFeatures(ctx, scale, snoutTip);

    ctx.restore();
  }

  /**
   * Dorsal Fin: Faceted blue arched sail running from segment 3 to 12
   */
  private renderLowPolyDorsalFin(ctx: CanvasRenderingContext2D, scale: number) {
    ctx.save();
    const segStart = 3;
    const segEnd = 12;

    const finTopPts: Vector2D[] = [];
    const finBasePts: Vector2D[] = [];

    for (let i = segStart; i <= segEnd; i++) {
      const seg = this.segments[i];
      const norm = seg.angle + Math.PI / 2;
      const baseR = seg.width;
      
      // Height profile peaking in the middle-anterior section like the reference
      const t = (i - segStart) / (segEnd - segStart);
      const finHeight = (6 + Math.sin(t * Math.PI) * 11) * scale;

      finBasePts.push({
        x: seg.pos.x + Math.cos(norm) * (baseR * 0.9),
        y: seg.pos.y + Math.sin(norm) * (baseR * 0.9),
      });

      finTopPts.push({
        x: seg.pos.x + Math.cos(norm) * (baseR + finHeight),
        y: seg.pos.y + Math.sin(norm) * (baseR + finHeight),
      });
    }

    // Low-poly palette for dorsal fin
    const dorsalColors = [
      '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#38bdf8', '#2563eb', '#1e40af', '#3b82f6', '#60a5fa'
    ];

    for (let i = 0; i < finBasePts.length - 1; i++) {
      const p1 = finBasePts[i];
      const p2 = finTopPts[i];
      const p3 = finTopPts[i + 1];
      const p4 = finBasePts[i + 1];

      // Lower triangle
      this.drawTriangle(ctx, p1, p2, p4, dorsalColors[i % dorsalColors.length], 'rgba(255,255,255,0.15)');
      // Upper triangle
      const col2 = dorsalColors[(i + 1) % dorsalColors.length];
      this.drawTriangle(ctx, p2, p3, p4, col2, 'rgba(255,255,255,0.15)');
    }

    // Outer edge highlight
    ctx.beginPath();
    ctx.moveTo(finBasePts[0].x, finBasePts[0].y);
    for (let i = 0; i < finTopPts.length; i++) {
      ctx.lineTo(finTopPts[i].x, finTopPts[i].y);
    }
    ctx.lineTo(finBasePts[finBasePts.length - 1].x, finBasePts[finBasePts.length - 1].y);
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.4)';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Anal Fin: Ventral rear faceted blue fin
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
      const finHeight = (5 + Math.sin(t * Math.PI) * 7.5) * scale;

      finBasePts.push({
        x: seg.pos.x + Math.cos(norm) * (baseR * 0.9),
        y: seg.pos.y + Math.sin(norm) * (baseR * 0.9),
      });

      finTipPts.push({
        x: seg.pos.x + Math.cos(norm) * (baseR + finHeight),
        y: seg.pos.y + Math.sin(norm) * (baseR + finHeight),
      });
    }

    const analColors = ['#3b82f6', '#2563eb', '#1d4ed8', '#38bdf8', '#2563eb', '#1e40af'];

    for (let i = 0; i < finBasePts.length - 1; i++) {
      const p1 = finBasePts[i];
      const p2 = finTipPts[i];
      const p3 = finTipPts[i + 1];
      const p4 = finBasePts[i + 1];

      this.drawTriangle(ctx, p1, p2, p4, analColors[i % analColors.length], 'rgba(255,255,255,0.12)');
      this.drawTriangle(ctx, p2, p3, p4, analColors[(i + 1) % analColors.length], 'rgba(255,255,255,0.12)');
    }

    ctx.restore();
  }

  /**
   * Pelvic / Ventral Fin: Small pointed faceted fin on belly near segment 4
   */
  private renderLowPolyPelvicFin(ctx: CanvasRenderingContext2D, scale: number) {
    ctx.save();
    const seg = this.segments[4];
    const norm = seg.angle - Math.PI / 2;
    const base1 = {
      x: seg.pos.x + Math.cos(norm) * (seg.width * 0.9),
      y: seg.pos.y + Math.sin(norm) * (seg.width * 0.9),
    };
    const nextSeg = this.segments[5];
    const nextNorm = nextSeg.angle - Math.PI / 2;
    const base2 = {
      x: nextSeg.pos.x + Math.cos(nextNorm) * (nextSeg.width * 0.9),
      y: nextSeg.pos.y + Math.sin(nextNorm) * (nextSeg.width * 0.9),
    };

    // Pointed tip extending backwards & downwards
    const tipAngle = seg.angle - Math.PI / 2 - 0.45;
    const tip = {
      x: base1.x + Math.cos(tipAngle) * (14 * scale),
      y: base1.y + Math.sin(tipAngle) * (14 * scale),
    };

    this.drawTriangle(ctx, base1, tip, base2, '#3b82f6', 'rgba(255,255,255,0.2)');
    ctx.restore();
  }

  /**
   * Caudal (Tail) Fin: Faceted sapphire blue with distinct double notch / emarginate trailing edge
   * and deep black central wedge continuation from reference image.
   */
  private renderLowPolyCaudalFin(ctx: CanvasRenderingContext2D, scale: number, tailAnchor: Vector2D) {
    ctx.save();
    const tailSeg = this.segments[this.segments.length - 1];
    const tailAngle = tailSeg.angle;
    const waveWiggle = Math.sin(this.swimPhase - 5.5) * 0.16;
    const effectiveAngle = tailAngle + Math.PI + waveWiggle;

    const tailLen = 34 * scale;
    const tailSpan = 22 * scale;

    // Tail anchor top & bottom
    const anchorNorm = tailSeg.angle + Math.PI / 2;
    const anchorTop = {
      x: tailAnchor.x + Math.cos(anchorNorm) * (4 * scale),
      y: tailAnchor.y + Math.sin(anchorNorm) * (4 * scale),
    };
    const anchorBottom = {
      x: tailAnchor.x - Math.cos(anchorNorm) * (4 * scale),
      y: tailAnchor.y - Math.sin(anchorNorm) * (4 * scale),
    };

    // Trailing notched points matching reference
    const topOuterCorner = {
      x: tailAnchor.x + Math.cos(effectiveAngle - 0.58) * tailLen,
      y: tailAnchor.y + Math.sin(effectiveAngle - 0.58) * tailLen,
    };
    const topNotch = {
      x: tailAnchor.x + Math.cos(effectiveAngle - 0.28) * (tailLen * 0.88),
      y: tailAnchor.y + Math.sin(effectiveAngle - 0.28) * (tailLen * 0.88),
    };
    const centerTip = {
      x: tailAnchor.x + Math.cos(effectiveAngle) * (tailLen * 0.98),
      y: tailAnchor.y + Math.sin(effectiveAngle) * (tailLen * 0.98),
    };
    const bottomNotch = {
      x: tailAnchor.x + Math.cos(effectiveAngle + 0.28) * (tailLen * 0.88),
      y: tailAnchor.y + Math.sin(effectiveAngle + 0.28) * (tailLen * 0.88),
    };
    const bottomOuterCorner = {
      x: tailAnchor.x + Math.cos(effectiveAngle + 0.58) * tailLen,
      y: tailAnchor.y + Math.sin(effectiveAngle + 0.58) * tailLen,
    };

    // Mid-tail black wedge anchor point
    const blackWedgeTip = {
      x: tailAnchor.x + Math.cos(effectiveAngle) * (tailLen * 0.55),
      y: tailAnchor.y + Math.sin(effectiveAngle) * (tailLen * 0.55),
    };
    const blackWedgeTop = {
      x: tailAnchor.x + Math.cos(effectiveAngle - 0.3) * (tailLen * 0.45),
      y: tailAnchor.y + Math.sin(effectiveAngle - 0.3) * (tailLen * 0.45),
    };
    const blackWedgeBottom = {
      x: tailAnchor.x + Math.cos(effectiveAngle + 0.3) * (tailLen * 0.45),
      y: tailAnchor.y + Math.sin(effectiveAngle + 0.3) * (tailLen * 0.45),
    };

    // 1. Faceted sapphire blue upper tail lobe
    this.drawTriangle(ctx, anchorTop, topOuterCorner, topNotch, '#2563eb', 'rgba(255,255,255,0.18)');
    this.drawTriangle(ctx, anchorTop, topNotch, blackWedgeTop, '#1d4ed8', 'rgba(255,255,255,0.18)');
    this.drawTriangle(ctx, topNotch, centerTip, blackWedgeTip, '#3b82f6', 'rgba(255,255,255,0.18)');
    this.drawTriangle(ctx, topNotch, blackWedgeTop, blackWedgeTip, '#1e40af', 'rgba(255,255,255,0.18)');

    // 2. Faceted sapphire blue lower tail lobe
    this.drawTriangle(ctx, anchorBottom, bottomOuterCorner, bottomNotch, '#1d4ed8', 'rgba(255,255,255,0.18)');
    this.drawTriangle(ctx, anchorBottom, bottomNotch, blackWedgeBottom, '#2563eb', 'rgba(255,255,255,0.18)');
    this.drawTriangle(ctx, bottomNotch, centerTip, blackWedgeTip, '#1e40af', 'rgba(255,255,255,0.18)');
    this.drawTriangle(ctx, bottomNotch, blackWedgeBottom, blackWedgeTip, '#3b82f6', 'rgba(255,255,255,0.18)');

    // 3. Central Black Wedge inside tail (iconic cleaner wrasse marking from reference)
    this.drawTriangle(ctx, tailAnchor, anchorTop, blackWedgeTop, '#05070c', 'rgba(255,255,255,0.1)');
    this.drawTriangle(ctx, tailAnchor, blackWedgeTop, blackWedgeTip, '#0b111e', 'rgba(255,255,255,0.1)');
    this.drawTriangle(ctx, tailAnchor, blackWedgeTip, blackWedgeBottom, '#080d17', 'rgba(255,255,255,0.1)');
    this.drawTriangle(ctx, tailAnchor, anchorBottom, blackWedgeBottom, '#040609', 'rgba(255,255,255,0.1)');

    ctx.restore();
  }

  /**
   * Main Low-Poly Body Mesh:
   * - Forehead / Top Snout: Bright Yellow / Gold band (#facc15 / #eab308) from snout tip to segment 3.
   * - Upper Dorsal Band: Faceted Sky Blue / Cerulean (#38bdf8 / #60a5fa / #0284c7)
   * - Central Horizontal Band: Thick bold deep black stripe (#030712 / #0b1329)
   * - Ventral Belly: Pure faceted white / pale grey (#ffffff / #f1f5f9 / #e2e8f0)
   */
  private renderLowPolyBody(
    ctx: CanvasRenderingContext2D,
    scale: number,
    snoutTip: Vector2D,
    tailAnchor: Vector2D,
    topPts: Vector2D[],
    upperMidPts: Vector2D[],
    centerPts: Vector2D[],
    lowerMidPts: Vector2D[],
    bottomPts: Vector2D[]
  ) {
    ctx.save();

    // --- 1. Snout Forehead & Head Cap (Yellow band on forehead like reference) ---
    // The reference has a distinct yellow ridge starting at the very tip of the upper snout and running along the dorsal crest to the dorsal fin start!
    const yellowPalette = ['#fde047', '#facc15', '#eab308', '#ca8a04'];
    const skyBluePalette = ['#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#2563eb', '#60a5fa', '#93c5fd'];
    const blackPalette = ['#020617', '#090d16', '#0f172a', '#05070c', '#0c121e', '#111827'];
    const whitePalette = ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#e2e8f0'];

    const segCount = this.segments.length;

    // Connect Snout tip to first segment rings
    // Snout to Top (Yellow)
    this.drawTriangle(ctx, snoutTip, topPts[0], topPts[1], yellowPalette[0], 'rgba(255,255,255,0.2)');
    this.drawTriangle(ctx, snoutTip, topPts[1], upperMidPts[1], yellowPalette[1], 'rgba(255,255,255,0.2)');

    // Snout to Center (Black stripe tip)
    this.drawTriangle(ctx, snoutTip, upperMidPts[1], centerPts[1], blackPalette[0], 'rgba(255,255,255,0.15)');
    this.drawTriangle(ctx, snoutTip, centerPts[1], lowerMidPts[1], blackPalette[1], 'rgba(255,255,255,0.15)');

    // Snout to Bottom (White lower jaw)
    this.drawTriangle(ctx, snoutTip, lowerMidPts[1], bottomPts[1], whitePalette[0], 'rgba(0,0,0,0.08)');
    this.drawTriangle(ctx, snoutTip, bottomPts[0], bottomPts[1], whitePalette[1], 'rgba(0,0,0,0.08)');

    // --- 2. Iterate spine rings and create faceted low-poly quad strips ---
    for (let i = 1; i < segCount - 1; i++) {
      // --- LAYER A: Top Dorsal Zone ---
      // For segments 1 to 3, top facet is YELLOW (Forehead crest from reference)
      // For segments >= 4, top facet is SKY BLUE / CYAN
      const isYellowForehead = i <= 3;
      const topCol1 = isYellowForehead
        ? yellowPalette[i % yellowPalette.length]
        : skyBluePalette[(i * 2) % skyBluePalette.length];
      const topCol2 = isYellowForehead
        ? yellowPalette[(i + 1) % yellowPalette.length]
        : skyBluePalette[(i * 2 + 1) % skyBluePalette.length];

      this.drawTriangle(ctx, topPts[i], topPts[i + 1], upperMidPts[i], topCol1, 'rgba(255,255,255,0.2)');
      this.drawTriangle(ctx, topPts[i + 1], upperMidPts[i + 1], upperMidPts[i], topCol2, 'rgba(255,255,255,0.2)');

      // --- LAYER B: Upper Blue Stripe Zone (Between Top and Black stripe) ---
      // For head, this is bright cyan blue; for body, cerulean blue
      const blueCol1 = skyBluePalette[(i + 1) % skyBluePalette.length];
      const blueCol2 = skyBluePalette[(i + 2) % skyBluePalette.length];
      this.drawTriangle(ctx, upperMidPts[i], upperMidPts[i + 1], centerPts[i], blueCol1, 'rgba(255,255,255,0.18)');
      this.drawTriangle(ctx, upperMidPts[i + 1], centerPts[i + 1], centerPts[i], blueCol2, 'rgba(255,255,255,0.18)');

      // --- LAYER C: Central Black Lateral Stripe ---
      // Thick bold dark navy / black stripe passing through eye to tail
      const blackCol1 = blackPalette[i % blackPalette.length];
      const blackCol2 = blackPalette[(i + 1) % blackPalette.length];
      this.drawTriangle(ctx, centerPts[i], centerPts[i + 1], lowerMidPts[i], blackCol1, 'rgba(255,255,255,0.1)');
      this.drawTriangle(ctx, centerPts[i + 1], lowerMidPts[i + 1], lowerMidPts[i], blackCol2, 'rgba(255,255,255,0.1)');

      // --- LAYER D: Ventral Belly (Pure crisp White / Pale silver facets) ---
      const whiteCol1 = whitePalette[i % whitePalette.length];
      const whiteCol2 = whitePalette[(i + 1) % whitePalette.length];
      this.drawTriangle(ctx, lowerMidPts[i], lowerMidPts[i + 1], bottomPts[i], whiteCol1, 'rgba(0,0,0,0.06)');
      this.drawTriangle(ctx, lowerMidPts[i + 1], bottomPts[i + 1], bottomPts[i], whiteCol2, 'rgba(0,0,0,0.06)');
    }

    // --- 3. Close mesh at tail anchor ---
    const last = segCount - 1;
    const prev = segCount - 2;

    this.drawTriangle(ctx, topPts[prev], tailAnchor, upperMidPts[prev], skyBluePalette[3], 'rgba(255,255,255,0.2)');
    this.drawTriangle(ctx, upperMidPts[prev], tailAnchor, centerPts[prev], blackPalette[2], 'rgba(255,255,255,0.1)');
    this.drawTriangle(ctx, centerPts[prev], tailAnchor, lowerMidPts[prev], blackPalette[3], 'rgba(255,255,255,0.1)');
    this.drawTriangle(ctx, lowerMidPts[prev], tailAnchor, bottomPts[prev], whitePalette[2], 'rgba(0,0,0,0.06)');

    ctx.restore();
  }

  /**
   * Pectoral Fin: Fan-like fin on lower side of body with subtle radial ribs matching reference
   */
  private renderLowPolyPectoralFin(ctx: CanvasRenderingContext2D, scale: number) {
    ctx.save();
    const seg = this.segments[3];
    const normal = seg.angle + Math.PI / 2;

    const finLen = 16 * scale;
    const flutterAmp = this.isRunning ? Math.sin(this.finPhase * 2.6) * 0.42 : Math.sin(this.finPhase) * 0.12;

    // Both sides (upper and lower perspective)
    for (const side of [1, -1]) {
      const root = {
        x: seg.pos.x + Math.cos(normal * side) * (seg.width * 0.45),
        y: seg.pos.y + Math.sin(normal * side) * (seg.width * 0.45),
      };

      const finBaseAngle = seg.angle + (Math.PI * 0.78 * side) + flutterAmp * side;

      // 4 low-poly fan ribs
      const rib1 = {
        x: root.x + Math.cos(finBaseAngle - 0.25 * side) * (finLen * 0.75),
        y: root.y + Math.sin(finBaseAngle - 0.25 * side) * (finLen * 0.75),
      };
      const rib2 = {
        x: root.x + Math.cos(finBaseAngle) * finLen,
        y: root.y + Math.sin(finBaseAngle) * finLen,
      };
      const rib3 = {
        x: root.x + Math.cos(finBaseAngle + 0.25 * side) * (finLen * 0.9),
        y: root.y + Math.sin(finBaseAngle + 0.25 * side) * (finLen * 0.9),
      };

      this.drawTriangle(ctx, root, rib1, rib2, 'rgba(96, 165, 250, 0.65)', 'rgba(255,255,255,0.3)');
      this.drawTriangle(ctx, root, rib2, rib3, 'rgba(59, 130, 246, 0.75)', 'rgba(255,255,255,0.3)');
    }

    ctx.restore();
  }

  /**
   * Facial Features:
   * - Large dark round eye on black stripe with glossy catchlight
   * - Dark mouth slit on snout tip
   * - Operculum / Gill divider line
   */
  private renderFacialFeatures(ctx: CanvasRenderingContext2D, scale: number, snoutTip: Vector2D) {
    ctx.save();
    const head = this.segments[1];
    const headAngle = head.angle;
    const norm = headAngle + Math.PI / 2;

    // Eyes on left & right
    const eyeOffsetFwd = 3.2 * scale;
    const eyeOffsetLat = head.width * 0.55;

    for (const side of [1, -1]) {
      const eyeX = head.pos.x + Math.cos(headAngle) * eyeOffsetFwd + Math.cos(norm * side) * eyeOffsetLat;
      const eyeY = head.pos.y + Math.sin(headAngle) * eyeOffsetFwd + Math.sin(norm * side) * eyeOffsetLat;

      // Dark Iris Ring
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 3.2 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 0.8 * scale;
      ctx.stroke();

      // Deep Black Pupil
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 2.3 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#020617';
      ctx.fill();

      // Crisp White Catchlight
      ctx.beginPath();
      ctx.arc(
        eyeX + Math.cos(headAngle - 0.7 * side) * (0.9 * scale),
        eyeY + Math.sin(headAngle - 0.7 * side) * (0.9 * scale),
        0.85 * scale,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // Mouth slit line on snout tip
    ctx.beginPath();
    ctx.moveTo(snoutTip.x, snoutTip.y);
    ctx.lineTo(
      snoutTip.x - Math.cos(headAngle) * (5 * scale),
      snoutTip.y - Math.sin(headAngle) * (5 * scale)
    );
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();

    // Operculum (Gill line)
    const gillSeg = this.segments[2];
    const gillNorm = gillSeg.angle + Math.PI / 2;
    for (const side of [1, -1]) {
      const gTop = {
        x: gillSeg.pos.x + Math.cos(gillNorm * side) * (gillSeg.width * 0.8),
        y: gillSeg.pos.y + Math.sin(gillNorm * side) * (gillSeg.width * 0.8),
      };
      const gMid = {
        x: gillSeg.pos.x - Math.cos(gillSeg.angle) * (2 * scale) + Math.cos(gillNorm * side) * (gillSeg.width * 0.2),
        y: gillSeg.pos.y - Math.sin(gillSeg.angle) * (2 * scale) + Math.sin(gillNorm * side) * (gillSeg.width * 0.2),
      };
      const gBot = {
        x: gillSeg.pos.x + Math.cos(gillNorm * side) * (gillSeg.width * 0.7),
        y: gillSeg.pos.y + Math.sin(gillNorm * side) * (gillSeg.width * 0.7),
      };

      ctx.beginPath();
      ctx.moveTo(gTop.x, gTop.y);
      ctx.quadraticCurveTo(gMid.x, gMid.y, gBot.x, gBot.y);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 0.9 * scale;
      ctx.stroke();
    }

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

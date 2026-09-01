import { Vector2D, FishSegment, FishConfig } from '../types';
import { dist, angleDiff, lerp, clamp, normalizeAngle } from '../utils/math';

interface FacetTriangle {
  p1: Vector2D;
  p2: Vector2D;
  p3: Vector2D;
  color: string;
  strokeColor?: string;
}

export class SharknoseGoby {
  public segments: FishSegment[] = [];
  public headPos: Vector2D = { x: 0, y: 0 };
  public heading: number = 0;
  public speed: number = 0;
  public targetSpeed: number = 2.6;
  public swimPhase: number = 0;
  public finPhase: number = 0;

  public isRunning: boolean = true;
  public behaviorMode: 'cruise' | 'dart' | 'dance' | 'hover' | 'follow' | 'clean' = 'cruise';
  public modeTimer: number = 0;
  public targetPoint: Vector2D = { x: 0, y: 0 };
  public userPointer: Vector2D | null = null;
  public isPointerActive: boolean = false;
  public cleaningSpots: Vector2D[] = [];

  // Scaled relative to the cleaner wrasse (compact, slender goby proportions)
  public config: FishConfig = {
    scale: 0.85,
    segmentCount: 14,
    segmentLength: 7.2,
    baseSpeed: 2.6,
    maxSpeed: 5.2,
    turnSpeed: 0.065,
    waveFrequency: 0.24,
    waveAmplitude: 4.5,
  };

  // Anatomical body radii for the slender, torpedo-shaped sharknose goby
  private bodyRadii: number[] = [
    2.8,  // 0: Blunt conical snout
    4.6,  // 1: Forehead / Eyes
    6.2,  // 2: Opercular region / Pelvic disc
    7.0,  // 3: 1st Dorsal fin anterior peak
    6.8,  // 4: Mid torso
    6.2,  // 5: 2nd Dorsal fin start
    5.6,  // 6: Mid-posterior
    4.8,  // 7: Anterior anal fin
    4.0,  // 8: Posterior body
    3.3,  // 9: Posterior body
    2.6,  // 10: Caudal peduncle
    2.0,  // 11: Narrow peduncle
    1.5,  // 12: Tail base
    1.0,  // 13: Caudal fin anchor
  ];

  private wanderNoise: number = 0;
  private breathPhase: number = 0;
  public state: 'entering' | 'active' = 'entering';

  constructor(canvasWidth: number, canvasHeight: number) {
    // Start offscreen to the LEFT
    const startX = -180;
    const startY = canvasHeight * 0.45;
    this.headPos = { x: startX, y: startY };
    this.heading = 0; // Facing eastward into the screen
    this.targetPoint = { x: canvasWidth * 0.35, y: canvasHeight * 0.45 };
    this.speed = this.config.baseSpeed * 1.3;

    // Initialize spine segments trailing behind the initial heading
    for (let i = 0; i < this.config.segmentCount; i++) {
      const segLen = this.config.segmentLength * this.config.scale;
      const x = startX - Math.cos(this.heading) * (i * segLen);
      const y = startY - Math.sin(this.heading) * (i * segLen);
      const r = (this.bodyRadii[i] || 2.0) * this.config.scale;
      this.segments.push({
        pos: { x, y },
        prevPos: { x, y },
        angle: this.heading,
        width: r,
        height: r * 1.05,
      });
    }
  }

  public setPointer(pos: Vector2D | null, active: boolean = false) {
    this.userPointer = pos;
    this.isPointerActive = active;
  }

  public setRunning(running: boolean) {
    this.isRunning = running;
  }

  public setCleaningSpots(spots: Vector2D[]) {
    this.cleaningSpots = spots;
  }

  public getMouthPos(): Vector2D {
    const s = this.config.scale;
    const angle = this.segments.length > 0 ? this.segments[0].angle : this.heading;
    const base = this.segments.length > 0 ? this.segments[0].pos : this.headPos;
    return {
      x: base.x + Math.cos(angle) * (8 * s),
      y: base.y + Math.sin(angle) * (8 * s),
    };
  }

  public hitTest(pos: Vector2D): boolean {
    const hitRadius = 38 * this.config.scale;
    if (dist(pos, this.headPos) < hitRadius) return true;
    for (const seg of this.segments) {
      if (dist(pos, seg.pos) < hitRadius) return true;
    }
    return false;
  }

  public update(width: number, height: number, dt: number = 1) {
    if (isNaN(this.headPos.x) || isNaN(this.headPos.y) || isNaN(this.heading)) {
      this.headPos = { x: width * 0.25, y: height * 0.5 };
      this.heading = 0;
      this.speed = this.config.baseSpeed;
    }

    const safeDt = clamp(dt, 0.2, 2.0);
    this.modeTimer += safeDt;
    this.breathPhase += 0.04 * safeDt;

    if (this.state === 'entering') {
      if (this.headPos.x > 80) {
        this.state = 'active';
      }
    }

    if (!this.isRunning) {
      this.targetSpeed = 0;
      this.speed = lerp(this.speed, 0, 0.06 * safeDt);
      this.finPhase += 0.04 * safeDt;
      this.swimPhase += 0.02 * safeDt;

      this.headPos.y += Math.sin(this.breathPhase * 0.4) * 0.1 * safeDt;
      this.headPos.x += Math.cos(this.breathPhase * 0.25) * 0.05 * safeDt;

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
        this.targetSpeed = 0.7;
        const wiggle = Math.sin(this.swimPhase * 1.2) * 0.015;
        this.heading = normalizeAngle(this.heading + wiggle * dt);
      }
      return;
    }

    if (this.state === 'entering') {
      this.targetSpeed = this.config.baseSpeed * 0.95;
      const targetY = height * 0.48;
      const toTargetAngle = Math.atan2(targetY - this.headPos.y, width * 0.35 - this.headPos.x);
      const diff = angleDiff(toTargetAngle, this.heading);
      const turnStep = clamp(diff * 0.04, -this.config.turnSpeed, this.config.turnSpeed);
      this.heading = normalizeAngle(this.heading + turnStep * dt);
      return;
    }

    const modeDuration = this.behaviorMode === 'dart' ? 65 : this.behaviorMode === 'clean' ? 260 : 220 + Math.random() * 180;
    if (this.modeTimer > modeDuration) {
      this.modeTimer = 0;
      const roll = Math.random();

      // Cleaner goby behavior: visits client fish cleaning spots frequently
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
        this.targetSpeed = this.config.maxSpeed * (0.75 + Math.random() * 0.25);
        const pad = 140;
        this.targetPoint = {
          x: pad + Math.random() * Math.max(100, width - pad * 2),
          y: pad + Math.random() * Math.max(100, height - pad * 2),
        };
      } else if (roll < 0.93) {
        this.behaviorMode = 'dance';
        this.targetSpeed = 0.8;
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
          const turnStep = clamp(diff * 0.05, -maxTurnRate * 1.1, maxTurnRate * 1.1);
          this.heading = normalizeAngle(this.heading + turnStep * dt);
          this.targetSpeed = clamp(d * 0.035, 1.1, this.config.baseSpeed);
        } else {
          // Goby inspection wiggle near client
          this.targetSpeed = 0.5;
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
    if (this.state === 'entering') return;

    const margin = 110;
    let pushX = 0;
    let pushY = 0;

    if (this.headPos.x < margin) pushX = (margin - this.headPos.x) / margin;
    else if (this.headPos.x > width - margin) pushX = -(this.headPos.x - (width - margin)) / margin;

    if (this.headPos.y < margin) pushY = (margin - this.headPos.y) / margin;
    else if (this.headPos.y > height - margin) pushY = -(this.headPos.y - (height - margin)) / margin;

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
    if (this.segments.length === 0) return;

    this.segments[0].pos.x = this.headPos.x;
    this.segments[0].pos.y = this.headPos.y;
    this.segments[0].angle = this.heading;
    this.segments[0].width = (this.bodyRadii[0] || 2.8) * this.config.scale;
    this.segments[0].height = this.segments[0].width * 1.05;

    const baseSegLen = this.config.segmentLength * this.config.scale;

    for (let i = 1; i < this.segments.length; i++) {
      const prev = this.segments[i - 1];
      const curr = this.segments[i];

      curr.prevPos = { ...curr.pos };

      const dx = curr.pos.x - prev.pos.x;
      const dy = curr.pos.y - prev.pos.y;
      let currentDir = Math.atan2(dy, dx);
      if (isNaN(currentDir)) currentDir = prev.angle + Math.PI;

      const naturalTrailingAngle = prev.angle + Math.PI;
      const deviation = angleDiff(currentDir, naturalTrailingAngle);

      const maxBend = 0.28;
      const clampedDeviation = clamp(deviation, -maxBend, maxBend);
      const jointAngle = naturalTrailingAngle + clampedDeviation;

      const waveProgress = i / (this.segments.length - 1);
      const waveAmpFactor = Math.pow(waveProgress, 1.3);
      const waveFlex = Math.sin(this.swimPhase - i * 0.46) * (this.config.waveAmplitude * 0.036) * waveAmpFactor;
      const effectiveWave = this.speed > 0.08 ? waveFlex : waveFlex * 0.16;

      const finalAngle = jointAngle + effectiveWave;

      curr.pos.x = prev.pos.x + Math.cos(finalAngle) * baseSegLen;
      curr.pos.y = prev.pos.y + Math.sin(finalAngle) * baseSegLen;
      curr.angle = finalAngle - Math.PI;
      curr.width = (this.bodyRadii[i] || 2.0) * this.config.scale;
      curr.height = curr.width * 1.05;
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    if (this.segments.length < 4) return;

    ctx.save();

    // 1. Pelvic suction disc (underneath breast)
    this.renderPelvicDisc(ctx);

    // 2. 1st and 2nd Dorsal fins
    this.renderDorsalFins(ctx);

    // 3. Anal Fin
    this.renderAnalFin(ctx);

    // 4. Caudal (Tail) Fin
    this.renderCaudalFin(ctx);

    // 5. Main Low-Poly Faceted Body (Snout yellow V -> Neon blue lateral stripes -> Jet black flank -> White belly)
    this.renderFacetedBody(ctx);

    // 6. Snout, Jaws & Mouth contour
    this.renderSnoutAndMouth(ctx);

    // 7. Dark Prominent Eye with Gold Ring & Specular Highlight
    this.renderEye(ctx);

    // 8. Pectoral Fin Fans
    this.renderPectoralFins(ctx);

    ctx.restore();
  }

  private drawFacet(ctx: CanvasRenderingContext2D, facet: FacetTriangle) {
    ctx.beginPath();
    ctx.moveTo(facet.p1.x, facet.p1.y);
    ctx.lineTo(facet.p2.x, facet.p2.y);
    ctx.lineTo(facet.p3.x, facet.p3.y);
    ctx.closePath();

    ctx.fillStyle = facet.color;
    ctx.fill();

    ctx.strokeStyle = facet.strokeColor || 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  /**
   * Main Low-Poly Faceted Body for Sharknose Goby:
   * 1. Snout V: Bright golden yellow (#fde047, #facc15, #eab308)
   * 2. Lateral Stripe: Electric sky blue / neon cyan (#38bdf8, #00f0ff, #0284c7, #60a5fa)
   * 3. Dorsal & Mid Flank: Jet black / deep charcoal (#020617, #090d16, #0f172a)
   * 4. Ventral Belly: Pure white & silver faceted polygons (#ffffff, #f1f5f9, #e2e8f0)
   */
  private renderFacetedBody(ctx: CanvasRenderingContext2D) {
    const s = this.config.scale;
    const count = this.segments.length;

    const dorsalPts: Vector2D[] = [];
    const upperMidPts: Vector2D[] = [];
    const spinePts: Vector2D[] = [];
    const lowerMidPts: Vector2D[] = [];
    const ventralPts: Vector2D[] = [];

    for (let i = 0; i < count; i++) {
      const seg = this.segments[i];
      const normAngle = seg.angle + Math.PI / 2;
      const r = seg.width;

      dorsalPts.push({
        x: seg.pos.x + Math.cos(normAngle) * r * 1.1,
        y: seg.pos.y + Math.sin(normAngle) * r * 1.1,
      });

      upperMidPts.push({
        x: seg.pos.x + Math.cos(normAngle) * (r * 0.5),
        y: seg.pos.y + Math.sin(normAngle) * (r * 0.5),
      });

      spinePts.push({
        x: seg.pos.x,
        y: seg.pos.y,
      });

      lowerMidPts.push({
        x: seg.pos.x - Math.cos(normAngle) * (r * 0.45),
        y: seg.pos.y - Math.sin(normAngle) * (r * 0.45),
      });

      ventralPts.push({
        x: seg.pos.x - Math.cos(normAngle) * (r * 0.95),
        y: seg.pos.y - Math.sin(normAngle) * (r * 0.95),
      });
    }

    // --- Snout Tip Triangular Cap (Iconic Yellow V-nose) ---
    const snoutApex: Vector2D = {
      x: this.headPos.x + Math.cos(this.heading) * (9.5 * s),
      y: this.headPos.y + Math.sin(this.heading) * (9.5 * s),
    };

    // Yellow V-pattern on snout tip
    this.drawFacet(ctx, { p1: snoutApex, p2: dorsalPts[0], p3: upperMidPts[0], color: '#fde047' });
    this.drawFacet(ctx, { p1: snoutApex, p2: upperMidPts[0], p3: spinePts[0], color: '#facc15' });
    this.drawFacet(ctx, { p1: snoutApex, p2: spinePts[0], p3: lowerMidPts[0], color: '#eab308' });
    this.drawFacet(ctx, { p1: snoutApex, p2: lowerMidPts[0], p3: ventralPts[0], color: '#f1f5f9' });

    // Color palettes for Sharknose Goby
    const cYellow = ['#fde047', '#facc15', '#eab308'];
    const cElectricBlue = ['#38bdf8', '#00f0ff', '#0284c7', '#60a5fa', '#0ea5e9'];
    const cBlackFlank = ['#020617', '#090d16', '#0f172a', '#1e293b', '#0b1120'];
    const cWhiteBelly = ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1'];

    // Traverse body segments and render 4 rows of faceted quads (triangulated)
    for (let i = 0; i < count - 1; i++) {
      const d1 = dorsalPts[i];
      const d2 = dorsalPts[i + 1];
      const um1 = upperMidPts[i];
      const um2 = upperMidPts[i + 1];
      const sp1 = spinePts[i];
      const sp2 = spinePts[i + 1];
      const lm1 = lowerMidPts[i];
      const lm2 = lowerMidPts[i + 1];
      const v1 = ventralPts[i];
      const v2 = ventralPts[i + 1];

      // Row 1: Dorsal Crest (Yellow at head, transitioning to midnight dark dorsum)
      if (i < 2) {
        this.drawFacet(ctx, { p1: d1, p2: um1, p3: d2, color: cYellow[i % cYellow.length] });
        this.drawFacet(ctx, { p1: d2, p2: um1, p3: um2, color: '#fef08a' });
      } else {
        const darkCol = cBlackFlank[i % cBlackFlank.length];
        this.drawFacet(ctx, { p1: d1, p2: um1, p3: d2, color: darkCol });
        this.drawFacet(ctx, { p1: d2, p2: um1, p3: um2, color: '#090d16' });
      }

      // Row 2: Electric Neon Sky Blue Lateral Stripe (Hallmark of Sharknose Goby)
      const blueCol1 = cElectricBlue[i % cElectricBlue.length];
      const blueCol2 = cElectricBlue[(i + 1) % cElectricBlue.length];
      this.drawFacet(ctx, { p1: um1, p2: sp1, p3: um2, color: blueCol1 });
      this.drawFacet(ctx, { p1: um2, p2: sp1, p3: sp2, color: blueCol2 });

      // Row 3: Bold Jet Black Lateral Stripe beneath blue
      const blackCol1 = cBlackFlank[(i + 1) % cBlackFlank.length];
      const blackCol2 = cBlackFlank[(i + 2) % cBlackFlank.length];
      this.drawFacet(ctx, { p1: sp1, p2: lm1, p3: sp2, color: blackCol1 });
      this.drawFacet(ctx, { p1: sp2, p2: lm1, p3: lm2, color: blackCol2 });

      // Row 4: Clean Silvery-White Ventral Belly
      const whiteCol1 = cWhiteBelly[i % cWhiteBelly.length];
      const whiteCol2 = cWhiteBelly[(i + 1) % cWhiteBelly.length];
      this.drawFacet(ctx, { p1: lm1, p2: v1, p3: lm2, color: whiteCol1 });
      this.drawFacet(ctx, { p1: lm2, p2: v1, p3: v2, color: whiteCol2 });
    }
  }

  /**
   * Double Dorsal Fins (Spiny 1st Dorsal + Elongated Soft 2nd Dorsal)
   */
  private renderDorsalFins(ctx: CanvasRenderingContext2D) {
    const s = this.config.scale;
    const flutter = Math.sin(this.finPhase) * 1.5;

    // --- 1st Dorsal Fin (Spiny triangular sail between segments 2 and 4) ---
    if (this.segments.length > 5) {
      const seg2 = this.segments[2];
      const seg4 = this.segments[4];
      const norm2 = seg2.angle + Math.PI / 2;
      const norm4 = seg4.angle + Math.PI / 2;

      const pBase1: Vector2D = {
        x: seg2.pos.x + Math.cos(norm2) * (seg2.width * 1.1),
        y: seg2.pos.y + Math.sin(norm2) * (seg2.width * 1.1),
      };
      const pBase2: Vector2D = {
        x: seg4.pos.x + Math.cos(norm4) * (seg4.width * 1.1),
        y: seg4.pos.y + Math.sin(norm4) * (seg4.width * 1.1),
      };

      const pApex: Vector2D = {
        x: pBase1.x + Math.cos(norm2) * (14 * s) + Math.cos(seg2.angle + Math.PI) * (4 * s),
        y: pBase1.y + Math.sin(norm2) * (14 * s) + Math.sin(seg2.angle + Math.PI) * (4 * s) + flutter * 0.5,
      };

      this.drawFacet(ctx, { p1: pBase1, p2: pApex, p3: pBase2, color: 'rgba(56, 189, 248, 0.85)', strokeColor: 'rgba(255,255,255,0.4)' });
      this.drawFacet(ctx, { p1: pBase1, p2: pApex, p3: { x: (pBase1.x + pBase2.x) / 2, y: (pBase1.y + pBase2.y) / 2 }, color: 'rgba(2, 132, 199, 0.9)' });
    }

    // --- 2nd Dorsal Fin (Soft-rayed fin along segments 5 to 9) ---
    if (this.segments.length > 10) {
      const seg5 = this.segments[5];
      const seg7 = this.segments[7];
      const seg9 = this.segments[9];

      const norm5 = seg5.angle + Math.PI / 2;
      const norm7 = seg7.angle + Math.PI / 2;
      const norm9 = seg9.angle + Math.PI / 2;

      const b5: Vector2D = { x: seg5.pos.x + Math.cos(norm5) * (seg5.width * 1.05), y: seg5.pos.y + Math.sin(norm5) * (seg5.width * 1.05) };
      const b7: Vector2D = { x: seg7.pos.x + Math.cos(norm7) * (seg7.width * 1.05), y: seg7.pos.y + Math.sin(norm7) * (seg7.width * 1.05) };
      const b9: Vector2D = { x: seg9.pos.x + Math.cos(norm9) * (seg9.width * 1.05), y: seg9.pos.y + Math.sin(norm9) * (seg9.width * 1.05) };

      const t5: Vector2D = { x: b5.x + Math.cos(norm5) * (9 * s), y: b5.y + Math.sin(norm5) * (9 * s) + flutter * 0.4 };
      const t7: Vector2D = { x: b7.x + Math.cos(norm7) * (11 * s), y: b7.y + Math.sin(norm7) * (11 * s) + flutter * 0.6 };
      const t9: Vector2D = { x: b9.x + Math.cos(norm9) * (7 * s), y: b9.y + Math.sin(norm9) * (7 * s) + flutter * 0.8 };

      this.drawFacet(ctx, { p1: b5, p2: t5, p3: b7, color: 'rgba(56, 189, 248, 0.75)' });
      this.drawFacet(ctx, { p1: t5, p2: t7, p3: b7, color: 'rgba(2, 132, 199, 0.8)' });
      this.drawFacet(ctx, { p1: b7, p2: t7, p3: b9, color: 'rgba(56, 189, 248, 0.75)' });
      this.drawFacet(ctx, { p1: t7, p2: t9, p3: b9, color: 'rgba(2, 132, 199, 0.8)' });
    }
  }

  /**
   * Anal Fin along segments 6 to 10
   */
  private renderAnalFin(ctx: CanvasRenderingContext2D) {
    const s = this.config.scale;
    const flutter = Math.sin(this.finPhase) * 1.2;

    if (this.segments.length > 10) {
      const seg6 = this.segments[6];
      const seg8 = this.segments[8];
      const seg10 = this.segments[10];

      const norm6 = seg6.angle - Math.PI / 2;
      const norm8 = seg8.angle - Math.PI / 2;
      const norm10 = seg10.angle - Math.PI / 2;

      const b6: Vector2D = { x: seg6.pos.x + Math.cos(norm6) * (seg6.width * 1.05), y: seg6.pos.y + Math.sin(norm6) * (seg6.width * 1.05) };
      const b8: Vector2D = { x: seg8.pos.x + Math.cos(norm8) * (seg8.width * 1.05), y: seg8.pos.y + Math.sin(norm8) * (seg8.width * 1.05) };
      const b10: Vector2D = { x: seg10.pos.x + Math.cos(norm10) * (seg10.width * 1.05), y: seg10.pos.y + Math.sin(norm10) * (seg10.width * 1.05) };

      const t6: Vector2D = { x: b6.x + Math.cos(norm6) * (7 * s), y: b6.y + Math.sin(norm6) * (7 * s) + flutter * 0.4 };
      const t8: Vector2D = { x: b8.x + Math.cos(norm8) * (9 * s), y: b8.y + Math.sin(norm8) * (9 * s) + flutter * 0.6 };
      const t10: Vector2D = { x: b10.x + Math.cos(norm10) * (5 * s), y: b10.y + Math.sin(norm10) * (5 * s) + flutter * 0.8 };

      this.drawFacet(ctx, { p1: b6, p2: t6, p3: b8, color: 'rgba(255, 255, 255, 0.75)' });
      this.drawFacet(ctx, { p1: t6, p2: t8, p3: b8, color: 'rgba(56, 189, 248, 0.7)' });
      this.drawFacet(ctx, { p1: b8, p2: t8, p3: b10, color: 'rgba(255, 255, 255, 0.75)' });
      this.drawFacet(ctx, { p1: t8, p2: t10, p3: b10, color: 'rgba(56, 189, 248, 0.7)' });
    }
  }

  /**
   * Pelvic Suction Disc (Thoracic sucker disc characteristic of cleaner gobies)
   */
  private renderPelvicDisc(ctx: CanvasRenderingContext2D) {
    const s = this.config.scale;
    if (this.segments.length < 3) return;

    const seg2 = this.segments[2];
    const normAngle = seg2.angle - Math.PI / 2;

    const pRoot: Vector2D = {
      x: seg2.pos.x + Math.cos(normAngle) * (seg2.width * 0.9),
      y: seg2.pos.y + Math.sin(normAngle) * (seg2.width * 0.9),
    };
    const pTip: Vector2D = {
      x: pRoot.x + Math.cos(normAngle) * (6 * s),
      y: pRoot.y + Math.sin(normAngle) * (6 * s),
    };
    const pRear: Vector2D = {
      x: pRoot.x + Math.cos(seg2.angle + Math.PI) * (5 * s),
      y: pRoot.y + Math.sin(seg2.angle + Math.PI) * (5 * s),
    };

    this.drawFacet(ctx, { p1: pRoot, p2: pTip, p3: pRear, color: 'rgba(241, 245, 249, 0.85)', strokeColor: 'rgba(255,255,255,0.3)' });
  }

  /**
   * Caudal (Tail) Fin: Rounded paddle with black central stripe continuation & electric blue edges
   */
  private renderCaudalFin(ctx: CanvasRenderingContext2D) {
    const s = this.config.scale;
    const lastSeg = this.segments[this.segments.length - 1];
    const prevSeg = this.segments[this.segments.length - 2];
    const tailAngle = lastSeg.angle;
    const normAngle = tailAngle + Math.PI / 2;
    const flutter = Math.sin(this.finPhase) * 2.2;

    const finLen = 18 * s;
    const finSpread = 11 * s;

    const rootCenter = lastSeg.pos;
    const rootTop: Vector2D = {
      x: rootCenter.x + Math.cos(normAngle) * (lastSeg.width * 1.1),
      y: rootCenter.y + Math.sin(normAngle) * (lastSeg.width * 1.1),
    };
    const rootBot: Vector2D = {
      x: rootCenter.x - Math.cos(normAngle) * (lastSeg.width * 1.1),
      y: rootCenter.y - Math.sin(normAngle) * (lastSeg.width * 1.1),
    };

    const tipCenter: Vector2D = {
      x: rootCenter.x + Math.cos(tailAngle + Math.PI) * finLen,
      y: rootCenter.y + Math.sin(tailAngle + Math.PI) * finLen + flutter,
    };
    const tipTop: Vector2D = {
      x: tipCenter.x + Math.cos(normAngle) * finSpread,
      y: tipCenter.y + Math.sin(normAngle) * finSpread + flutter * 0.7,
    };
    const tipBot: Vector2D = {
      x: tipCenter.x - Math.cos(normAngle) * finSpread,
      y: tipCenter.y - Math.sin(normAngle) * finSpread + flutter * 0.7,
    };

    // Upper blue fin facet
    this.drawFacet(ctx, { p1: rootTop, p2: tipTop, p3: tipCenter, color: '#38bdf8' });
    this.drawFacet(ctx, { p1: rootTop, p2: tipCenter, p3: rootCenter, color: '#0284c7' });

    // Lower white/blue fin facet
    this.drawFacet(ctx, { p1: rootCenter, p2: tipCenter, p3: rootBot, color: '#090d16' });
    this.drawFacet(ctx, { p1: rootBot, p2: tipCenter, p3: tipBot, color: '#38bdf8' });
  }

  /**
   * Snout, Jaws & Mouth contour
   */
  private renderSnoutAndMouth(ctx: CanvasRenderingContext2D) {
    const s = this.config.scale;
    const mouthX = this.headPos.x + Math.cos(this.heading) * (8 * s);
    const mouthY = this.headPos.y + Math.sin(this.heading) * (8 * s);

    ctx.beginPath();
    ctx.arc(mouthX, mouthY, 1.4 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
  }

  /**
   * Prominent Dark Eye with Gold/Amber ring & Specular highlight
   */
  private renderEye(ctx: CanvasRenderingContext2D) {
    const s = this.config.scale;
    const seg1 = this.segments[1] || this.segments[0];
    const normAngle = this.heading + Math.PI / 2;

    const eyeX = seg1.pos.x + Math.cos(normAngle) * (seg1.width * 0.35) + Math.cos(this.heading) * (2 * s);
    const eyeY = seg1.pos.y + Math.sin(normAngle) * (seg1.width * 0.35) + Math.sin(this.heading) * (2 * s);
    const eyeRadius = 3.6 * s;

    // Outer Dark Bevel
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius + 0.8 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#020617';
    ctx.fill();

    // Amber Iris Ring
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = '#05070c';
    ctx.fill();

    // Catchlight
    ctx.beginPath();
    ctx.arc(eyeX - 1.0 * s, eyeY - 1.0 * s, 1.1 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /**
   * Translucent Pectoral Fans fluttering on flanks
   */
  private renderPectoralFins(ctx: CanvasRenderingContext2D) {
    const s = this.config.scale;
    if (this.segments.length < 3) return;

    const seg2 = this.segments[2];
    const flutter = Math.sin(this.finPhase * 1.5) * 0.35;

    ctx.save();
    ctx.translate(seg2.pos.x, seg2.pos.y);
    ctx.rotate(seg2.angle + flutter);

    const finLen = 13 * s;
    const pRoot: Vector2D = { x: 0, y: 0 };
    const p1: Vector2D = { x: -finLen * 0.85, y: 5 * s };
    const p2: Vector2D = { x: -finLen, y: 0 };
    const p3: Vector2D = { x: -finLen * 0.85, y: -4 * s };

    this.drawFacet(ctx, { p1: pRoot, p2: p1, p3: p2, color: 'rgba(56, 189, 248, 0.65)', strokeColor: 'rgba(255,255,255,0.4)' });
    this.drawFacet(ctx, { p1: pRoot, p2: p2, p3: p3, color: 'rgba(255, 255, 255, 0.75)', strokeColor: 'rgba(255,255,255,0.4)' });

    ctx.restore();
  }
}

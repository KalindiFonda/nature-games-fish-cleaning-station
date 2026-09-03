import { Vector2D, FishSegment, FishConfig } from '../types';
import { dist, angleDiff, lerp, clamp, normalizeAngle } from '../utils/math';

export type CleanerBehaviorMode = 'cruise' | 'dart' | 'dance' | 'hover' | 'follow' | 'clean';

/**
 * Per-species motion constants. Every value here is one that differed between
 * the Spanish hogfish and the sharknose goby when their update paths were
 * unified; anything not listed is shared verbatim by both.
 */
export interface CleanerTuning {
  /** FishSegment.height as a multiple of its half-width. */
  segmentHeightRatio: number;
  /** Recompute every segment's radius from bodyRadii * config.scale each frame,
   * so the body tracks live changes to config.scale from the UI. When false the
   * radii stay at whatever config.scale was at construction. */
  refreshSegmentRadii: boolean;
  /** Forward offset (unscaled) from the head segment to the mouth. */
  mouthOffset: number;
  /** Unscaled hit-test radius around each segment. */
  hitRadius: number;
  /** Paused drift amplitudes while the sim is stopped. */
  idleBobY: number;
  idleBobX: number;
  /** Speed held while parked under the pointer. */
  followRestSpeed: number;
  /** Frames a dart lasts before a new mode is rolled. */
  dartDuration: number;
  /** Dart target speed = maxSpeed * (dartSpeedMin + random * dartSpeedRange). */
  dartSpeedMin: number;
  dartSpeedRange: number;
  /** Target speed while in the randomly-rolled 'dance' mode. */
  danceSpeed: number;
  /** Lower clamp on approach speed towards a cleaning spot. */
  cleanApproachMinSpeed: number;
  /** Speed held while inspecting/pecking at a cleaning spot. */
  cleanInspectSpeed: number;
  /** Max joint deviation (radians) from the natural trailing angle. */
  spineMaxBend: number;
  /** Exponent shaping how wave amplitude grows towards the tail. */
  spineWavePower: number;
  /** Phase lag per segment of the swimming wave. */
  spineWaveLag: number;
  /** Multiplier on config.waveAmplitude for joint flex. */
  spineWaveScale: number;
  /** Fraction of the wave kept when the fish is (nearly) stationary. */
  spineIdleWaveFactor: number;
}

export interface CleanerSpawn {
  x: number;
  y: number;
  heading: number;
  speed: number;
  targetPoint: Vector2D;
}

/**
 * Shared body for the player-controlled cleaner fish: spine, pointer
 * following, wander/cruise/dart/dance/hover/clean modes, boundary repulsion,
 * spit knockback and the invitation dance. Subclasses supply config, body
 * radii, tuning and rendering, plus any genuinely species-specific behaviour
 * through the protected hooks.
 */
export abstract class CleanerFishBase {
  public segments: FishSegment[] = [];
  public headPos: Vector2D;
  public heading: number;
  public speed: number;
  public targetSpeed: number;
  public swimPhase: number = 0;
  public finPhase: number = 0;

  public isRunning: boolean = true;
  public behaviorMode: CleanerBehaviorMode = 'cruise';
  public modeTimer: number = 0;
  public targetPoint: Vector2D;
  public userPointer: Vector2D | null = null;
  public isPointerActive: boolean = false;
  public cleaningSpots: Vector2D[] = [];

  /** Mutable per instance: FishCanvas writes scale/baseSpeed at runtime. */
  public config: FishConfig;
  protected readonly bodyRadii: number[];
  protected readonly tuning: CleanerTuning;

  protected wanderNoise: number = 0;
  protected breathPhase: number = 0;

  public stunTimer: number = 0;
  private spitDir: { x: number; y: number } = { x: 0, y: 0 };

  public inviteDanceTimer: number = 0;
  private inviteDanceDuration: number = 120;
  private danceClock: number = 0;
  private danceBaseHeading: number = 0;

  protected constructor(
    config: FishConfig,
    bodyRadii: number[],
    tuning: CleanerTuning,
    spawn: CleanerSpawn
  ) {
    this.config = { ...config };
    this.bodyRadii = bodyRadii;
    this.tuning = tuning;

    this.headPos = { x: spawn.x, y: spawn.y };
    this.heading = spawn.heading;
    this.speed = spawn.speed;
    this.targetSpeed = this.config.baseSpeed;
    this.targetPoint = { ...spawn.targetPoint };

    // Initialize spine segments trailing behind the initial heading
    for (let i = 0; i < this.config.segmentCount; i++) {
      const segLen = this.config.segmentLength * this.config.scale;
      const x = spawn.x - Math.cos(this.heading) * (i * segLen);
      const y = spawn.y - Math.sin(this.heading) * (i * segLen);
      const r = this.segmentRadius(i);
      this.segments.push({
        pos: { x, y },
        prevPos: { x, y },
        angle: this.heading,
        width: r,
        height: r * this.tuning.segmentHeightRatio,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Hooks for species-specific behaviour
  // ---------------------------------------------------------------------------

  /** Where to put the fish if its position ever becomes NaN. */
  protected abstract resetPosition(width: number, height: number): Vector2D;

  /** Called at the top of every update, after timers advance and before the
   * paused/stun/dance branches. */
  protected onUpdateStart(_width: number, _height: number, _dt: number): void {}

  /** Runs after pointer-following but before the autonomous mode roll. Return
   * true to skip the shared autonomous behaviour for this frame. */
  protected handleSpecialBehavior(_width: number, _height: number, _dt: number): boolean {
    return false;
  }

  public abstract render(ctx: CanvasRenderingContext2D): void;

  // ---------------------------------------------------------------------------
  // Public API used by FishCanvas
  // ---------------------------------------------------------------------------

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
      x: base.x + Math.cos(angle) * (this.tuning.mouthOffset * s),
      y: base.y + Math.sin(angle) * (this.tuning.mouthOffset * s),
    };
  }

  public setPointer(pos: Vector2D | null, active: boolean = false) {
    this.userPointer = pos;
    this.isPointerActive = active;
  }

  /** Start the "come over" invitation: a slow, eased side-to-side sway. */
  public triggerInviteDance(durationSec: number = 2.0, facePoint: Vector2D | null = null) {
    this.inviteDanceDuration = durationSec * 60;
    this.inviteDanceTimer = this.inviteDanceDuration;
    this.danceClock = 0;
    this.danceStartHeading = this.heading;
    // Lean toward the client being invited - but never whip the body around:
    // the turn is capped at ~60 degrees and spread over the first second
    if (facePoint) {
      const want = Math.atan2(facePoint.y - this.headPos.y, facePoint.x - this.headPos.x);
      const turn = clamp(angleDiff(want, this.heading), -1.05, 1.05);
      this.danceBaseHeading = normalizeAngle(this.heading + turn);
    } else {
      this.danceBaseHeading = this.heading;
    }
  }
  private danceStartHeading: number = 0;

  public toggleRunning(): boolean {
    this.isRunning = !this.isRunning;
    return this.isRunning;
  }

  public setRunning(running: boolean) {
    this.isRunning = running;
  }

  public hitTest(pos: Vector2D): boolean {
    const hitRadius = this.tuning.hitRadius * this.config.scale;
    if (dist(pos, this.headPos) < hitRadius) return true;
    for (const seg of this.segments) {
      if (dist(pos, seg.pos) < hitRadius) return true;
    }
    return false;
  }

  public update(width: number, height: number, dt: number = 1) {
    if (isNaN(this.headPos.x) || isNaN(this.headPos.y) || isNaN(this.heading)) {
      this.headPos = this.resetPosition(width, height);
      this.heading = 0;
      this.speed = this.config.baseSpeed;
    }

    const safeDt = clamp(dt, 0.2, 2.0);
    this.modeTimer += safeDt;
    this.breathPhase += 0.04 * safeDt;

    this.onUpdateStart(width, height, safeDt);

    if (!this.isRunning) {
      this.targetSpeed = 0;
      this.speed = lerp(this.speed, 0, 0.06 * safeDt);
      this.finPhase += 0.04 * safeDt;
      this.swimPhase += 0.02 * safeDt;

      this.headPos.y += Math.sin(this.breathPhase * 0.4) * this.tuning.idleBobY * safeDt;
      this.headPos.x += Math.cos(this.breathPhase * 0.25) * this.tuning.idleBobX * safeDt;

      this.updateSpine();
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
      this.updateSpine();
      return;
    }

    if (this.inviteDanceTimer > 0) {
      this.inviteDanceTimer -= safeDt;
      this.danceClock += safeDt;
      this.behaviorMode = 'dance';
      // Smooth invitation sway: the heading rolls gently around the direction
      // the fish was facing (about one swing per second), with a soft vertical
      // bob. An envelope eases the motion in and out so it never snaps.
      const progress = 1 - this.inviteDanceTimer / this.inviteDanceDuration; // 0 -> 1
      // Quick in (first ~10%), full swing, then ease out over the last 30%
      const envelope = Math.min(1, progress / 0.1, (1 - progress) / 0.3);
      // Unhurried swings of the head, the body curling behind it
      const sway = Math.sin(this.danceClock * 0.075) * 0.45 * envelope;
      // Ease from the heading we had toward the client over ~1s, then sway around it
      const turnT = Math.min(1, this.danceClock / 60);
      const turn = turnT * turnT * (3 - 2 * turnT);
      const facing =
        this.danceStartHeading + angleDiff(this.danceBaseHeading, this.danceStartHeading) * turn;
      this.heading = normalizeAngle(facing + sway);
      this.targetSpeed = 0.35;
      this.speed = lerp(this.speed, this.targetSpeed, 0.08 * safeDt);
      this.finPhase += 0.7 * safeDt; // fins beating fast from the very first frame
      this.swimPhase += 0.55 * safeDt; // tail wagging
      this.applyBoundaryRepulsion(width, height, safeDt);
      this.updateSpine();
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
    this.updateSpine();
  }

  // ---------------------------------------------------------------------------
  // Shared behaviour
  // ---------------------------------------------------------------------------

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
        this.targetSpeed = this.tuning.followRestSpeed;
        const wiggle = Math.sin(this.swimPhase * 1.2) * 0.015;
        this.heading = normalizeAngle(this.heading + wiggle * dt);
      }
      return;
    }

    if (this.handleSpecialBehavior(width, height, dt)) return;

    const t = this.tuning;
    const modeDuration =
      this.behaviorMode === 'dart' ? t.dartDuration : this.behaviorMode === 'clean' ? 260 : 220 + Math.random() * 180;
    if (this.modeTimer > modeDuration) {
      this.modeTimer = 0;
      const roll = Math.random();

      // If client cleaning spots exist, high chance to visit the client's mouth or gills!
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
        this.targetSpeed = this.config.maxSpeed * (t.dartSpeedMin + Math.random() * t.dartSpeedRange);
        const pad = 140;
        this.targetPoint = {
          x: pad + Math.random() * Math.max(100, width - pad * 2),
          y: pad + Math.random() * Math.max(100, height - pad * 2),
        };
      } else if (roll < 0.93) {
        this.behaviorMode = 'dance';
        this.targetSpeed = t.danceSpeed;
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
          // Approach the client's mouth or gill
          const turnStep = clamp(diff * 0.05, -maxTurnRate * 1.1, maxTurnRate * 1.1);
          this.heading = normalizeAngle(this.heading + turnStep * dt);
          this.targetSpeed = clamp(d * 0.035, t.cleanApproachMinSpeed, this.config.baseSpeed);
        } else {
          // At the cleaning spot: perform characteristic inspection dance & pecks
          this.targetSpeed = t.cleanInspectSpeed;
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

  protected applyBoundaryRepulsion(width: number, height: number, dt: number) {
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

  private segmentRadius(i: number): number {
    return (this.bodyRadii[i] || 2.5) * this.config.scale;
  }

  private updateSpine() {
    if (this.segments.length === 0) return;

    const t = this.tuning;
    const head = this.segments[0];
    head.pos.x = this.headPos.x;
    head.pos.y = this.headPos.y;
    head.angle = this.heading;
    if (t.refreshSegmentRadii) {
      head.width = this.segmentRadius(0);
      head.height = head.width * t.segmentHeightRatio;
    }

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

      const clampedDeviation = clamp(deviation, -t.spineMaxBend, t.spineMaxBend);
      const jointAngle = naturalTrailingAngle + clampedDeviation;

      const waveProgress = i / (this.segments.length - 1);
      const waveAmpFactor = Math.pow(waveProgress, t.spineWavePower);
      const waveFlex =
        Math.sin(this.swimPhase - i * t.spineWaveLag) * (this.config.waveAmplitude * t.spineWaveScale) * waveAmpFactor;
      const effectiveWave = this.speed > 0.08 ? waveFlex : waveFlex * t.spineIdleWaveFactor;

      const finalAngle = jointAngle + effectiveWave;

      curr.pos.x = prev.pos.x + Math.cos(finalAngle) * baseSegLen;
      curr.pos.y = prev.pos.y + Math.sin(finalAngle) * baseSegLen;
      curr.angle = finalAngle - Math.PI;
      if (t.refreshSegmentRadii) {
        curr.width = this.segmentRadius(i);
        curr.height = curr.width * t.segmentHeightRatio;
      }
    }
  }
}

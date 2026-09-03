/**
 * Particle effects layered over the tank: micro-bubbles drifting up, water
 * ripples from pointer taps, and the bubble bursts that pop when a client
 * clamps down, a cleaner nibbles a parasite, or the player invites a client.
 *
 * Drawing order matters for the final image, so the layer exposes two draw
 * calls: `renderBackground` (bubbles + ripples, drawn before the reef and the
 * clients) and `renderBursts` (drawn after the active client's gill flap).
 */

export interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export interface MicroBubble {
  x: number;
  y: number;
  size: number;
  speed: number;
  wobble: number;
  alpha: number;
}

export interface ClampBurst {
  x: number;
  y: number;
  age: number; // 0..1
  golden?: boolean; // mucus-bite burst
  mini?: boolean; // small green nibble pop
}

const BUBBLE_COUNT = 28;

export class EffectsLayer {
  ripples: WaterRipple[] = [];
  bubbles: MicroBubble[] = [];
  bursts: ClampBurst[] = [];

  /** Seed the ambient micro-bubbles across the whole tank. */
  initBubbles(width: number, height: number): void {
    const bubbles: MicroBubble[] = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      bubbles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 1.2 + Math.random() * 2.5,
        speed: 0.35 + Math.random() * 0.75,
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.15 + Math.random() * 0.45,
      });
    }
    this.bubbles = bubbles;
  }

  /** Expanding ring where the player tapped the water. */
  addRipple(x: number, y: number): void {
    this.ripples.push({ x, y, radius: 5, maxRadius: 45, alpha: 0.45 });
  }

  /** A single bubble burst; plain white by default, golden and/or mini on request. */
  addBurst(x: number, y: number, opts: { golden?: boolean; mini?: boolean } = {}): void {
    const burst: ClampBurst = { x, y, age: 0 };
    if (opts.golden) burst.golden = true;
    if (opts.mini) burst.mini = true;
    this.bursts.push(burst);
  }

  /** The scatter of small golden pops around a cleaner's head when it invites a client. */
  addInviteBurst(x: number, y: number): void {
    for (let i = 0; i < 9; i++) {
      this.bursts.push({
        x: x + (Math.random() - 0.5) * 35,
        y: y + (Math.random() - 0.5) * 35,
        age: 0,
        golden: true,
        mini: true,
      });
    }
  }

  /** Advance and draw the micro-bubbles, then the water ripples. */
  renderBackground(ctx: CanvasRenderingContext2D, dt: number, width: number, height: number): void {
    // --- Micro-Bubbles ---
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      b.y -= b.speed * dt;
      b.wobble += 0.05 * dt;
      const wobbleX = b.x + Math.sin(b.wobble) * 4;

      if (b.y < -10) {
        b.y = height + 10;
        b.x = Math.random() * width;
      }

      ctx.beginPath();
      ctx.arc(wobbleX, b.y, b.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha})`;
      ctx.fill();
    }

    // --- Water Ripples ---
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += 1.2 * dt;
      r.alpha -= 0.015 * dt;

      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /** Advance and draw the clamp / nibble / invite bubble bursts. */
  renderBursts(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt / (b.mini ? 26 : 45);
      if (b.age >= 1) {
        this.bursts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = 1 - b.age;
      const count = b.mini ? 5 : 8;
      for (let k = 0; k < count; k++) {
        const ang = (k / count) * Math.PI * 2 + (b.mini ? 0.5 : 0);
        const dist = (b.mini ? 3 : 6) + b.age * (b.mini ? 16 : 42);
        ctx.beginPath();
        ctx.arc(
          b.x + Math.cos(ang) * dist,
          b.y + Math.sin(ang) * dist * 0.7 - b.age * (b.mini ? 12 : 26),
          b.mini ? 1.4 + (k % 2) : 2.2 + (k % 3),
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = b.mini
          ? 'rgba(207, 233, 168, 0.9)'
          : b.golden
          ? 'rgba(251, 191, 36, 0.9)'
          : 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

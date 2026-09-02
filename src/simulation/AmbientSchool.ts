/**
 * A distant school of small silhouette fish drifting across the background.
 * Pure atmosphere for Reef mode: not interactive, not cleanable, rendered
 * behind everything at low alpha so the water feels inhabited.
 */

interface SchoolMember {
  ox: number; // offset from school center
  oy: number;
  phase: number; // individual tail/bob phase
  size: number; // body length multiplier
}

export class AmbientSchool {
  private x: number;
  private y: number;
  private dir: 1 | -1;
  private speed: number;
  private depth: number; // 0 = deepest haze, 1 = nearest ambient layer
  private members: SchoolMember[] = [];
  private time: number;

  constructor(width: number, height: number, seed: number) {
    // Deterministic-ish variety per school without a PRNG dependency
    const r = (n: number) => {
      const v = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };

    this.dir = r(0) > 0.5 ? 1 : -1;
    this.depth = 0.16 + r(1) * 0.66;
    this.speed = (0.25 + r(2) * 0.35) * this.depth;
    this.x = r(3) * width;
    this.y = height * (0.12 + r(4) * 0.45);
    this.time = r(5) * 100;

    const count = 6 + Math.floor(r(6) * 6);
    for (let i = 0; i < count; i++) {
      this.members.push({
        ox: (r(10 + i) - 0.5) * (90 + 60 * this.depth),
        oy: (r(20 + i) - 0.5) * 46,
        phase: r(30 + i) * Math.PI * 2,
        size: 0.75 + r(40 + i) * 0.6,
      });
    }
  }

  update(width: number, _height: number, dt: number) {
    this.time += 0.016 * dt;
    this.x += this.dir * this.speed * dt;
    // Gentle vertical wander for the whole school
    this.y += Math.sin(this.time * 0.35) * 0.06 * dt;

    const margin = 160;
    if (this.dir === 1 && this.x > width + margin) this.x = -margin;
    if (this.dir === -1 && this.x < -margin) this.x = width + margin;
  }

  render(ctx: CanvasRenderingContext2D) {
    const baseLen = 7 + 9 * this.depth;
    const alpha = 0.08 + 0.14 * this.depth;
    ctx.save();
    ctx.fillStyle = `rgba(148, 190, 228, ${alpha})`;
    for (const m of this.members) {
      const bob = Math.sin(this.time * 1.6 + m.phase) * 2.5;
      const cx = this.x + m.ox;
      const cy = this.y + m.oy + bob;
      const len = baseLen * m.size;
      const h = len * 0.34;

      ctx.beginPath();
      // Tapered body pointing in swim direction
      ctx.moveTo(cx + this.dir * len * 0.5, cy);
      ctx.quadraticCurveTo(cx, cy - h, cx - this.dir * len * 0.35, cy);
      ctx.quadraticCurveTo(cx, cy + h, cx + this.dir * len * 0.5, cy);
      // Tail fin
      ctx.moveTo(cx - this.dir * len * 0.3, cy);
      ctx.lineTo(cx - this.dir * len * 0.62, cy - h * 0.8);
      ctx.lineTo(cx - this.dir * len * 0.62, cy + h * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

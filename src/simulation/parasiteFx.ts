import { Parasite } from '../types';

/**
 * Shared parasite visuals so every client fish presents the same readable
 * gnathiid-isopod mark, regardless of which fish class renders it.
 *
 * Real gnathiid isopods are roughly the same size no matter the host, so the
 * mark follows the host's scale only loosely: big fish get slightly bigger
 * marks, but small fish never shrink theirs into invisibility.
 */
export function parasiteUnit(hostScale: number): number {
  return Math.min(1.35, Math.max(0.85, hostScale / 4.5));
}

/**
 * Draw one parasite at the current origin (caller has already translated ctx
 * to the parasite's local position on the fish).
 */
export function drawParasite(
  ctx: CanvasRenderingContext2D,
  unit: number,
  time: number,
  id: number,
  gated: boolean = false
) {
  const r = 3.1 * unit;
  const wob = Math.sin(time * 3 + id) * 0.9;
  ctx.save();
  ctx.translate(0, wob);
  ctx.rotate((id % 7) * 0.9 - 2.7); // each tick sits at its own tilt

  // Three pairs of splayed legs
  ctx.strokeStyle = 'rgba(60, 55, 20, 0.8)';
  ctx.lineWidth = Math.max(0.8, unit);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.55, -r * 0.7);
    ctx.lineTo(i * r * 0.8, -r * 1.5);
    ctx.moveTo(i * r * 0.55, r * 0.7);
    ctx.lineTo(i * r * 0.8, r * 1.5);
    ctx.stroke();
  }

  // Straw-pale body (slightly brighter in the delicate zones)
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.25, r * 0.82, 0, 0, Math.PI * 2);
  ctx.fillStyle = gated ? '#f0e6b4' : '#dfd6a6';
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 55, 20, 0.65)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Dark head dot
  ctx.beginPath();
  ctx.arc(-r * 0.5, 0, r * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40, 38, 14, 0.75)';
  ctx.fill();

  ctx.restore();
}

/**
 * Expanding cyan ring after a parasite is eaten. `t` runs 1 -> 0 (the
 * parasite's decaying hoverTimer); the caller decrements it each frame.
 */
export function drawEatRing(ctx: CanvasRenderingContext2D, unit: number, t: number) {
  ctx.beginPath();
  ctx.arc(0, 0, (4 + (1 - t) * 12) * unit, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(34, 211, 238, ${Math.max(0, t) * 0.8})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/**
 * Thin a dense parasite layout down to roughly `target` marks while keeping
 * the mix of attach parts (teeth vs gills vs flank), picking evenly spaced
 * survivors from each group so coverage stays anatomical.
 */
export function subsampleParasites(list: Parasite[], target: number): Parasite[] {
  if (list.length <= target) return list;
  const groups = new Map<string, Parasite[]>();
  for (const p of list) {
    const arr = groups.get(p.attachPart) ?? [];
    arr.push(p);
    groups.set(p.attachPart, arr);
  }
  // The delicate zones (gill flap, teeth) carry the interesting gameplay,
  // so they keep more of their parasites than plain proportion would give.
  const MIN_KEEP: Record<string, number> = { operculum: 3, upperTeeth: 2, lowerTeeth: 2 };
  const out: Parasite[] = [];
  for (const [part, arr] of groups.entries()) {
    const quota = Math.min(
      arr.length,
      Math.max(MIN_KEEP[part] ?? 1, Math.round((arr.length / list.length) * target))
    );
    for (let i = 0; i < quota; i++) {
      out.push(arr[Math.floor(((i + 0.5) * arr.length) / quota)]);
    }
  }
  return out;
}

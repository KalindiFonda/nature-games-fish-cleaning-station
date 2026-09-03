import { ClientSlot } from '../simulation/ClientDirector';

/** Clients that draw behind the reef wall (the moray emerging from its hole). */
export function drawBehindReefClients(ctx: CanvasRenderingContext2D, slots: ClientSlot[]): void {
  for (const slot of slots) {
    ctx.save();
    ctx.globalAlpha *= slot.alpha;
    slot.fish.render(ctx);
    ctx.restore();
  }
}

/**
 * Open-water clients, in the order given (far, small, translucent first;
 * near ones last). Mirrored fish are flipped around their own x so they face
 * right, and travelling fish get a subtle body pitch on their tail beat.
 */
export function drawOpenWaterClients(ctx: CanvasRenderingContext2D, slots: ClientSlot[]): void {
  for (const slot of slots) {
    ctx.save();
    ctx.globalAlpha *= slot.alpha;
    const fx = slot.fish.pos.x;
    const fy = slot.fish.pos.y;
    // Mirrored fish face right: flip the drawing around the fish's own x
    if (slot.mirrored) {
      ctx.translate(fx, fy);
      ctx.scale(-1, 1);
      ctx.translate(-fx, -fy);
    }
    // Subtle body pitch while traveling without distorting shear
    const isLeaving = slot.phase === 'leaving';
    const flex = isLeaving
      ? Math.min(0.006, slot.lastSpeed * 0.001)
      : Math.min(0.018, slot.lastSpeed * 0.0025);
    if (flex > 0.002) {
      const beat = slot.bobPhase * 3.5;
      ctx.translate(fx, fy);
      ctx.rotate(Math.sin(beat) * flex);
      ctx.translate(-fx, -fy);
    }
    slot.fish.render(ctx);
    ctx.restore();
  }
}

import { ClientSlot } from '../simulation/ClientDirector';
import { FrenchGrunt } from '../simulation/FrenchGrunt';

/**
 * Full-body sparkles over a fully-cleaned client during its happy pause.
 * No-op unless the slot is leaving because it was cleaned and its shimmy
 * timer is still running. The french grunt trio sparkles per member.
 */
export function drawCleanedSparkles(ctx: CanvasRenderingContext2D, slot: ClientSlot): void {
  if (!(slot.phase === 'leaving' && slot.leaveReason === 'cleaned' && slot.shimmyT > 0)) return;

  const s = slot.fish.scale;
  ctx.save();
  if (slot.fish instanceof FrenchGrunt) {
    for (const mPos of slot.fish.getMembersWorldPositions()) {
      for (let i = 0; i < 7; i++) {
        const tw = (Math.sin(slot.bobPhase * 8 + i * 2.1) + 1) / 2;
        if (tw < 0.3) continue;
        const px = mPos.x + Math.sin(i * 3.7 + 1.3) * 36 * (0.4 + s * 0.14);
        const py = mPos.y + Math.cos(i * 2.9 + 0.7) * 16 * (0.4 + s * 0.14);
        const r = 2 + tw * 2.5;
        ctx.strokeStyle = `rgba(253, 230, 138, ${0.35 + tw * 0.6})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(px - r, py);
        ctx.lineTo(px + r, py);
        ctx.moveTo(px, py - r);
        ctx.lineTo(px, py + r);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, py, 1.0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 251, 235, ${0.5 + tw * 0.5})`;
        ctx.fill();
      }
    }
  } else {
    for (let i = 0; i < 11; i++) {
      const tw = (Math.sin(slot.bobPhase * 8 + i * 2.1) + 1) / 2;
      if (tw < 0.3) continue;
      const px = slot.pos.x + Math.sin(i * 3.7 + 1.3) * 48 * (0.4 + s * 0.14);
      const py = slot.pos.y + Math.cos(i * 2.9 + 0.7) * 20 * (0.4 + s * 0.14);
      const r = 2 + tw * 3;
      ctx.strokeStyle = `rgba(253, 230, 138, ${0.35 + tw * 0.6})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px - r, py);
      ctx.lineTo(px + r, py);
      ctx.moveTo(px, py - r);
      ctx.lineTo(px, py + r);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 251, 235, ${0.5 + tw * 0.5})`;
      ctx.fill();
    }
  }
  ctx.restore();
}

import { ClientSlot } from '../simulation/ClientDirector';
import { SPECIES } from '../data/species';

/**
 * Gill flap + clamp comedy for the active client: an overlay operculum that
 * cracks open for a nearby cleaner, wiggles as a composure warning and flushes
 * red before it clamps. The grouper and the french grunt trio lift their own
 * drawn opercula, so this is a no-op for them (and for clients whose gill
 * cavity has no anchor yet).
 */
export function drawGillFlap(ctx: CanvasRenderingContext2D, slot: ClientSlot): void {
  if (slot.species === 'grouper' || slot.species === 'french_grunt' || !slot.cavGill.anchorLocal) {
    return;
  }

  const cav = slot.cavGill;
  const anchor = slot.cavGill.anchorLocal;
  const fpx = slot.fish.pos.x;
  const ax = fpx + (slot.mirrored ? -anchor.x : anchor.x);
  const ay = slot.fish.pos.y + anchor.y;
  const s = Math.min(4.5, Math.max(1.6, slot.fish.scale));
  const r = 8 * s;
  const dir = slot.mirrored ? -1 : 1;
  // Hinge at the flap's upper rear; opens by rotating up and back,
  // wiggles as the composure warning, flushes red before the clamp
  const lift = 0.05 + Math.max(0, cav.open) * 0.24; // a modest crack, rear edge lifting

  // Gill chamber revealed as the flap lifts: dark recess with red
  // filament combs - so there's something alive under the cover
  if (cav.open > 0.05) {
    // A narrow slit of gill peeking from under the flap's REAR edge -
    // a modest crack, not a wound
    ctx.save();
    ctx.globalAlpha *= slot.alpha * Math.min(1, cav.open * 1.6);
    ctx.translate(ax, ay);
    ctx.scale(dir, 1);
    ctx.beginPath();
    ctx.ellipse(r * 0.38, r * 0.12, r * 0.3, r * 0.58, -0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#38090e';
    ctx.fill();
    // Comb-like gill filaments: two arch rows of many fine strokes
    for (let row = 0; row < 2; row++) {
      ctx.strokeStyle = row === 1 ? '#d94550' : '#8f1f28';
      ctx.lineWidth = r * 0.05;
      ctx.lineCap = 'round';
      const rx = r * (0.24 + row * 0.16);
      for (let g = 0; g < 7; g++) {
        const t = -0.5 + g / 6;
        const cy0 = r * 0.12 + t * r * 0.9;
        const bow = (1 - Math.abs(t * 2)) * r * 0.08;
        ctx.beginPath();
        ctx.moveTo(rx + bow, cy0);
        ctx.lineTo(rx + bow + r * 0.2, cy0 + r * 0.05);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // The flap cover: hinged at its FRONT-top edge like a real
  // operculum, so it swings up and toward the tail as it opens
  ctx.save();
  ctx.globalAlpha *= slot.alpha * 0.92;
  ctx.translate(ax - dir * r * 0.5, ay - r * 0.7);
  ctx.scale(dir, 1); // +x now points toward the tail
  ctx.rotate(-lift);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(r * 1.15, r * 0.1, r * 1.25, r * 0.85);
  ctx.quadraticCurveTo(r * 1.0, r * 1.5, r * 0.35, r * 1.55);
  ctx.quadraticCurveTo(-r * 0.15, r * 1.1, 0, 0);
  ctx.closePath();
  const flapCol = SPECIES[slot.species].flapColor;
  const flapGrad = ctx.createLinearGradient(0, 0, r * 1.25, r * 0.9);
  flapGrad.addColorStop(0, flapCol.base);
  flapGrad.addColorStop(1, flapCol.edge);
  ctx.fillStyle = flapGrad;
  ctx.fill();
  if (cav.open > 0.15 && cav.composure < 0.6) {
    ctx.fillStyle = `rgba(220, 38, 38, ${(0.6 - cav.composure) * 0.3})`;
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();
}

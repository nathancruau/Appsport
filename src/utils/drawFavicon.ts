import { Platform } from 'react-native';
import { computeFitnessLevel } from './fitnessLevel';

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// volume30 in kg → plate height tier (14–28 px in a 64px canvas)
function plateHeight(volume30: number): number {
  if (volume30 < 1000) return 14;
  if (volume30 < 5000) return 18;
  if (volume30 < 15000) return 22;
  if (volume30 < 40000) return 26;
  return 30;
}

export function drawFavicon(sessions30: number, volume30: number) {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;

  const S = 64;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const level = computeFitnessLevel(sessions30);
  const pH = plateHeight(volume30);
  const pY = Math.round((S - pH) / 2); // vertically centered plates

  // Background: level color
  ctx.fillStyle = level.color;
  rrect(ctx, 0, 0, S, S, 13);
  ctx.fill();

  // Darken slightly for contrast
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rrect(ctx, 0, 0, S, S, 13);
  ctx.fill();

  // Barbell — white
  ctx.fillStyle = '#ffffff';

  // Bar
  rrect(ctx, 14, 28, 36, 8, 3); ctx.fill();

  // Left outer plate
  rrect(ctx, 4, pY, 7, pH, 2); ctx.fill();
  // Left inner plate (thinner, slightly inset)
  rrect(ctx, 11, pY + 3, 4, pH - 6, 2); ctx.fill();

  // Right outer plate
  rrect(ctx, 53, pY, 7, pH, 2); ctx.fill();
  // Right inner plate
  rrect(ctx, 49, pY + 3, 4, pH - 6, 2); ctx.fill();

  // Apply to <link rel="icon">
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = canvas.toDataURL();
}

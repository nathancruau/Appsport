import { useEffect } from 'react';
import { Platform } from 'react-native';
import { getRecentWorkouts } from '../database/database';
import { computeFitnessLevel } from '../utils/fitnessLevel';

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

function drawFavicon(bgColor: string) {
  const S = 64;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = bgColor;
  rrect(ctx, 0, 0, S, S, 13);
  ctx.fill();

  // Barbell (white)
  ctx.fillStyle = '#ffffff';

  // Horizontal bar
  rrect(ctx, 15, 28, 34, 8, 3); ctx.fill();
  // Left outer plate
  rrect(ctx, 5, 18, 7, 28, 2); ctx.fill();
  // Left inner plate
  rrect(ctx, 12, 21, 4, 22, 2); ctx.fill();
  // Right outer plate
  rrect(ctx, 52, 18, 7, 28, 2); ctx.fill();
  // Right inner plate
  rrect(ctx, 48, 21, 4, 22, 2); ctx.fill();

  // Apply to favicon
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/png';
  link.href = canvas.toDataURL();
}

export function useDynamicFavicon() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    (async () => {
      try {
        const workouts = await getRecentWorkouts(50);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const sessions30 = workouts.filter((w) => new Date(w.date) >= cutoff).length;
        const level = computeFitnessLevel(sessions30);
        drawFavicon(level.color);
      } catch {
        drawFavicon('#1A1A1A');
      }
    })();
  }, []);
}

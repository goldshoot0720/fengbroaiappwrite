'use client';
import { useCallback } from 'react';

export interface SubtitleLine {
  text: string;
  startAt: number; // seconds
  endAt: number; // seconds
  language: string;
}

const FONT_FAMILY = '"Noto Sans TC", "Microsoft JhengHei", sans-serif';
/** Base design size (shortest side of portrait 1080×1920) */
const BASE_SHORT = 1080;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function useCanvasRenderer() {
  const drawFrame = useCallback((
    canvas: HTMLCanvasElement,
    image: HTMLImageElement | null,
    subtitleLines: SubtitleLine[],
    elapsed: number,
    showAll = false,
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    if (W <= 0 || H <= 0) return;

    // Scale UI elements so subtitles look right on both 16:9 and 9:16
    const shortSide = Math.min(W, H);
    const scale = shortSide / BASE_SHORT;
    const fontSize = Math.round(38 * scale);
    const lineHeight = fontSize * 1.5;
    const sidePad = Math.round(24 * scale);
    const bottomMargin = Math.round((H > W ? 60 : 48) * scale);

    // ── Background ───────────────────────────────────────────────
    // 1. Draw blurred background (cover fit) to fill empty space
    // 2. Draw complete image (contain fit) so it's fully visible
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, 0, W, H);

    if (image && image.naturalWidth > 0) {
      // Blurred background
      const coverScale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
      const coverW = image.naturalWidth * coverScale;
      const coverH = image.naturalHeight * coverScale;
      const coverX = (W - coverW) / 2;
      const coverY = (H - coverH) / 2;

      ctx.save();
      ctx.filter = 'blur(24px) brightness(0.5)';
      ctx.drawImage(image, coverX, coverY, coverW, coverH);
      ctx.restore();

      // Complete uncropped image
      const imgScale = Math.min(W / image.naturalWidth, H / image.naturalHeight);
      const sw = image.naturalWidth * imgScale;
      const sh = image.naturalHeight * imgScale;
      ctx.drawImage(image, (W - sw) / 2, (H - sh) / 2, sw, sh);
    }

    // ── Active subtitles (text only, no black box) ───────────────
    const active = showAll
      ? subtitleLines
      : subtitleLines.filter(s => elapsed >= s.startAt && elapsed < s.endAt);

    if (active.length === 0) return;

    const groups = new Map<string, SubtitleLine[]>();
    for (const s of active) {
      if (!groups.has(s.language)) groups.set(s.language, []);
      groups.get(s.language)!.push(s);
    }

    let trackY = H - bottomMargin;

    for (const [, subs] of [...groups.entries()].reverse()) {
      const text = subs.map(s => s.text).join(' / ');
      ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
      const maxTextWidth = W - sidePad * 2;
      const lines = wrapText(ctx, text, Math.max(40, maxTextWidth));

      const blockH = lines.length * lineHeight;
      const textTop = trackY - blockH;

      // White text + stroke/shadow for readability without a dark panel
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.lineWidth = Math.max(2, Math.round(4 * scale));
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.round(8 * scale);
      ctx.shadowOffsetY = Math.round(1 * scale);

      lines.forEach((l, i) => {
        const x = W / 2;
        const y = textTop + i * lineHeight;
        ctx.strokeText(l, x, y);
        ctx.fillText(l, x, y);
      });

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 1;

      trackY = textTop - Math.round(12 * scale);
    }
  }, []);

  return { drawFrame };
}

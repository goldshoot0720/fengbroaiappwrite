export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  isSupportedLanguage,
  toSourceCode,
  toTranslateCode,
} from '@/lib/imageVoiceVideo/languages';

async function translateOne(
  text: string,
  source: string,
  target: string,
): Promise<string> {
  if (!text.trim()) return text;
  if (source !== 'auto' && source === target) return text;

  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${encodeURIComponent(source)}` +
    `&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    // yue sometimes fails; fall back to zh-TW
    if (target === 'yue') {
      return translateOne(text, source, 'zh-TW');
    }
    throw new Error(`Google Translate returned ${res.status}`);
  }

  const data = await res.json();
  const translated = (data[0] as [string, unknown][])
    .map(seg => seg[0])
    .join('')
    .trim();

  return translated || text;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lines = body.lines as string[];
    const language = String(body.language ?? 'en-US');
    const sourceLanguage = String(body.source_language ?? 'auto');

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'lines required' }, { status: 400 });
    }
    if (lines.length > 120) {
      return NextResponse.json({ error: 'too many lines' }, { status: 400 });
    }
    if (!isSupportedLanguage(language)) {
      return NextResponse.json(
        { error: `unsupported language: ${language}` },
        { status: 400 },
      );
    }

    const target = toTranslateCode(language);
    if (!target) {
      return NextResponse.json({ lines });
    }

    const source = toSourceCode(sourceLanguage);

    // Same language → pass through
    if (source !== 'auto' && source === target) {
      return NextResponse.json({ lines: lines.map(String) });
    }

    const translated: string[] = [];
    for (const line of lines) {
      translated.push(await translateOne(String(line), source, target));
    }

    return NextResponse.json({ lines: translated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Translate] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

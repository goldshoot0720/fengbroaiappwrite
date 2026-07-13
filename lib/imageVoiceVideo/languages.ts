/** Shared language / voice configuration for TTS + translation */

export interface VoicePair {
  female: string;
  male: string;
  /** Google Translate target code; null = no translation needed */
  translate: string | null;
}

export const VOICE_MAP: Record<string, VoicePair> = {
  'zh-TW': {
    female: 'zh-TW-HsiaoChenNeural',
    male: 'zh-TW-YunJheNeural',
    translate: 'zh-TW',
  },
  'zh-CN': {
    female: 'zh-CN-XiaoxiaoNeural',
    male: 'zh-CN-YunxiNeural',
    translate: 'zh-CN',
  },
  'en-US': {
    female: 'en-US-JennyNeural',
    male: 'en-US-GuyNeural',
    translate: 'en',
  },
  'ja-JP': {
    female: 'ja-JP-NanamiNeural',
    male: 'ja-JP-KeitaNeural',
    translate: 'ja',
  },
  'yue-HK': {
    female: 'zh-HK-HiuMaanNeural',
    male: 'zh-HK-WanLungNeural',
    translate: 'yue',
  },
  'ko-KR': {
    female: 'ko-KR-SunHiNeural',
    male: 'ko-KR-InJoonNeural',
    translate: 'ko',
  },
};

export const LANG_OPTIONS = [
  { value: 'zh-TW', label: '繁體中文', short: '繁中', flag: '🇹🇼' },
  { value: 'zh-CN', label: '簡體中文', short: '簡中', flag: '🇨🇳' },
  { value: 'en-US', label: 'English', short: 'EN', flag: '🇺🇸' },
  { value: 'ja-JP', label: '日本語', short: 'JA', flag: '🇯🇵' },
  { value: 'ko-KR', label: '한국어', short: 'KR', flag: '🇰🇷' },
  { value: 'yue-HK', label: '廣東話', short: '粵', flag: '🇭🇰' },
] as const;

export function isSupportedLanguage(lang: string): boolean {
  return lang in VOICE_MAP;
}

/** Map UI language code → Google Translate target code */
export function toTranslateCode(lang: string): string | null {
  return VOICE_MAP[lang]?.translate ?? null;
}

/** Map UI source language → Google Translate source code */
export function toSourceCode(lang: string): string {
  if (lang === 'auto') return 'auto';
  return VOICE_MAP[lang]?.translate ?? lang;
}

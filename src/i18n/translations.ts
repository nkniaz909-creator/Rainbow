import type { LanguageCode } from '../types';
import type { TranslationKeys } from './keys';
import { en, bn, ar, hi, ur } from './localesA';
import { zhCN, zhTW, ja, ko, es } from './localesB';
import { pt, fr, de, ru, tr } from './localesC';
import { id, ms, th, vi, it } from './localesD';

export type { TranslationKeys };

export const TRANSLATIONS: Record<LanguageCode, TranslationKeys> = {
  en,
  bn,
  ar,
  hi,
  ur,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ko,
  es,
  pt,
  fr,
  de,
  ru,
  tr,
  id,
  ms,
  th,
  vi,
  it,
};

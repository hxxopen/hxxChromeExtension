import type { TranslateSegment, TranslateUsage } from '../common/types';
import { apiFetch } from './client';

export type TranslateApiResult = {
  success: boolean;
  translations: { id: string; text: string }[];
  detected_lang?: string;
  usage?: TranslateUsage;
  error?: string;
  code?: string;
  subscribe_url?: string;
};

export async function translateSegments(
  sourceLang: string,
  targetLang: string,
  segments: TranslateSegment[],
): Promise<TranslateApiResult> {
  return apiFetch<TranslateApiResult>('/api/extension/translate', {
    method: 'POST',
    body: JSON.stringify({
      source_lang: sourceLang,
      target_lang: targetLang,
      segments,
    }),
  });
}

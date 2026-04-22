type TranslationItem = {
  fieldKey: string;
  text: string;
};

type TranslationResult = TranslationItem & {
  translatedText: string;
};

const translationCache = new Map<
  string,
  {
    expiresAt: number;
    value: string;
  }
>();
const translationCacheMaxEntries = 250;
const translationCacheTtlMs = 6 * 60 * 60 * 1000;
const translationFailureCooldownMs = 90 * 1000;
let translationServiceUnavailableUntil = 0;

function normalizeTargetLanguage(targetLanguage: string | undefined): string | null {
  if (targetLanguage === 'en' || targetLanguage === 'zh-TW') {
    return targetLanguage;
  }

  return null;
}

function getCacheKey(targetLanguage: string, text: string): string {
  return `${targetLanguage}::${text}`;
}

function readCachedTranslation(cacheKey: string): string | null {
  const entry = translationCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    translationCache.delete(cacheKey);
    return null;
  }

  translationCache.delete(cacheKey);
  translationCache.set(cacheKey, entry);
  return entry.value;
}

function writeCachedTranslation(cacheKey: string, translatedText: string): string {
  if (translationCache.has(cacheKey)) {
    translationCache.delete(cacheKey);
  }

  translationCache.set(cacheKey, {
    expiresAt: Date.now() + translationCacheTtlMs,
    value: translatedText,
  });

  while (translationCache.size > translationCacheMaxEntries) {
    const oldestKey = translationCache.keys().next().value;
    if (!oldestKey) {
      break;
    }

    translationCache.delete(oldestKey);
  }

  return translatedText;
}

function decodeBasicHtmlEntities(text: string): string {
  return String(text || '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeTranslatedText(text: string, targetLanguage: string): string {
  const normalizedText = String(text || '').trim();

  if (targetLanguage !== 'en') {
    return normalizedText;
  }

  return normalizedText.replace(/(\p{L})\s*[’']\s*(\p{L})/gu, "$1'$2");
}

function extractProviderErrorMessage(responseBody: unknown): string {
  if (!responseBody || typeof responseBody !== 'object') {
    return '';
  }

  const candidate = responseBody as {
    error?: {
      message?: string;
    };
    message?: string;
  };

  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message.trim();
  }

  if (
    candidate.error
    && typeof candidate.error.message === 'string'
    && candidate.error.message.trim()
  ) {
    return candidate.error.message.trim();
  }

  return '';
}

async function parseProviderJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Google Cloud Translation returned unreadable JSON.');
  }
}

function isTranslationServiceCoolingDown(now = Date.now()): boolean {
  return translationServiceUnavailableUntil > now;
}

function openTranslationFailureCooldown(now = Date.now()) {
  translationServiceUnavailableUntil = now + translationFailureCooldownMs;
}

function resetTranslationFailureCooldown() {
  translationServiceUnavailableUntil = 0;
}

async function translateWithGoogleCloud(
  env: Env,
  texts: string[],
  targetLanguage: string,
): Promise<string[]> {
  const apiKey = String(env.GOOGLE_CLOUD_TRANSLATION_API_KEY ?? '').trim();

  if (!apiKey) {
    throw new Error('Google Cloud Translation API key is not configured.');
  }

  const timeoutMs = Math.max(
    1000,
    Number(env.TRANSLATION_PROVIDER_TIMEOUT_MS ?? '10000'),
  );
  const response = await fetch(
    'https://translation.googleapis.com/language/translate/v2',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        format: 'text',
        q: texts,
        target: targetLanguage,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  const responseBody = await parseProviderJsonResponse(response);

  if (!response.ok) {
    const message = extractProviderErrorMessage(responseBody);
    throw new Error(
      message
        ? `Google Cloud Translation returned ${response.status}: ${message}`
        : `Google Cloud Translation returned ${response.status}.`,
    );
  }

  const translations = (
    responseBody as {
      data?: {
        translations?: Array<{
          translatedText?: string;
        }>;
      };
    }
  ).data?.translations;

  if (!Array.isArray(translations) || translations.length !== texts.length) {
    throw new Error('Google Cloud Translation returned an unexpected payload.');
  }

  return translations.map((entry) =>
    decodeBasicHtmlEntities(entry?.translatedText ?? ''),
  );
}

async function requestTranslationBatch(
  env: Env,
  texts: string[],
  targetLanguage: string,
): Promise<string[]> {
  if (isTranslationServiceCoolingDown()) {
    throw new Error('Translation service is cooling down.');
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const translatedTexts = await translateWithGoogleCloud(
        env,
        texts,
        targetLanguage,
      );

      if (translatedTexts.length !== texts.length) {
        throw new Error('Translation count mismatch.');
      }

      resetTranslationFailureCooldown();
      return translatedTexts;
    } catch (error) {
      lastError = error;
    }
  }

  openTranslationFailureCooldown();
  throw lastError ?? new Error('Translation temporarily unavailable.');
}

export async function translateDetailItems(
  env: Env,
  options: {
    items: TranslationItem[];
    targetLanguage?: string;
  },
): Promise<TranslationResult[]> {
  const normalizedTargetLanguage = normalizeTargetLanguage(
    options.targetLanguage,
  );

  if (!normalizedTargetLanguage) {
    return options.items.map((item) => ({
      ...item,
      translatedText: item.text,
    }));
  }

  const translatedTextBySource: Record<string, string> = {};
  const pendingTexts: string[] = [];
  const uniqueTexts = Array.from(
    new Set(options.items.map((item) => item.text).filter(Boolean)),
  );

  uniqueTexts.forEach((text) => {
    const cacheKey = getCacheKey(normalizedTargetLanguage, text);
    const cachedTranslation = readCachedTranslation(cacheKey);

    if (cachedTranslation) {
      translatedTextBySource[text] = cachedTranslation;
      return;
    }

    pendingTexts.push(text);
  });

  if (pendingTexts.length > 0) {
    const translatedPendingTexts = await requestTranslationBatch(
      env,
      pendingTexts,
      normalizedTargetLanguage,
    );

    pendingTexts.forEach((text, index) => {
      const translatedText = normalizeTranslatedText(
        translatedPendingTexts[index] ?? '',
        normalizedTargetLanguage,
      );

      if (!translatedText) {
        throw new Error('Translation result is empty.');
      }

      translatedTextBySource[text] = writeCachedTranslation(
        getCacheKey(normalizedTargetLanguage, text),
        translatedText,
      );
    });
  }

  return options.items.map((item) => ({
    ...item,
    translatedText: translatedTextBySource[item.text] ?? '',
  }));
}

export function resetTranslationCache() {
  translationCache.clear();
  resetTranslationFailureCooldown();
}

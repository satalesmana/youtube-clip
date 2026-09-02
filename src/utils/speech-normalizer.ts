/**
 * Speech Normalizer Utility.
 * Converts written text (with numbers, currency, and foreign proper nouns)
 * into pronunciation-friendly text for Text-to-Speech (TTS) engines,
 * particularly for Indonesian voices (e.g. id-ID-ArdiNeural).
 */

const INDONESIAN_UNITS = [
  '',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas',
];

/**
 * Converts a non-negative integer (< 1e15) to Indonesian words ("terbilang").
 */
export function numberToWordsIndonesian(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  n = Math.floor(Math.abs(n));

  if (n === 0) return 'nol';
  if (n < 12) return INDONESIAN_UNITS[n]!;
  if (n < 20) return `${numberToWordsIndonesian(n - 10)} belas`;
  if (n < 100) {
    const remainder = n % 10;
    return `${numberToWordsIndonesian(Math.floor(n / 10))} puluh${remainder > 0 ? ' ' + numberToWordsIndonesian(remainder) : ''}`;
  }
  if (n < 200) {
    const remainder = n % 100;
    return `seratus${remainder > 0 ? ' ' + numberToWordsIndonesian(remainder) : ''}`;
  }
  if (n < 1000) {
    const remainder = n % 100;
    return `${numberToWordsIndonesian(Math.floor(n / 100))} ratus${remainder > 0 ? ' ' + numberToWordsIndonesian(remainder) : ''}`;
  }
  if (n < 2000) {
    const remainder = n % 1000;
    return `seribu${remainder > 0 ? ' ' + numberToWordsIndonesian(remainder) : ''}`;
  }
  if (n < 1_000_000) {
    const remainder = n % 1000;
    return `${numberToWordsIndonesian(Math.floor(n / 1000))} ribu${remainder > 0 ? ' ' + numberToWordsIndonesian(remainder) : ''}`;
  }
  if (n < 1_000_000_000) {
    const remainder = n % 1_000_000;
    return `${numberToWordsIndonesian(Math.floor(n / 1_000_000))} juta${remainder > 0 ? ' ' + numberToWordsIndonesian(remainder) : ''}`;
  }
  if (n < 1_000_000_000_000) {
    const remainder = n % 1_000_000_000;
    return `${numberToWordsIndonesian(Math.floor(n / 1_000_000_000))} miliar${remainder > 0 ? ' ' + numberToWordsIndonesian(remainder) : ''}`;
  }
  if (n < 1_000_000_000_000_000) {
    const remainder = n % 1_000_000_000_000;
    return `${numberToWordsIndonesian(Math.floor(n / 1_000_000_000_000))} triliun${remainder > 0 ? ' ' + numberToWordsIndonesian(remainder) : ''}`;
  }

  return String(n);
}

/**
 * Common phonetic overrides for proper nouns & foreign loanwords
 * when read by Indonesian TTS voices.
 */
const INDONESIAN_PHONETIC_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  // Football clubs & entities commonly mispronounced by Indonesian TTS
  { pattern: /\bTottenham\s+Hotspur\b/gi, replacement: 'Tot-nem Hotspur' },
  { pattern: /\bTottenham\b/gi, replacement: 'Tot-nem' },
  { pattern: /\bChelsea\b/gi, replacement: 'Cel-si' },
  { pattern: /\bArsenal\b/gi, replacement: 'Ar-se-nal' },
  { pattern: /\bLiverpool\b/gi, replacement: 'Li-ver-pul' },
  { pattern: /\bNewcastle\b/gi, replacement: 'Niu-kas-el' },
  { pattern: /\bManchester\s+United\b/gi, replacement: 'Men-ces-ter Yu-nai-ted' },
  { pattern: /\bManchester\s+City\b/gi, replacement: 'Men-ces-ter Si-ti' },
  { pattern: /\bManchester\b/gi, replacement: 'Men-ces-ter' },
  { pattern: /\bReal\s+Madrid\b/gi, replacement: 'Re-al Mad-rid' },
  { pattern: /\bBayern\s+Munich\b/gi, replacement: 'Bay-ern Myu-nik' },
  { pattern: /\bBayern\s+München\b/gi, replacement: 'Bay-ern Mun-khen' },
  { pattern: /\bJuventus\b/gi, replacement: 'Yu-ven-tus' },
  { pattern: /\bParis\s+Saint-Germain\b/gi, replacement: 'Pa-ri Sen-Zher-meng' },

  // Foreign currency & common terms
  { pattern: /\bpound\s+sterling\b/gi, replacement: 'paund sterling' },
  { pattern: /\bpound\b/gi, replacement: 'paund' },
  { pattern: /\beuro\b/gi, replacement: 'yu-ro' },
  { pattern: /\btransfermarkt\b/gi, replacement: 'transfer-markt' },
  { pattern: /\bvs\.?\b/gi, replacement: 'versus' },
];

/**
 * Normalizes text for speech synthesis according to target language.
 *
 * For Indonesian:
 * 1. Expands currency symbols (£, $, Rp, €) and percentages (%).
 * 2. Expands ordinal numbers ("ke-1", "ke-22").
 * 3. Expands decimal and integer numbers ("226" -> "dua ratus dua puluh enam").
 * 4. Applies phonetic transliterations for known foreign loanwords/clubs.
 */
export function normalizeForSpeech(text: string, language = 'id'): string {
  if (!text || !text.trim()) return '';

  const lang = (language || 'id').toLowerCase();
  if (lang !== 'id') {
    return text;
  }

  let result = text;

  // 1. Currency with numbers: Rp 50.000 or Rp50000 -> 50000 rupiah
  result = result.replace(/Rp\s*([0-9.,]+)/gi, (_match, numStr) => {
    const cleanNum = numStr.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(cleanNum);
    return Number.isFinite(num) ? `${numberToWordsIndonesian(num)} rupiah` : `${numStr} rupiah`;
  });

  // Currency: £ / pound with numbers: £226 -> dua ratus dua puluh enam paund
  result = result.replace(/£\s*([0-9.,]+)/g, (_match, numStr) => {
    const cleanNum = numStr.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(cleanNum);
    return Number.isFinite(num) ? `${numberToWordsIndonesian(num)} paund` : `${numStr} paund`;
  });

  // Currency: $ with numbers: $100 -> seratus dolar
  result = result.replace(/\$\s*([0-9.,]+)/g, (_match, numStr) => {
    const cleanNum = numStr.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(cleanNum);
    return Number.isFinite(num) ? `${numberToWordsIndonesian(num)} dolar` : `${numStr} dolar`;
  });

  // Currency: € with numbers: €100 -> seratus yu-ro
  result = result.replace(/€\s*([0-9.,]+)/g, (_match, numStr) => {
    const cleanNum = numStr.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(cleanNum);
    return Number.isFinite(num) ? `${numberToWordsIndonesian(num)} yu-ro` : `${numStr} yu-ro`;
  });

  // Percentage: 50% or 50,5%
  result = result.replace(/([0-9]+(?:[.,][0-9]+)?)\s*%/g, (_match, numStr) => {
    return `${convertNumberString(numStr)} persen`;
  });

  // Ordinal: ke-1, ke-2, ke-10, etc.
  result = result.replace(/\bke-([0-9]+)\b/gi, (_match, digits) => {
    const n = parseInt(digits, 10);
    if (n === 1) return 'pertama';
    return `kedua${n > 2 ? ' ' + numberToWordsIndonesian(n) : ''}`;
  });

  // Decimal numbers: e.g. "2,5" or "2.5" (when surrounded by spaces or boundaries)
  result = result.replace(/\b([0-9]+)[.,]([0-9]+)\b/g, (_match, whole, frac) => {
    const wholeWord = numberToWordsIndonesian(parseInt(whole, 10));
    // Pronounce fraction digits individually if multiple, or as integer if single
    const fracWords = frac.length === 1
      ? numberToWordsIndonesian(parseInt(frac, 10))
      : frac.split('').map((d: string) => numberToWordsIndonesian(parseInt(d, 10))).join(' ');
    return `${wholeWord} koma ${fracWords}`;
  });

  // Integer numbers: e.g. "226" -> "dua ratus dua puluh enam"
  // Keep years or large digits intact via numberToWordsIndonesian
  result = result.replace(/\b([0-9]+)\b/g, (_match, digits) => {
    // If it's a long sequence (> 12 digits like phone number or ID), read digit-by-digit
    if (digits.length > 12) {
      return digits.split('').map((d: string) => numberToWordsIndonesian(parseInt(d, 10))).join(' ');
    }
    const n = parseInt(digits, 10);
    return numberToWordsIndonesian(n);
  });

  // Apply phonetic replacements
  for (const { pattern, replacement } of INDONESIAN_PHONETIC_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  // Clean up excess spacing
  return result.replace(/\s+/g, ' ').trim();
}

function convertNumberString(raw: string): string {
  if (raw.includes('.') || raw.includes(',')) {
    const parts = raw.split(/[.,]/);
    const whole = parts[0] ? numberToWordsIndonesian(parseInt(parts[0], 10)) : 'nol';
    const frac = parts[1] ? parts[1].split('').map((d) => numberToWordsIndonesian(parseInt(d, 10))).join(' ') : '';
    return `${whole} koma ${frac}`.trim();
  }
  return numberToWordsIndonesian(parseInt(raw, 10));
}

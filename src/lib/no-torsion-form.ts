import type { JsonObject, JsonValue } from '../types';
import { hmacSha256, sha256 } from './crypto';
import { getOrCreateFormProtectionSecret, writeRecord } from './data';
import {
  validateCountyForCity,
  validateProvinceAndCity,
  validateProvinceCode,
} from './no-torsion-area';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SELF_IDENTITY = '受害者本人';
export const AGENT_IDENTITY = '受害者的代理人';
export const OTHER_SEX_OPTION = '__other_option__';
export const CUSTOM_OTHER_SEX_OPTION = '__custom_other_sex__';
export const CUSTOM_AGENT_RELATIONSHIP_OPTION = '__custom_agent_relationship__';
export const CUSTOM_PARENT_MOTIVATION_OPTION = '__custom_parent_motivation__';
export const CUSTOM_VIOLENCE_CATEGORY_OPTION = '__custom_violence_category__';
export const CUSTOM_EXIT_METHOD_OPTION = '__custom_exit_method__';
export const CUSTOM_LEGAL_AID_OPTION = '__custom_legal_aid__';
export const REACT_PORTAL_ENHANCED_FORM_VARIANT = 'react_portal_enhanced';

const allowedIdentities = new Set([SELF_IDENTITY, AGENT_IDENTITY]);
const allowedSexes = new Set(['女性', '男性', OTHER_SEX_OPTION]);
const allowedOtherSexTypes = new Set([
  'MtF',
  'FtM',
  'X',
  'Queer',
  CUSTOM_OTHER_SEX_OPTION,
]);
const allowedAgentRelationshipOptions = new Set([
  '朋友',
  '伴侣',
  '亲属',
  '救助工作者',
  CUSTOM_AGENT_RELATIONSHIP_OPTION,
]);
const allowedParentMotivationOptions = new Set([
  '"网瘾"/游戏沉迷',
  '"厌学"/学业问题',
  '"叛逆"/行为管教',
  '精神或心理健康相关问题',
  '性别认同相关（如跨性别等）',
  '性取向相关（如同性恋、双性恋等）',
  '家庭冲突中的恶意施暴或惩罚手段',
  '咨询师/医生/老师等人士建议',
  '亲属或身边人建议',
  '网络广告或机构宣传误导',
  '不清楚/从未被告知原因',
  CUSTOM_PARENT_MOTIVATION_OPTION,
]);
const allowedViolenceCategoryOptions = new Set([
  '虚假/非法宣传',
  '冒充警察绑架',
  '直接接触的肢体暴力（如扇耳光等）',
  '使用工具的肢体暴力（如棍棒殴打、电击等）',
  '体罚（如长跑等）',
  '限制自由（如捆绑等）',
  '辱骂或公开羞辱',
  '言语的性暴力（如性羞辱等）',
  '肢体的性暴力（如性侵犯等）',
  '关禁闭',
  '饮食限制或不健康饮食',
  '睡眠剥夺',
  '强迫服用药物',
  '性别扭转（如强迫改变外表等）',
  '精神控制或洗脑',
  CUSTOM_VIOLENCE_CATEGORY_OPTION,
]);
const allowedExitMethodOptions = new Set([
  '到期后家长接回',
  '自行逃离',
  '被强制转学',
  '被解救',
  '机构关闭',
  CUSTOM_EXIT_METHOD_OPTION,
]);
const allowedLegalAidOptions = new Set([
  '是',
  '否',
  '想但不知道途径',
  '担心报复',
  CUSTOM_LEGAL_AID_OPTION,
]);
const omittedSubmittedFieldNames = new Set([
  'confirmation_payload',
  'confirmation_token',
  'confirmationPayload',
  'confirmationToken',
  'form_token',
  'g-recaptcha-response',
  'website',
]);
const maxSubmittedFieldTextLength = 8000;
const maxSubmittedFieldArrayLength = 100;
const maxSubmittedFieldObjectDepth = 4;

type SubmitTarget = 'google' | 'd1' | 'both';
type ActualSubmitTarget = 'google' | 'd1';

export type NoTorsionRequestContext = {
  clientIp?: string;
  lang?: string;
  sourcePath?: string;
  userAgent?: string;
};

export type SubmissionTargetResult = {
  error?: string;
  ok: boolean;
  reasonCode?: string;
  recordKey?: string;
};

export type NoTorsionFormValues = {
  abuserInfo: string;
  agentRelationship: string;
  birthDate: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  city: string;
  cityCode: string;
  contactInformation: string;
  county: string;
  countyCode: string;
  dateEnd: string;
  dateStart: string;
  exitMethod: string;
  experience: string;
  googleFormAge: number | null;
  headmasterName: string;
  identity: string;
  latitude: number | null;
  legalAidStatus: string;
  longitude: number | null;
  other: string;
  parentMotivations: string[];
  preInstitutionCity: string;
  preInstitutionCityCode: string;
  preInstitutionProvince: string;
  preInstitutionProvinceCode: string;
  province: string;
  provinceCode: string;
  scandal: string;
  schoolAwarenessBeforeEntry: string;
  schoolAddress: string;
  schoolCoordinates: string;
  schoolName: string;
  sex: string;
  standaloneEnhancements: boolean;
  submittedFields: JsonObject;
  violenceCategories: string[];
};

export type NoTorsionCorrectionValues = {
  city: string;
  cityCode: string;
  contactInformation: string;
  correctionContent: string;
  county: string;
  countyCode: string;
  headmasterName: string;
  province: string;
  provinceCode: string;
  schoolAddress: string;
  schoolName: string;
  submittedFields: JsonObject;
};

export type NoTorsionMediaSummary = {
  id: string;
  fileName: string;
  mediaType: 'image' | 'video';
  contentType: string;
  byteSize: number;
  publicUrl: string;
  status: string;
  isR18: boolean;
  tags: string[];
};

export type NoTorsionFormPrepareResult =
  | {
      encodedPayload: string;
      mediaRecords: NoTorsionMediaSummary[];
      mode: 'preview';
      values: NoTorsionFormValues;
    }
  | {
      confirmationPayload: string;
      confirmationToken: string;
      encodedPayload: string;
      mediaRecords: NoTorsionMediaSummary[];
      mode: 'confirm';
      values: NoTorsionFormValues;
    };

type NoTorsionFormConfirmationState = {
  encodedPayload: string;
  mediaRecords?: NoTorsionMediaSummary[];
  requestContext: NoTorsionRequestContext;
  submissionValues: NoTorsionFormValues;
};

export type NoTorsionConfirmResult = {
  encodedPayload: string;
  mediaRecords: NoTorsionMediaSummary[];
  resultsByTarget: Record<ActualSubmitTarget, SubmissionTargetResult>;
  successfulTargets: ActualSubmitTarget[];
};

export type NoTorsionCorrectionSubmitResult = {
  encodedPayload: string;
  resultsByTarget: Record<ActualSubmitTarget, SubmissionTargetResult>;
  successfulTargets: ActualSubmitTarget[];
  values: NoTorsionCorrectionValues;
};

type GoogleFormField = {
  entryId: string;
  value: string | number;
};

type ValidateResult<TValues> =
  | {
      errors: string[];
      ok: false;
    }
  | {
      errors: [];
      ok: true;
      values: TValues;
    };

function getTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getTrimmedStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => getTrimmedString(item))
      .filter(Boolean);
  }

  const text = getTrimmedString(value);
  return text ? [text] : [];
}

function getUniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeSubmittedFieldValue(
  value: unknown,
  depth = 0,
): JsonValue | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const text = value.trim();
    return text ? text.slice(0, maxSubmittedFieldTextLength) : undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, maxSubmittedFieldArrayLength)
      .map((item) => normalizeSubmittedFieldValue(item, depth + 1))
      .filter((item): item is JsonValue => item !== undefined);

    return items.length > 0 ? items : undefined;
  }

  if (
    value
    && typeof value === 'object'
    && depth < maxSubmittedFieldObjectDepth
  ) {
    const normalizedObject = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<JsonObject>((accumulator, [key, itemValue]) => {
        const trimmedKey = key.trim();
        if (!trimmedKey) {
          return accumulator;
        }

        const normalizedValue = normalizeSubmittedFieldValue(itemValue, depth + 1);
        if (normalizedValue !== undefined) {
          accumulator[trimmedKey] = normalizedValue;
        }

        return accumulator;
      }, {});

    return Object.keys(normalizedObject).length > 0 ? normalizedObject : undefined;
  }

  const text = String(value).trim();
  return text ? text.slice(0, maxSubmittedFieldTextLength) : undefined;
}

function buildSubmittedFields(body: Record<string, unknown>): JsonObject {
  return Object.entries(body)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<JsonObject>((accumulator, [key, value]) => {
      const trimmedKey = key.trim();
      if (!trimmedKey || omittedSubmittedFieldNames.has(trimmedKey)) {
        return accumulator;
      }

      const normalizedValue = normalizeSubmittedFieldValue(value);
      if (normalizedValue !== undefined) {
        accumulator[trimmedKey] = normalizedValue;
      }

      return accumulator;
    }, {});
}

function parseIntegerString(value: unknown): number | null {
  const text = getTrimmedString(value);

  if (!/^-?\d+$/.test(text)) {
    return null;
  }

  return Number.parseInt(text, 10);
}

function parseCoordinatePair(
  value: string,
): { latitude: number; longitude: number } | null {
  const text = getTrimmedString(value);
  if (!text) {
    return null;
  }

  const match =
    /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[,，]\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/.exec(
      text,
    );
  if (!match) {
    return null;
  }

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsedValue =
    typeof value === 'number'
      ? Math.trunc(value)
      : Number.parseInt(String(value ?? ''), 10);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function parseBooleanEnv(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return fallback;
  }

  if (
    normalizedValue === 'true'
    || normalizedValue === '1'
    || normalizedValue === 'yes'
    || normalizedValue === 'on'
  ) {
    return true;
  }

  if (
    normalizedValue === 'false'
    || normalizedValue === '0'
    || normalizedValue === 'no'
    || normalizedValue === 'off'
  ) {
    return false;
  }

  return fallback;
}

function readTrimmedEnvValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function resolveSubmitTarget(
  value: string | undefined,
  fallback: SubmitTarget,
): SubmitTarget {
  const normalizedValue = readTrimmedEnvValue(value).toLowerCase();

  if (
    normalizedValue === 'google'
    || normalizedValue === 'd1'
    || normalizedValue === 'both'
  ) {
    return normalizedValue;
  }

  return fallback;
}

function padNumber(value: number): string {
  return String(value).padStart(2, '0');
}

function buildTokenPayload(issuedAt: number, nonceOrHash: string): string {
  return `${issuedAt}.${nonceOrHash}`;
}

function normalizeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return `${normalized}${'='.repeat(paddingLength)}`;
}

function base64UrlEncode(value: string): string {
  let binary = '';

  for (const byte of encoder.encode(value)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string {
  const binary = atob(normalizeBase64Url(value));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return decoder.decode(bytes);
}

function resolveFormProtectionSecret(env: Env): Promise<string> {
  return getOrCreateFormProtectionSecret(env.DB);
}

export function normalizeGoogleFormSubmitUrl(url: string): string {
  const trimmedUrl = readTrimmedEnvValue(url);
  if (!trimmedUrl) {
    return '';
  }

  return trimmedUrl
    .replace(
      /\/forms\/d\/e\/([^/?#]+)(?:\/(?:viewform|formResponse|edit|prefill))?(?:[?#].*)?$/i,
      '/forms/d/e/$1/formResponse',
    )
    .replace(
      /\/forms\/d\/([^/?#]+)(?:\/(?:viewform|formResponse|edit|prefill))?(?:[?#].*)?$/i,
      '/forms/d/$1/formResponse',
    )
    .replace(/\/viewform(?:[?#].*)?$/i, '/formResponse')
    .replace(/\/prefill(?:[?#].*)?$/i, '/formResponse')
    .replace(/\/formResponse(?:[?#].*)?$/i, '/formResponse');
}

function isPublishedGoogleFormId(value: string): boolean {
  return /^1FAIpQL/i.test(value);
}

export function buildGoogleFormSubmitUrl(options: {
  defaultFormId?: string;
  defaultFormIdSuffix?: string;
  formId?: string;
}): string {
  let resolvedFormId = readTrimmedEnvValue(options.formId);
  if (!resolvedFormId && options.defaultFormId) {
    resolvedFormId = options.defaultFormId;
  }

  if (!resolvedFormId) {
    return '';
  }

  if (/^https?:\/\//i.test(resolvedFormId)) {
    return '';
  }

  if (
    options.defaultFormId
    && options.defaultFormIdSuffix
    && resolvedFormId === options.defaultFormId
    && !resolvedFormId.endsWith(options.defaultFormIdSuffix)
  ) {
    resolvedFormId = `${resolvedFormId}${options.defaultFormIdSuffix}`;
  }

  const formPath = isPublishedGoogleFormId(resolvedFormId) ? 'd/e' : 'd';
  return `https://docs.google.com/forms/${formPath}/${resolvedFormId}/formResponse`;
}

function getFormGoogleSubmitUrl(env: Env): string {
  return buildGoogleFormSubmitUrl({
    defaultFormId: '1FAIpQLScolfqJ9dbvJxhjoKYVlmKGwHmy7RiQThutDXpKj7W7jGytfg',
    formId: readTrimmedEnvValue(env.NO_TORSION_FORM_ID),
  });
}

function getCorrectionGoogleSubmitUrl(env: Env): string {
  return buildGoogleFormSubmitUrl({
    defaultFormId: '1FAIpQLSfiXdpt8CgOGZQhvsJTc1koQbvXFo6eWfnigQ329r1',
    defaultFormIdSuffix: '-3DniNA',
    formId: readTrimmedEnvValue(env.NO_TORSION_CORRECTION_FORM_ID),
  });
}

function getFormDryRun(env: Env): boolean {
  return parseBooleanEnv(
    readTrimmedEnvValue(env.NO_TORSION_FORM_DRY_RUN),
    true,
  );
}

function getFormSubmitTarget(env: Env): SubmitTarget {
  return resolveSubmitTarget(
    readTrimmedEnvValue(env.NO_TORSION_FORM_SUBMIT_TARGET),
    'both',
  );
}

function getCorrectionSubmitTarget(env: Env): SubmitTarget {
  return resolveSubmitTarget(
    readTrimmedEnvValue(env.NO_TORSION_CORRECTION_SUBMIT_TARGET),
    'both',
  );
}

function getFormProtectionMinFillMs(env: Env): number {
  return normalizePositiveInteger(
    readTrimmedEnvValue(env.NO_TORSION_FORM_PROTECTION_MIN_FILL_MS),
    3000,
  );
}

function getFormProtectionMaxAgeMs(env: Env): number {
  return normalizePositiveInteger(
    readTrimmedEnvValue(env.NO_TORSION_FORM_PROTECTION_MAX_AGE_MS),
    24 * 60 * 60 * 1000,
  );
}

async function secureEquals(left: string, right: string): Promise<boolean> {
  const leftDigest = await sha256(`left:${left}`);
  const rightDigest = await sha256(`left:${right}`);
  return leftDigest === rightDigest;
}

function validateDateString(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function validateTextField(
  errors: string[],
  label: string,
  value: unknown,
  options: {
    maxLength?: number;
    required?: boolean;
  } = {},
): string {
  const text = getTrimmedString(value);

  if (options.required && !text) {
    errors.push(`${label} is required.`);
    return '';
  }

  if (typeof options.maxLength === 'number' && text.length > options.maxLength) {
    errors.push(`${label} must be at most ${options.maxLength} characters.`);
  }

  return text;
}

function validateChoiceValue(
  errors: string[],
  label: string,
  value: unknown,
  allowedValues: Set<string>,
): string {
  const text = getTrimmedString(value);
  if (!text) {
    return '';
  }

  if (!allowedValues.has(text)) {
    errors.push(`${label} is invalid.`);
    return '';
  }

  return text;
}

function validateChoiceValues(
  errors: string[],
  label: string,
  value: unknown,
  allowedValues: Set<string>,
  options: {
    required?: boolean;
  } = {},
): string[] {
  const normalizedValues = getUniqueValues(getTrimmedStringArray(value));
  const validValues = normalizedValues.filter((item) =>
    allowedValues.has(item),
  );

  if (normalizedValues.length !== validValues.length) {
    errors.push(`${label} contains invalid choices.`);
  }

  if (options.required && validValues.length === 0) {
    errors.push(`${label} is required.`);
  }

  return validValues;
}

function validateFinalLength(
  errors: string[],
  label: string,
  value: string,
  maxLength: number | undefined,
) {
  if (typeof maxLength === 'number' && String(value).length > maxLength) {
    errors.push(`${label} must be at most ${maxLength} characters.`);
  }
}

function buildCustomChoiceValue(
  choiceValue: string,
  customOptionValue: string,
  customText: string,
): string {
  if (!choiceValue) {
    return '';
  }

  return choiceValue === customOptionValue ? customText : choiceValue;
}

function buildNormalizedSexValue(
  sex: string,
  sexOtherType: string,
  sexOther: string,
): string {
  if (sex !== OTHER_SEX_OPTION) {
    return sex;
  }

  if (sexOtherType === CUSTOM_OTHER_SEX_OPTION) {
    return sexOther;
  }

  if (sexOtherType && sexOther) {
    return `${sexOtherType} / ${sexOther}`;
  }

  return sexOtherType || sexOther;
}

function calculateApproximateAgeFromBirthYear(
  birthYear: number,
  now = new Date(),
): number | null {
  if (!Number.isInteger(birthYear)) {
    return null;
  }

  return now.getUTCFullYear() - birthYear;
}

function getFormRules(now = new Date()) {
  const currentYear = now.getUTCFullYear();

  return {
    abuserInfo: { label: 'Abuser information', maxLength: 600 },
    agentRelationship: { label: 'Relationship', maxLength: 30 },
    birthYear: { label: 'Birth year', max: currentYear, min: 1900 },
    contactInformation: { label: 'Contact information', maxLength: 30, required: true },
    dateEnd: { label: 'End date' },
    dateStart: { label: 'Start date', required: true },
    exitMethod: { label: 'Exit method' },
    exitMethodOther: { label: 'Other exit method', maxLength: 120 },
    experience: { label: 'Experience', maxLength: 8000 },
    headmasterName: { label: 'Headmaster name', maxLength: 10 },
    legalAidOther: { label: 'Other legal aid status', maxLength: 120 },
    legalAidStatus: { label: 'Legal aid status' },
    other: { label: 'Other', maxLength: 3000 },
    parentMotivationOther: { label: 'Other parent motivation', maxLength: 120 },
    parentMotivations: { label: 'Parent motivations' },
    provinceCode: { label: 'Province', required: true },
    schoolAwarenessBeforeEntry: { label: 'Pre-entry school awareness', maxLength: 1000 },
    schoolAddress: { label: 'School address', maxLength: 50 },
    schoolCoordinates: { label: 'Coordinates', maxLength: 64 },
    schoolName: { label: 'School name', maxLength: 20, required: true },
    scandal: { label: 'Scandal', maxLength: 3000 },
    sex: { label: 'Sex', required: true },
    sexOther: { label: 'Other sex', maxLength: 30 },
    violenceCategories: { label: 'Violence categories' },
    violenceCategoryOther: { label: 'Other violence category', maxLength: 120 },
  };
}

export async function issueFormProtectionToken(env: Env): Promise<string> {
  const issuedAt = Date.now();
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(nonceBytes)
    .map((chunk) => chunk.toString(16).padStart(2, '0'))
    .join('');
  const payload = buildTokenPayload(issuedAt, nonce);
  const signature = await hmacSha256(
    payload,
    await resolveFormProtectionSecret(env),
  );

  return `${payload}.${signature}`;
}

export async function validateFormProtection(
  env: Env,
  options: {
    honeypotValue?: unknown;
    now?: number;
    token?: unknown;
  },
): Promise<
  | {
      ageMs?: number;
      ok: false;
      reason: 'expired_token' | 'honeypot_filled' | 'invalid_token' | 'submitted_too_quickly';
    }
  | {
      ageMs: number;
      issuedAt: number;
      ok: true;
    }
> {
  const normalizedHoneypot = getTrimmedString(options.honeypotValue);
  if (normalizedHoneypot) {
    return {
      ok: false,
      reason: 'honeypot_filled',
    };
  }

  const tokenMatch = /^(\d{10,16})\.([a-f0-9]{32})\.([a-f0-9]{64})$/i.exec(
    getTrimmedString(options.token),
  );

  if (!tokenMatch) {
    return {
      ok: false,
      reason: 'invalid_token',
    };
  }

  const issuedAt = Number.parseInt(tokenMatch[1] ?? '', 10);
  const nonce = tokenMatch[2] ?? '';
  const signature = tokenMatch[3] ?? '';
  const payload = buildTokenPayload(issuedAt, nonce);
  const expectedSignature = await hmacSha256(
    payload,
    await resolveFormProtectionSecret(env),
  );

  if (!(await secureEquals(signature, expectedSignature))) {
    return {
      ok: false,
      reason: 'invalid_token',
    };
  }

  const now = normalizePositiveInteger(options.now, Date.now());
  const ageMs = now - issuedAt;
  const minFillMs = getFormProtectionMinFillMs(env);
  const maxAgeMs = getFormProtectionMaxAgeMs(env);

  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return {
      ageMs,
      ok: false,
      reason: 'invalid_token',
    };
  }

  if (ageMs < minFillMs) {
    return {
      ageMs,
      ok: false,
      reason: 'submitted_too_quickly',
    };
  }

  if (ageMs > maxAgeMs) {
    return {
      ageMs,
      ok: false,
      reason: 'expired_token',
    };
  }

  return {
    ageMs,
    issuedAt,
    ok: true,
  };
}

async function issueFormConfirmationToken(
  env: Env,
  payload: string,
  issuedAt = Date.now(),
): Promise<string> {
  const normalizedIssuedAt = normalizePositiveInteger(issuedAt, Date.now());
  const payloadHash = await sha256(payload);
  const tokenPayload = buildTokenPayload(normalizedIssuedAt, payloadHash);
  const signature = await hmacSha256(
    tokenPayload,
    await resolveFormProtectionSecret(env),
  );

  return `${tokenPayload}.${signature}`;
}

async function validateFormConfirmation(
  env: Env,
  options: {
    now?: number;
    payload: string;
    token: string;
  },
): Promise<
  | {
      ageMs?: number;
      ok: false;
      reason: 'expired_token' | 'invalid_token';
    }
  | {
      ageMs: number;
      issuedAt: number;
      ok: true;
    }
> {
  const tokenMatch = /^(\d{10,16})\.([a-f0-9]{64})\.([a-f0-9]{64})$/i.exec(
    getTrimmedString(options.token),
  );

  if (!tokenMatch) {
    return {
      ok: false,
      reason: 'invalid_token',
    };
  }

  const issuedAt = Number.parseInt(tokenMatch[1] ?? '', 10);
  const expectedPayloadHash = tokenMatch[2] ?? '';
  const signature = tokenMatch[3] ?? '';
  const actualPayloadHash = await sha256(options.payload);

  if (!(await secureEquals(expectedPayloadHash, actualPayloadHash))) {
    return {
      ok: false,
      reason: 'invalid_token',
    };
  }

  const tokenPayload = buildTokenPayload(issuedAt, expectedPayloadHash);
  const expectedSignature = await hmacSha256(
    tokenPayload,
    await resolveFormProtectionSecret(env),
  );

  if (!(await secureEquals(signature, expectedSignature))) {
    return {
      ok: false,
      reason: 'invalid_token',
    };
  }

  const now = normalizePositiveInteger(options.now, Date.now());
  const ageMs = now - issuedAt;
  const maxAgeMs = getFormProtectionMaxAgeMs(env);

  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return {
      ageMs,
      ok: false,
      reason: 'invalid_token',
    };
  }

  if (ageMs > maxAgeMs) {
    return {
      ageMs,
      ok: false,
      reason: 'expired_token',
    };
  }

  return {
    ageMs,
    issuedAt,
    ok: true,
  };
}

function buildGoogleFormSexFields(sexValue: string): GoogleFormField[] {
  if (sexValue === '男性') {
    return [{ entryId: 'entry.1422578992', value: '男' }];
  }

  if (sexValue === '女性') {
    return [{ entryId: 'entry.1422578992', value: '女' }];
  }

  if (sexValue === 'MtF' || sexValue === 'FtM' || sexValue === 'X' || sexValue === 'Queer') {
    return [{ entryId: 'entry.1422578992', value: sexValue }];
  }

  return [
    { entryId: 'entry.1422578992', value: OTHER_SEX_OPTION },
    {
      entryId: 'entry.1422578992.other_option_response',
      value: sexValue,
    },
  ];
}

function buildGoogleFormAgentRelationshipFields(
  values: NoTorsionFormValues,
): GoogleFormField[] {
  if (values.identity === SELF_IDENTITY) {
    return [
      { entryId: 'entry.981546984', value: OTHER_SEX_OPTION },
      { entryId: 'entry.981546984.other_option_response', value: '本人' },
    ];
  }

  if (values.agentRelationship === '伴侣') {
    return [{ entryId: 'entry.981546984', value: '伴侶' }];
  }

  if (values.agentRelationship === '亲属') {
    return [{ entryId: 'entry.981546984', value: '親屬' }];
  }

  if (
    values.agentRelationship === '朋友'
    || values.agentRelationship === '伴侶'
    || values.agentRelationship === '親屬'
    || values.agentRelationship === '救助工作者'
  ) {
    return [{ entryId: 'entry.981546984', value: values.agentRelationship }];
  }

  return [
    { entryId: 'entry.981546984', value: OTHER_SEX_OPTION },
    {
      entryId: 'entry.981546984.other_option_response',
      value: values.agentRelationship || '未填写',
    },
  ];
}

function buildGoogleFormListValue(values: string[]): string {
  return values.filter(Boolean).join('；');
}

function normalizeGoogleFormProvinceValue(province: string): string {
  return province === '臺灣' ? '臺灣（ROC）' : province;
}

export function buildGoogleFormFields(values: NoTorsionFormValues): GoogleFormField[] {
  const fields: GoogleFormField[] = [
    { entryId: 'entry.500021634', value: values.identity },
    ...buildGoogleFormAgentRelationshipFields(values),
    { entryId: 'entry.842223433', value: values.birthDate },
    ...buildGoogleFormSexFields(values.sex),
    { entryId: 'entry.145491361', value: normalizeGoogleFormProvinceValue(values.preInstitutionProvince) },
    { entryId: 'entry.1367743406', value: values.preInstitutionCity },
    {
      entryId: 'entry.681431781',
      value: buildGoogleFormListValue(values.parentMotivations),
    },
    { entryId: 'entry.38011337', value: values.schoolAwarenessBeforeEntry },
    { entryId: 'entry.578287646', value: values.experience },
    { entryId: 'entry.93256047', value: values.exitMethod },
    { entryId: 'entry.1184547907', value: values.legalAidStatus },
    { entryId: 'entry.5034928', value: values.schoolName },
    {
      entryId: 'entry.1766160152',
      value: normalizeGoogleFormProvinceValue(values.province),
    },
    { entryId: 'entry.402227428', value: values.city },
    { entryId: 'entry.1624809773', value: values.county },
    { entryId: 'entry.1390240202', value: values.schoolAddress },
    { entryId: 'entry.534528800', value: values.schoolCoordinates },
    { entryId: 'entry.883193772', value: values.contactInformation },
    { entryId: 'entry.1533497153', value: values.headmasterName },
    { entryId: 'entry.1085954426', value: values.abuserInfo },
    {
      entryId: 'entry.1895858332',
      value: buildGoogleFormListValue(values.violenceCategories),
    },
    { entryId: 'entry.1400127416', value: values.scandal },
    { entryId: 'entry.2022959936', value: values.other },
  ];

  if (values.dateStart) {
    fields.push({
      entryId: 'entry.1344969670',
      value: values.dateStart,
    });
  }

  if (values.dateEnd) {
    fields.push({
      entryId: 'entry.129670533',
      value: values.dateEnd,
    });
  }

  return fields;
}

export function buildCorrectionGoogleFormFields(
  values: NoTorsionCorrectionValues,
): GoogleFormField[] {
  return [
    { entryId: 'entry.270706445', value: values.schoolName },
    { entryId: 'entry.1237975400', value: values.province },
    { entryId: 'entry.1335981183', value: values.city },
    { entryId: 'entry.1939582367', value: values.county },
    { entryId: 'entry.1986759404', value: values.schoolAddress },
    { entryId: 'entry.1979228646', value: values.contactInformation },
    { entryId: 'entry.1490111424', value: values.headmasterName },
    { entryId: 'entry.302336209', value: values.correctionContent },
  ];
}

export function encodeGoogleFormFields(fields: GoogleFormField[]): string {
  const params = new URLSearchParams();

  fields.forEach((field) => {
    params.append(field.entryId, String(field.value ?? ''));
  });

  return params.toString();
}

async function submitToGoogleForm(
  googleFormUrl: string,
  encodedPayload: string,
): Promise<void> {
  if (!getTrimmedString(googleFormUrl)) {
    throw new Error('Google Form submit URL is not configured.');
  }

  const response = await fetch(googleFormUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: encodedPayload,
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });

  if (response.status < 200 || response.status >= 400) {
    throw new Error(`Google Form returned ${response.status}.`);
  }
}

function decodeConfirmationPayload(
  payload: string,
): NoTorsionFormConfirmationState {
  const decodedPayload = base64UrlDecode(getTrimmedString(payload));
  const parsedPayload = JSON.parse(decodedPayload) as Partial<NoTorsionFormConfirmationState>;

  if (
    !parsedPayload
    || typeof parsedPayload !== 'object'
    || typeof parsedPayload.encodedPayload !== 'string'
    || !parsedPayload.submissionValues
    || typeof parsedPayload.submissionValues !== 'object'
  ) {
    throw new Error('Invalid confirmation payload.');
  }

  return {
    encodedPayload: parsedPayload.encodedPayload,
    mediaRecords: Array.isArray(parsedPayload.mediaRecords)
      ? (parsedPayload.mediaRecords as NoTorsionMediaSummary[])
      : [],
    requestContext:
      parsedPayload.requestContext && typeof parsedPayload.requestContext === 'object'
        ? parsedPayload.requestContext
        : {},
    submissionValues: parsedPayload.submissionValues as NoTorsionFormValues,
  };
}

function parseMediaRecords(value: unknown): NoTorsionMediaSummary[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
      .map((item): NoTorsionMediaSummary => ({
        id: typeof item.id === 'string' ? item.id : '',
        fileName: typeof item.fileName === 'string' ? item.fileName : '',
        mediaType: item.mediaType === 'video' ? 'video' : 'image',
        contentType: typeof item.contentType === 'string' ? item.contentType : '',
        byteSize: typeof item.byteSize === 'number' ? item.byteSize : 0,
        publicUrl: typeof item.publicUrl === 'string' ? item.publicUrl : '',
        status: typeof item.status === 'string' ? item.status : 'unknown',
        isR18: Boolean(item.isR18),
        tags: Array.isArray(item.tags)
          ? (item.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string')
          : [],
      }))
      .filter((entry) => entry.id && entry.fileName);
  } catch {
    return [];
  }
}

function encodeConfirmationPayload(
  confirmationState: NoTorsionFormConfirmationState,
): string {
  return base64UrlEncode(JSON.stringify(confirmationState));
}

function buildFormStoragePayload(
  values: NoTorsionFormValues,
  requestContext: NoTorsionRequestContext,
  clientIpHash: string | null,
): JsonObject {
  return {
    HMaster: values.headmasterName,
    addr: values.schoolAddress,
    agentRelationship: values.agentRelationship,
    birthDate: values.birthDate,
    birthYear: values.birthYear,
    city: values.city,
    cityCode: values.cityCode,
    clientIpHash,
    contact: values.contactInformation,
    county: values.county,
    countyCode: values.countyCode,
    dateEnd: values.dateEnd,
    dateStart: values.dateStart,
    else: values.other,
    experience: values.experience,
    exitMethod: values.exitMethod,
    headmasterName: values.headmasterName,
    inputType: values.identity,
    lang: getTrimmedString(requestContext.lang) || 'zh-CN',
    lat: values.latitude,
    latitude: values.latitude,
    legalAidStatus: values.legalAidStatus,
    lng: values.longitude,
    longitude: values.longitude,
    name: values.schoolName,
    other: values.other,
    parentMotivations: values.parentMotivations,
    preInstitutionCity: values.preInstitutionCity,
    preInstitutionCityCode: values.preInstitutionCityCode,
    preInstitutionProvince: values.preInstitutionProvince,
    preInstitutionProvinceCode: values.preInstitutionProvinceCode,
    province: values.province,
    provinceCode: values.provinceCode,
    recordKind: 'no_torsion_form',
    scandal: values.scandal,
    schoolAwarenessBeforeEntry: values.schoolAwarenessBeforeEntry,
    schoolAddress: values.schoolAddress,
    schoolCoordinates: values.schoolCoordinates,
    schoolName: values.schoolName,
    sex: values.sex,
    source: 'No-Torsion',
    sourcePath: getTrimmedString(requestContext.sourcePath) || '/submit',
    standaloneEnhancements: values.standaloneEnhancements,
    submittedFields: values.submittedFields,
    submittedAt: new Date().toISOString(),
    userAgent: getTrimmedString(requestContext.userAgent).slice(0, 512),
    violenceCategories: values.violenceCategories,
    abuserInfo: values.abuserInfo,
  };
}

function buildCorrectionStoragePayload(
  values: NoTorsionCorrectionValues,
  requestContext: NoTorsionRequestContext,
  clientIpHash: string | null,
): JsonObject {
  return {
    city: values.city,
    cityCode: values.cityCode,
    clientIpHash,
    contactInformation: values.contactInformation,
    correctionContent: values.correctionContent,
    county: values.county,
    countyCode: values.countyCode,
    headmasterName: values.headmasterName,
    lang: getTrimmedString(requestContext.lang) || 'zh-CN',
    name: values.schoolName,
    province: values.province,
    provinceCode: values.provinceCode,
    recordKind: 'no_torsion_correction',
    schoolAddress: values.schoolAddress,
    schoolName: values.schoolName,
    source: 'No-Torsion',
    sourcePath:
      getTrimmedString(requestContext.sourcePath) || '/map/correction/submit',
    submittedFields: values.submittedFields,
    submittedAt: new Date().toISOString(),
    userAgent: getTrimmedString(requestContext.userAgent).slice(0, 512),
  };
}

async function hashClientIp(clientIp: string | undefined): Promise<string | null> {
  const normalizedIp = getTrimmedString(clientIp);
  if (!normalizedIp || normalizedIp === 'unknown') {
    return null;
  }

  return sha256(normalizedIp.replace(/^::ffff:/, ''));
}

function getSubmitTargets(submitTarget: SubmitTarget): ActualSubmitTarget[] {
  if (submitTarget === 'both') {
    return ['google', 'd1'];
  }

  if (submitTarget === 'd1') {
    return ['d1'];
  }

  return ['google'];
}

function shouldUseEnhancedQuestionnaire(body: Record<string, unknown>): boolean {
  return (
    getTrimmedString(body.form_variant) === REACT_PORTAL_ENHANCED_FORM_VARIANT
    || getTrimmedString(body.standalone_enhancements) === 'true'
  );
}

export function validateNoTorsionFormSubmission(
  body: Record<string, unknown>,
): ValidateResult<NoTorsionFormValues> {
  const standaloneEnhancements = shouldUseEnhancedQuestionnaire(body);
  const errors: string[] = [];
  const formRules = getFormRules();
  const submittedFields = buildSubmittedFields(body);
  const identity = getTrimmedString(body.identity);
  const birthYearValue = getTrimmedString(body.birth_year);
  const birthMonthValue = '1';
  const birthDayValue = '1';
  const birthYear = parseIntegerString(body.birth_year);
  const birthMonth = 1;
  const birthDay = 1;
  const sex = getTrimmedString(body.sex);
  const sexOtherType = getTrimmedString(body.sex_other_type);
  const sexOther = validateTextField(
    errors,
    formRules.sexOther.label,
    body.sex_other,
    { maxLength: formRules.sexOther.maxLength },
  );
  const provinceCode = getTrimmedString(body.provinceCode);
  const cityCode = getTrimmedString(body.cityCode);
  const countyCode = getTrimmedString(body.countyCode);
  const schoolName = validateTextField(
    errors,
    formRules.schoolName.label,
    body.school_name,
    {
      maxLength: formRules.schoolName.maxLength,
      required: formRules.schoolName.required,
    },
  );
  const schoolAddress = validateTextField(
    errors,
    formRules.schoolAddress.label,
    body.school_address,
    { maxLength: formRules.schoolAddress.maxLength },
  );
  const schoolCoordinates = validateTextField(
    errors,
    formRules.schoolCoordinates.label,
    body.school_coordinates,
    { maxLength: formRules.schoolCoordinates.maxLength },
  );
  const dateStart = getTrimmedString(body.date_start);
  const dateEnd = getTrimmedString(body.date_end);
  const experienceInput = validateTextField(
    errors,
    formRules.experience.label,
    body.experience,
  );
  const schoolAwarenessBeforeEntryInput = validateTextField(
    errors,
    formRules.schoolAwarenessBeforeEntry.label,
    body.school_awareness_before_entry,
    { maxLength: formRules.schoolAwarenessBeforeEntry.maxLength },
  );
  const headmasterName = validateTextField(
    errors,
    formRules.headmasterName.label,
    body.headmaster_name,
    { maxLength: formRules.headmasterName.maxLength },
  );
  const contactInformation = validateTextField(
    errors,
    formRules.contactInformation.label,
    body.contact_information,
    {
      maxLength: formRules.contactInformation.maxLength,
      required: formRules.contactInformation.required,
    },
  );
  const scandalInput = validateTextField(
    errors,
    formRules.scandal.label,
    body.scandal,
  );
  const otherInput = validateTextField(
    errors,
    formRules.other.label,
    body.other,
  );
  const agentRelationshipChoice = validateChoiceValue(
    errors,
    formRules.agentRelationship.label,
    body.agent_relationship,
    allowedAgentRelationshipOptions,
  );
  const agentRelationshipOther = validateTextField(
    errors,
    formRules.agentRelationship.label,
    body.agent_relationship_other,
    { maxLength: formRules.agentRelationship.maxLength },
  );

  let birthDate = '';
  let googleFormAge: number | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  let validatedLocation: ReturnType<typeof validateProvinceAndCity> = null;
  let validatedCounty: ReturnType<typeof validateCountyForCity> = null;
  let validatedPreInstitutionProvince: ReturnType<typeof validateProvinceCode> = null;
  let validatedPreInstitutionLocation: ReturnType<typeof validateProvinceAndCity> = null;
  let agentRelationship = '';
  let parentMotivations: string[] = [];
  let abuserInfo = '';
  let violenceCategories: string[] = [];
  let exitMethod = '';
  let legalAidStatus = '';

  if (!birthYearValue) {
    errors.push('Birth year is required.');
  } else if (birthYear === null) {
    errors.push('Birth year is invalid.');
  } else if (
    birthYear < formRules.birthYear.min
    || birthYear > formRules.birthYear.max
  ) {
    errors.push('Birth year is invalid.');
  } else {
    const normalizedBirthYear = birthYear;

    birthDate = `${String(normalizedBirthYear).padStart(4, '0')}-${padNumber(
      birthMonth,
    )}-${padNumber(birthDay)}`;

    if (!validateDateString(birthDate)) {
      errors.push('Birth year is invalid.');
    } else {
      const nextGoogleFormAge = calculateApproximateAgeFromBirthYear(
        normalizedBirthYear,
      );
      googleFormAge = nextGoogleFormAge;

      if (
        nextGoogleFormAge === null
        || nextGoogleFormAge < 0
        || nextGoogleFormAge > 100
      ) {
        errors.push('Age is out of range.');
      }
    }
  }

  if (!allowedIdentities.has(identity)) {
    errors.push('Identity is invalid.');
  }

  if (identity === AGENT_IDENTITY && agentRelationshipChoice) {
    if (
      agentRelationshipChoice === CUSTOM_AGENT_RELATIONSHIP_OPTION
      && !agentRelationshipOther
    ) {
      errors.push('Relationship is required.');
    } else {
      agentRelationship = buildCustomChoiceValue(
        agentRelationshipChoice,
        CUSTOM_AGENT_RELATIONSHIP_OPTION,
        agentRelationshipOther,
      );
    }
  }

  if (!sex) {
    errors.push('Sex is required.');
  } else if (!allowedSexes.has(sex)) {
    errors.push('Sex is invalid.');
  }

  if (sexOtherType && !allowedOtherSexTypes.has(sexOtherType)) {
    errors.push('Other sex is invalid.');
  }

  if (sex === OTHER_SEX_OPTION && !sexOtherType && !sexOther) {
    errors.push('Please describe the custom sex option.');
  }

  if (sex === OTHER_SEX_OPTION && sexOtherType === CUSTOM_OTHER_SEX_OPTION && !sexOther) {
    errors.push('Please describe the custom sex option.');
  }

  if (!provinceCode) {
    errors.push('Province is required.');
  }

  if (!cityCode) {
    errors.push('City is required.');
  }

  if (provinceCode && cityCode) {
    validatedLocation = validateProvinceAndCity(provinceCode, cityCode);
    if (!validatedLocation) {
      errors.push('Province and city do not match.');
    }
  }

  if (validatedLocation && countyCode) {
    validatedCounty = validateCountyForCity(cityCode, countyCode);
    if (!validatedCounty) {
      errors.push('City and county do not match.');
    }
  }

  if (schoolCoordinates) {
    const coordinatePair = parseCoordinatePair(schoolCoordinates);
    if (!coordinatePair) {
      errors.push('Coordinates are invalid.');
    } else {
      latitude = coordinatePair.latitude;
      longitude = coordinatePair.longitude;
    }
  }

  if (!dateStart) {
    errors.push('Start date is required.');
  } else if (!validateDateString(dateStart)) {
    errors.push('Start date is invalid.');
  }

  if (dateEnd && !validateDateString(dateEnd)) {
    errors.push('End date is invalid.');
  }

  if (dateStart && dateEnd && dateEnd < dateStart) {
    errors.push('End date cannot be earlier than the start date.');
  }

  if (standaloneEnhancements) {
    const preInstitutionProvinceCode = getTrimmedString(
      body.pre_institution_province_code,
    );
    const preInstitutionCityCode = getTrimmedString(
      body.pre_institution_city_code,
    );
    const parentMotivationChoices = validateChoiceValues(
      errors,
      formRules.parentMotivations.label,
      body.parent_motivations,
      allowedParentMotivationOptions,
      { required: true },
    );
    const parentMotivationOther = validateTextField(
      errors,
      formRules.parentMotivationOther.label,
      body.parent_motivation_other,
      { maxLength: formRules.parentMotivationOther.maxLength },
    );
    const violenceCategoryChoices = validateChoiceValues(
      errors,
      formRules.violenceCategories.label,
      body.violence_categories,
      allowedViolenceCategoryOptions,
    );
    const violenceCategoryOther = validateTextField(
      errors,
      formRules.violenceCategoryOther.label,
      body.violence_category_other,
      { maxLength: formRules.violenceCategoryOther.maxLength },
    );
    const exitMethodChoice = validateChoiceValue(
      errors,
      formRules.exitMethod.label,
      body.exit_method,
      allowedExitMethodOptions,
    );
    const exitMethodOther = validateTextField(
      errors,
      formRules.exitMethodOther.label,
      body.exit_method_other,
      { maxLength: formRules.exitMethodOther.maxLength },
    );
    const legalAidChoice = validateChoiceValue(
      errors,
      formRules.legalAidStatus.label,
      body.legal_aid_status,
      allowedLegalAidOptions,
    );
    const legalAidOther = validateTextField(
      errors,
      formRules.legalAidOther.label,
      body.legal_aid_other,
      { maxLength: formRules.legalAidOther.maxLength },
    );
    abuserInfo = validateTextField(
      errors,
      formRules.abuserInfo.label,
      body.abuser_info,
      { maxLength: formRules.abuserInfo.maxLength },
    );

    if (preInstitutionCityCode && !preInstitutionProvinceCode) {
      errors.push('Pre-institution province is required.');
    }

    if (preInstitutionProvinceCode) {
      validatedPreInstitutionProvince = validateProvinceCode(
        preInstitutionProvinceCode,
      );

      if (!validatedPreInstitutionProvince) {
        errors.push('Pre-institution province is invalid.');
      } else if (preInstitutionCityCode) {
        validatedPreInstitutionLocation = validateProvinceAndCity(
          preInstitutionProvinceCode,
          preInstitutionCityCode,
        );
        if (!validatedPreInstitutionLocation) {
          errors.push('Pre-institution province and city do not match.');
        }
      }
    }

    if (
      parentMotivationChoices.includes(CUSTOM_PARENT_MOTIVATION_OPTION)
      && !parentMotivationOther
    ) {
      errors.push('The custom parent motivation is required.');
    }

    parentMotivations = parentMotivationChoices
      .map((choiceValue) =>
        buildCustomChoiceValue(
          choiceValue,
          CUSTOM_PARENT_MOTIVATION_OPTION,
          parentMotivationOther,
        ),
      )
      .filter(Boolean);

    if (
      violenceCategoryChoices.includes(CUSTOM_VIOLENCE_CATEGORY_OPTION)
      && !violenceCategoryOther
    ) {
      errors.push('The custom violence category is required.');
    }

    violenceCategories = violenceCategoryChoices
      .map((choiceValue) =>
        buildCustomChoiceValue(
          choiceValue,
          CUSTOM_VIOLENCE_CATEGORY_OPTION,
          violenceCategoryOther,
        ),
      )
      .filter(Boolean);

    if (dateEnd && exitMethodChoice) {
      if (exitMethodChoice === CUSTOM_EXIT_METHOD_OPTION && !exitMethodOther) {
        errors.push('The custom exit method is required.');
      } else {
        exitMethod = buildCustomChoiceValue(
          exitMethodChoice,
          CUSTOM_EXIT_METHOD_OPTION,
          exitMethodOther,
        );
      }
    }

    if (legalAidChoice) {
      if (legalAidChoice === CUSTOM_LEGAL_AID_OPTION && !legalAidOther) {
        errors.push('The custom legal aid note is required.');
      } else {
        legalAidStatus = buildCustomChoiceValue(
          legalAidChoice,
          CUSTOM_LEGAL_AID_OPTION,
          legalAidOther,
        );
      }
    }
  }

  const experience = experienceInput;
  const schoolAwarenessBeforeEntry =
    identity === SELF_IDENTITY ? schoolAwarenessBeforeEntryInput : '';
  const scandal = scandalInput;
  const other = otherInput;

  validateFinalLength(
    errors,
    formRules.experience.label,
    experience,
    formRules.experience.maxLength,
  );
  validateFinalLength(
    errors,
    formRules.scandal.label,
    scandal,
    formRules.scandal.maxLength,
  );
  validateFinalLength(
    errors,
    formRules.other.label,
    other,
    formRules.other.maxLength,
  );

  if (errors.length > 0) {
    return {
      errors,
      ok: false,
    };
  }

  return {
    errors: [],
    ok: true,
    values: {
      abuserInfo,
      agentRelationship,
      birthDate,
      birthDay: birthDayValue,
      birthMonth: birthMonthValue,
      birthYear: birthYearValue,
      city: validatedLocation?.cityName ?? '',
      cityCode: validatedLocation?.cityCode ?? '',
      contactInformation,
      county: validatedCounty?.countyName ?? '',
      countyCode: validatedCounty?.countyCode ?? '',
      dateEnd,
      dateStart,
      exitMethod,
      experience,
      googleFormAge,
      headmasterName,
      identity,
      latitude,
      legalAidStatus,
      longitude,
      other,
      parentMotivations,
      preInstitutionCity: validatedPreInstitutionLocation?.cityName ?? '',
      preInstitutionCityCode: validatedPreInstitutionLocation?.cityCode ?? '',
      preInstitutionProvince:
        validatedPreInstitutionLocation?.legacyProvinceName
        ?? validatedPreInstitutionProvince?.legacyProvinceName
        ?? '',
      preInstitutionProvinceCode:
        validatedPreInstitutionLocation?.provinceCode
        ?? validatedPreInstitutionProvince?.provinceCode
        ?? '',
      province: validatedLocation?.legacyProvinceName ?? '',
      provinceCode: validatedLocation?.provinceCode ?? '',
      scandal,
      schoolAwarenessBeforeEntry,
      schoolAddress,
      schoolCoordinates,
      schoolName,
      sex: buildNormalizedSexValue(sex, sexOtherType, sexOther),
      standaloneEnhancements,
      submittedFields,
      violenceCategories,
    },
  };
}

export function validateNoTorsionCorrectionSubmission(
  body: Record<string, unknown>,
): ValidateResult<NoTorsionCorrectionValues> {
  const errors: string[] = [];
  const submittedFields = buildSubmittedFields(body);
  const schoolName = validateTextField(errors, 'School name', body.school_name, {
    maxLength: 80,
    required: true,
  });
  const schoolAddress = validateTextField(
    errors,
    'School address',
    body.school_address,
    { maxLength: 200 },
  );
  const contactInformation = validateTextField(
    errors,
    'Contact information',
    body.contact_information,
    { maxLength: 120 },
  );
  const headmasterName = validateTextField(
    errors,
    'Headmaster name',
    body.headmaster_name,
    { maxLength: 80 },
  );
  const correctionContent = validateTextField(
    errors,
    'Correction content',
    body.correction_content,
    { maxLength: 4000 },
  );
  const provinceCode = getTrimmedString(body.provinceCode);
  const cityCode = getTrimmedString(body.cityCode);
  const countyCode = getTrimmedString(body.countyCode);

  let validatedProvince: ReturnType<typeof validateProvinceCode> = null;
  let validatedLocation: ReturnType<typeof validateProvinceAndCity> = null;
  let validatedCounty: ReturnType<typeof validateCountyForCity> = null;

  if (provinceCode) {
    validatedProvince = validateProvinceCode(provinceCode);
    if (!validatedProvince) {
      errors.push('Province is invalid.');
    }
  }

  if (cityCode && !provinceCode) {
    errors.push('City cannot be provided without a province.');
  } else if (provinceCode && cityCode) {
    validatedLocation = validateProvinceAndCity(provinceCode, cityCode);
    if (!validatedLocation) {
      errors.push('Province and city do not match.');
    }
  }

  if (countyCode && !cityCode) {
    errors.push('County cannot be provided without a city.');
  } else if (cityCode && countyCode) {
    validatedCounty = validateCountyForCity(cityCode, countyCode);
    if (!validatedCounty) {
      errors.push('City and county do not match.');
    }
  }

  if (errors.length > 0) {
    return {
      errors,
      ok: false,
    };
  }

  return {
    errors: [],
    ok: true,
    values: {
      city: validatedLocation?.cityName ?? '',
      cityCode: validatedLocation?.cityCode ?? '',
      contactInformation,
      correctionContent,
      county: validatedCounty?.countyName ?? '',
      countyCode: validatedCounty?.countyCode ?? '',
      headmasterName,
      province: validatedLocation?.provinceName ?? validatedProvince?.provinceName ?? '',
      provinceCode:
        validatedLocation?.provinceCode
        ?? validatedProvince?.provinceCode
        ?? '',
      schoolAddress,
      schoolName,
      submittedFields,
    },
  };
}

export async function prepareNoTorsionFormSubmission(
  db: D1Database,
  env: Env,
  options: {
    body: Record<string, unknown>;
    requestContext?: NoTorsionRequestContext;
  },
): Promise<NoTorsionFormPrepareResult> {
  const protectionResult = await validateFormProtection(env, {
    honeypotValue: options.body.website,
    token: options.body.form_token,
  });

  if (!protectionResult.ok) {
    throw new Error(`FORM_PROTECTION:${protectionResult.reason}`);
  }

  const validationResult = validateNoTorsionFormSubmission(options.body);
  if (!validationResult.ok) {
    throw new Error(`FORM_VALIDATION:${validationResult.errors.join(' | ')}`);
  }

  const encodedPayload = encodeGoogleFormFields(
    buildGoogleFormFields(validationResult.values),
  );

  const mediaRecords = parseMediaRecords(options.body.media_records);

  if (getFormDryRun(env)) {
    return {
      encodedPayload,
      mediaRecords,
      mode: 'preview',
      values: validationResult.values,
    };
  }

  const confirmationPayload = encodeConfirmationPayload({
    encodedPayload,
    mediaRecords,
    requestContext: options.requestContext ?? {},
    submissionValues: validationResult.values,
  });
  const confirmationToken = await issueFormConfirmationToken(
    env,
    confirmationPayload,
  );

  return {
    confirmationPayload,
    confirmationToken,
    encodedPayload,
    mediaRecords,
    mode: 'confirm',
    values: validationResult.values,
  };
}

export async function confirmNoTorsionFormSubmission(
  db: D1Database,
  env: Env,
  options: {
    confirmationPayload: string;
    confirmationToken: string;
  },
): Promise<NoTorsionConfirmResult> {
  const validationResult = await validateFormConfirmation(env, {
    payload: options.confirmationPayload,
    token: options.confirmationToken,
  });

  if (!validationResult.ok) {
    throw new Error(`FORM_CONFIRMATION:${validationResult.reason}`);
  }

  const decodedPayload = decodeConfirmationPayload(options.confirmationPayload);
  const resultsByTarget = {} as Record<ActualSubmitTarget, SubmissionTargetResult>;
  const successfulTargets: ActualSubmitTarget[] = [];
  const submitTargets = getSubmitTargets(getFormSubmitTarget(env));
  const clientIpHash = await hashClientIp(decodedPayload.requestContext.clientIp);

  for (const target of submitTargets) {
    try {
      if (target === 'google') {
        await submitToGoogleForm(
          getFormGoogleSubmitUrl(env),
          decodedPayload.encodedPayload,
        );
        resultsByTarget[target] = {
          ok: true,
        };
      } else {
        const recordKey = `no-torsion:form:${crypto.randomUUID()}`;
        const payload = buildFormStoragePayload(
          decodedPayload.submissionValues,
          decodedPayload.requestContext,
          clientIpHash,
        );
        await writeRecord(db, 'nct_form', {
          dataSourceType: 'questionnaire',
          payload,
          recordKey,
        });
        await writeRecord(db, 'nct_databack', {
          dataSourceType: 'questionnaire',
          payload,
          recordKey,
        });
        resultsByTarget[target] = {
          ok: true,
          recordKey,
        };
      }

      successfulTargets.push(target);
    } catch (error) {
      resultsByTarget[target] = {
        error: error instanceof Error ? error.message : 'Unknown submit error.',
        ok: false,
      };
    }
  }

  return {
    encodedPayload: decodedPayload.encodedPayload,
    mediaRecords: decodedPayload.mediaRecords ?? [],
    resultsByTarget,
    successfulTargets,
  };
}

export async function submitNoTorsionCorrection(
  db: D1Database,
  env: Env,
  options: {
    body: Record<string, unknown>;
    requestContext?: NoTorsionRequestContext;
  },
): Promise<NoTorsionCorrectionSubmitResult> {
  const protectionResult = await validateFormProtection(env, {
    honeypotValue: options.body.website,
    token: options.body.form_token,
  });

  if (!protectionResult.ok) {
    throw new Error(`FORM_PROTECTION:${protectionResult.reason}`);
  }

  const validationResult = validateNoTorsionCorrectionSubmission(options.body);
  if (!validationResult.ok) {
    throw new Error(`CORRECTION_VALIDATION:${validationResult.errors.join(' | ')}`);
  }

  const encodedPayload = encodeGoogleFormFields(
    buildCorrectionGoogleFormFields(validationResult.values),
  );
  const requestContext = options.requestContext ?? {};
  const clientIpHash = await hashClientIp(requestContext.clientIp);
  const resultsByTarget = {} as Record<ActualSubmitTarget, SubmissionTargetResult>;
  const successfulTargets: ActualSubmitTarget[] = [];

  for (const target of getSubmitTargets(getCorrectionSubmitTarget(env))) {
    try {
      if (target === 'google') {
        await submitToGoogleForm(getCorrectionGoogleSubmitUrl(env), encodedPayload);
        resultsByTarget[target] = {
          ok: true,
        };
      } else {
        const recordKey = `no-torsion:correction:${crypto.randomUUID()}`;
        const payload = buildCorrectionStoragePayload(
          validationResult.values,
          requestContext,
          clientIpHash,
        );
        await writeRecord(db, 'nct_form', {
          dataSourceType: 'questionnaire',
          payload,
          recordKey,
        });
        await writeRecord(db, 'nct_databack', {
          dataSourceType: 'questionnaire',
          payload,
          recordKey,
        });
        resultsByTarget[target] = {
          ok: true,
          recordKey,
        };
      }

      successfulTargets.push(target);
    } catch (error) {
      resultsByTarget[target] = {
        error: error instanceof Error ? error.message : 'Unknown submit error.',
        ok: false,
      };
    }
  }

  return {
    encodedPayload,
    resultsByTarget,
    successfulTargets,
    values: validationResult.values,
  };
}

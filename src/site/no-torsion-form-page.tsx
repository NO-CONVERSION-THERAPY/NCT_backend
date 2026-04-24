import chinaAreaData from 'china-area-data';
import type { FC } from 'hono/jsx';
import {
  AGENT_IDENTITY,
  CUSTOM_AGENT_RELATIONSHIP_OPTION,
  CUSTOM_OTHER_SEX_OPTION,
  OTHER_SEX_OPTION,
  SELF_IDENTITY,
  type NoTorsionConfirmResult,
  type NoTorsionFormValues,
} from '../lib/no-torsion-form';

type AreaOption = {
  code: string;
  name: string;
};

type SupportedLanguage = 'en' | 'zh-CN' | 'zh-TW';

type PageTexts = {
  actionBack: string;
  actionConfirm: string;
  actionOpenForm: string;
  actionSubmit: string;
  actionSubmitting: string;
  fieldAddress: string;
  fieldBirthYear: string;
  fieldCity: string;
  fieldContact: string;
  fieldCounty: string;
  fieldDateEnd: string;
  fieldDateStart: string;
  fieldExperience: string;
  fieldHeadmaster: string;
  fieldIdentity: string;
  fieldOther: string;
  fieldRelationship: string;
  fieldScandal: string;
  fieldSchoolName: string;
  fieldSex: string;
  fieldSexCustom: string;
  fieldSexCustomText: string;
  helperAgentRelationship: string;
  helperFormIntro: string;
  helperPageIntro: string;
  helperPrivacy: string;
  labelIdentityAgent: string;
  labelIdentitySelf: string;
  labelOther: string;
  labelResultFailed: string;
  labelResultSucceeded: string;
  pageDescription: string;
  pageErrorTitle: string;
  pageFormTitle: string;
  pagePreviewTitle: string;
  pageResultTitle: string;
  pageSuccessTitle: string;
  placeholderAddress: string;
  placeholderBirthYear: string;
  placeholderCity: string;
  placeholderContact: string;
  placeholderCounty: string;
  placeholderExperience: string;
  placeholderHeadmaster: string;
  placeholderProvince: string;
  placeholderRelationship: string;
  placeholderRelationshipOther: string;
  placeholderSchoolName: string;
  placeholderSex: string;
  placeholderSexCustom: string;
  placeholderSexCustomText: string;
  placeholderTextBlock: string;
  previewEmpty: string;
  previewLead: string;
  previewTitle: string;
  statusFailedTargets: string;
  statusSucceededTargets: string;
  statusUnknownError: string;
};

type FormPageState = {
  lang: SupportedLanguage;
  token: string;
};

type PreviewPageState = {
  backHref: string;
  confirmationPayload?: string;
  confirmationToken?: string;
  formAction: string;
  lang: SupportedLanguage;
  mode: 'confirm' | 'preview';
  values: NoTorsionFormValues;
};

type ResultPageState = {
  backHref: string;
  lang: SupportedLanguage;
  result: NoTorsionConfirmResult;
  statusCode: number;
};

const PAGE_CSS = `
:root {
  color-scheme: light;
  --bg: #f2f1eb;
  --surface: rgba(255, 255, 255, 0.88);
  --surface-strong: rgba(255, 255, 255, 0.96);
  --border: rgba(19, 32, 51, 0.1);
  --text: #162033;
  --muted: #5a6a7f;
  --accent: #0d6b6f;
  --accent-soft: #dff6f1;
  --danger: #9f2d2d;
  --danger-soft: #fce9e9;
  --success: #136a4c;
  --success-soft: #e1f6ea;
  --shadow: 0 24px 60px rgba(15, 28, 45, 0.08);
  --radius-lg: 28px;
  --radius-md: 20px;
  --radius-sm: 14px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 32%),
    radial-gradient(circle at top right, rgba(13, 107, 111, 0.14), transparent 28%),
    linear-gradient(180deg, #f6f5f0 0%, #ece7da 100%);
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.page-shell {
  width: min(1040px, calc(100% - 28px));
  margin: 0 auto;
  padding: 28px 0 56px;
}

.hero,
.panel,
.status-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

.hero {
  padding: 30px;
  margin-bottom: 20px;
}

.hero__eyebrow {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hero h1 {
  margin: 16px 0 10px;
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 1.05;
}

.hero p {
  margin: 0;
  max-width: 62ch;
  color: var(--muted);
  line-height: 1.7;
}

.panel {
  padding: 28px;
}

.form-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field,
.field--full {
  display: grid;
  gap: 8px;
}

.field--full {
  grid-column: 1 / -1;
}

.field label,
.field__label {
  font-weight: 700;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(22, 32, 51, 0.14);
  border-radius: var(--radius-sm);
  background: var(--surface-strong);
  color: var(--text);
}

.field textarea {
  min-height: 128px;
  resize: vertical;
}

.field-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.6;
}

.inline-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.choice-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(13, 107, 111, 0.08);
  border: 1px solid rgba(13, 107, 111, 0.14);
}

.choice-pill input[type="text"] {
  min-width: 140px;
  border: 0;
  padding: 0;
  background: transparent;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 20px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 700;
}

.button--primary {
  background: var(--accent);
  color: white;
}

.button--secondary {
  background: rgba(22, 32, 51, 0.06);
  border-color: rgba(22, 32, 51, 0.08);
}

.honeypot {
  position: absolute;
  left: -99999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.summary-list {
  display: grid;
  gap: 14px;
}

.summary-item {
  padding: 16px 18px;
  border-radius: var(--radius-md);
  background: rgba(22, 32, 51, 0.04);
}

.summary-item strong {
  display: block;
  margin-bottom: 6px;
}

.status-grid {
  display: grid;
  gap: 14px;
}

.status-card {
  padding: 18px 20px;
}

.status-card--success {
  background: var(--success-soft);
}

.status-card--failure {
  background: var(--danger-soft);
}

.status-card h3 {
  margin: 0 0 8px;
  font-size: 1rem;
}

.status-card p {
  margin: 0;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .page-shell {
    width: min(100%, calc(100% - 20px));
    padding-top: 18px;
  }

  .hero,
  .panel {
    padding: 20px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
`;

const RELATIONSHIP_OPTIONS = [
  { labelKey: 'labelIdentitySelf', value: SELF_IDENTITY },
  { labelKey: 'labelIdentityAgent', value: AGENT_IDENTITY },
] as const;

const AGENT_RELATIONSHIP_OPTIONS = [
  { label: '朋友', value: '朋友' },
  { label: '伴侣', value: '伴侣' },
  { label: '亲属', value: '亲属' },
  { label: '救助工作者', value: '救助工作者' },
  { labelKey: 'labelOther', value: CUSTOM_AGENT_RELATIONSHIP_OPTION },
] as const;

const SEX_OPTIONS = [
  { label: '女性', value: '女性' },
  { label: '男性', value: '男性' },
  { labelKey: 'labelOther', value: OTHER_SEX_OPTION },
] as const;

const SEX_CUSTOM_OPTIONS = [
  { label: 'MtF', value: 'MtF' },
  { label: 'FtM', value: 'FtM' },
  { label: 'X', value: 'X' },
  { label: 'Queer', value: 'Queer' },
  { labelKey: 'labelOther', value: CUSTOM_OTHER_SEX_OPTION },
] as const;

const TEXTS: Record<SupportedLanguage, PageTexts> = {
  'zh-CN': {
    actionBack: '返回',
    actionConfirm: '确认提交',
    actionOpenForm: '打开填写页',
    actionSubmit: '继续确认',
    actionSubmitting: '提交中...',
    fieldAddress: '机构地址',
    fieldBirthYear: '出生年份',
    fieldCity: '机构所在城市',
    fieldContact: '联系方式',
    fieldCounty: '机构所在县区',
    fieldDateEnd: '离开日期',
    fieldDateStart: '首次被送入日期',
    fieldExperience: '个人经历',
    fieldHeadmaster: '负责人 / 校长姓名',
    fieldIdentity: '填写身份',
    fieldOther: '其它补充',
    fieldRelationship: '与受害者关系',
    fieldScandal: '丑闻与暴力行为',
    fieldSchoolName: '机构名称',
    fieldSex: '性别',
    fieldSexCustom: '其它性别认同',
    fieldSexCustomText: '自定义性别说明',
    helperAgentRelationship: '仅当你是代理人时填写。',
    helperFormIntro: '这份独立填写页已经完全由 `nct-api-sql-sub` 承载，不再依赖 No-Torsion 旧后端。',
    helperPageIntro: '请尽量填写关键信息。系统会先生成确认页，再执行最终投递。',
    helperPrivacy: '请避免在公开描述里填写身份证号、家庭住址或其它不适合公开的敏感信息。',
    labelIdentityAgent: '受害者的代理人',
    labelIdentitySelf: '受害者本人',
    labelOther: '其它',
    labelResultFailed: '投递失败',
    labelResultSucceeded: '投递成功',
    pageDescription: 'No-Torsion 独立填写页',
    pageErrorTitle: '提交失败',
    pageFormTitle: '独立填写页',
    pagePreviewTitle: '确认提交信息',
    pageResultTitle: '提交结果',
    pageSuccessTitle: '提交完成',
    placeholderAddress: '若已知，请填写详细地址',
    placeholderBirthYear: '请选择年份',
    placeholderCity: '请先选择省份',
    placeholderContact: '邮箱、电话或其它可回联方式',
    placeholderCounty: '可选：请先选择城市',
    placeholderExperience: '请描述个人经历、管理方式与造成的伤害。',
    placeholderHeadmaster: '姓名',
    placeholderProvince: '请选择省份',
    placeholderRelationship: '请选择关系',
    placeholderRelationshipOther: '其它关系说明',
    placeholderSchoolName: '请填写机构完整名称',
    placeholderSex: '请选择',
    placeholderSexCustom: '请选择或填写',
    placeholderSexCustomText: '自定义性别说明',
    placeholderTextBlock: '可选补充内容',
    previewEmpty: '未填写',
    previewLead: '以下信息将用于最终提交，请再次确认。',
    previewTitle: '提交前确认',
    statusFailedTargets: '失败目标',
    statusSucceededTargets: '成功目标',
    statusUnknownError: '未知错误',
  },
  'zh-TW': {
    actionBack: '返回',
    actionConfirm: '確認送出',
    actionOpenForm: '開啟填寫頁',
    actionSubmit: '繼續確認',
    actionSubmitting: '送出中...',
    fieldAddress: '機構地址',
    fieldBirthYear: '出生年份',
    fieldCity: '機構所在城市',
    fieldContact: '聯絡方式',
    fieldCounty: '機構所在縣區',
    fieldDateEnd: '離開日期',
    fieldDateStart: '首次被送入日期',
    fieldExperience: '個人經歷',
    fieldHeadmaster: '負責人 / 校長姓名',
    fieldIdentity: '填寫身份',
    fieldOther: '其它補充',
    fieldRelationship: '與受害者關係',
    fieldScandal: '醜聞與暴力行為',
    fieldSchoolName: '機構名稱',
    fieldSex: '性別',
    fieldSexCustom: '其它性別認同',
    fieldSexCustomText: '自定義性別說明',
    helperAgentRelationship: '僅當你是代理人時填寫。',
    helperFormIntro: '這份獨立填寫頁已完全由 `nct-api-sql-sub` 承載，不再依賴 No-Torsion 舊後端。',
    helperPageIntro: '請盡量填寫關鍵資訊。系統會先生成確認頁，再執行最終投遞。',
    helperPrivacy: '請避免在公開描述裡填寫身分證號、家庭住址或其它不適合公開的敏感資訊。',
    labelIdentityAgent: '受害者的代理人',
    labelIdentitySelf: '受害者本人',
    labelOther: '其它',
    labelResultFailed: '投遞失敗',
    labelResultSucceeded: '投遞成功',
    pageDescription: 'No-Torsion 獨立填寫頁',
    pageErrorTitle: '送出失敗',
    pageFormTitle: '獨立填寫頁',
    pagePreviewTitle: '確認提交資訊',
    pageResultTitle: '提交結果',
    pageSuccessTitle: '提交完成',
    placeholderAddress: '若已知，請填寫詳細地址',
    placeholderBirthYear: '請選擇年份',
    placeholderCity: '請先選擇省份',
    placeholderContact: 'Email、電話或其它可回聯方式',
    placeholderCounty: '可選：請先選擇城市',
    placeholderExperience: '請描述個人經歷、管理方式與造成的傷害。',
    placeholderHeadmaster: '姓名',
    placeholderProvince: '請選擇省份',
    placeholderRelationship: '請選擇關係',
    placeholderRelationshipOther: '其它關係說明',
    placeholderSchoolName: '請填寫機構完整名稱',
    placeholderSex: '請選擇',
    placeholderSexCustom: '請選擇或填寫',
    placeholderSexCustomText: '自定義性別說明',
    placeholderTextBlock: '可選補充內容',
    previewEmpty: '未填寫',
    previewLead: '以下資訊將用於最終提交，請再次確認。',
    previewTitle: '提交前確認',
    statusFailedTargets: '失敗目標',
    statusSucceededTargets: '成功目標',
    statusUnknownError: '未知錯誤',
  },
  en: {
    actionBack: 'Back',
    actionConfirm: 'Confirm submission',
    actionOpenForm: 'Open form',
    actionSubmit: 'Continue',
    actionSubmitting: 'Submitting...',
    fieldAddress: 'Institution address',
    fieldBirthYear: 'Birth year',
    fieldCity: 'City',
    fieldContact: 'Contact information',
    fieldCounty: 'County / district',
    fieldDateEnd: 'End date',
    fieldDateStart: 'First admission date',
    fieldExperience: 'Experience',
    fieldHeadmaster: 'Headmaster / lead staff',
    fieldIdentity: 'Identity',
    fieldOther: 'Other notes',
    fieldRelationship: 'Relationship to the survivor',
    fieldScandal: 'Scandal and violence',
    fieldSchoolName: 'Institution name',
    fieldSex: 'Sex / gender',
    fieldSexCustom: 'Other gender identity',
    fieldSexCustomText: 'Custom gender note',
    helperAgentRelationship: 'Only fill this in when you are submitting as a representative.',
    helperFormIntro: 'This standalone submission page is now fully hosted by `nct-api-sql-sub`, without relying on the No-Torsion legacy backend.',
    helperPageIntro: 'Please provide the essential information. The service will render a confirmation page before the final delivery step.',
    helperPrivacy: 'Avoid putting ID numbers, home addresses, or other highly sensitive information in the public narrative fields.',
    labelIdentityAgent: 'Representative of the survivor',
    labelIdentitySelf: 'Survivor',
    labelOther: 'Other',
    labelResultFailed: 'Failed',
    labelResultSucceeded: 'Delivered',
    pageDescription: 'No-Torsion standalone submission page',
    pageErrorTitle: 'Submission failed',
    pageFormTitle: 'Standalone submission',
    pagePreviewTitle: 'Review the submission',
    pageResultTitle: 'Submission result',
    pageSuccessTitle: 'Submission complete',
    placeholderAddress: 'Detailed address if known',
    placeholderBirthYear: 'Select a year',
    placeholderCity: 'Select a province first',
    placeholderContact: 'Email, phone number, or another reachable contact',
    placeholderCounty: 'Optional: select a city first',
    placeholderExperience: 'Describe the experience, management methods, and harm.',
    placeholderHeadmaster: 'Name',
    placeholderProvince: 'Select a province',
    placeholderRelationship: 'Select the relationship',
    placeholderRelationshipOther: 'Describe the relationship',
    placeholderSchoolName: 'Enter the full institution name',
    placeholderSex: 'Select',
    placeholderSexCustom: 'Select or enter',
    placeholderSexCustomText: 'Custom gender note',
    placeholderTextBlock: 'Optional notes',
    previewEmpty: 'Not provided',
    previewLead: 'These values will be used for the final submission. Please review them carefully.',
    previewTitle: 'Review before submission',
    statusFailedTargets: 'Failed targets',
    statusSucceededTargets: 'Successful targets',
    statusUnknownError: 'Unknown error',
  },
};

function toOption([code, name]: [string, string]): AreaOption {
  return { code, name };
}

function shouldFlattenToDistricts(entries: Array<[string, string]>): boolean {
  return entries.length > 0 && entries.every(([, name]) => name === '市辖区' || name === '县');
}

function buildAreaPayload() {
  const provinces = Object.entries(chinaAreaData['86'] ?? {}).map(toOption);
  const citiesByProvinceCode = Object.fromEntries(
    provinces.map((province) => {
      const cityEntries = Object.entries(chinaAreaData[province.code] ?? {});
      const options = shouldFlattenToDistricts(cityEntries)
        ? cityEntries.flatMap(([cityCode]) => Object.entries(chinaAreaData[cityCode] ?? {}).map(toOption))
        : cityEntries.map(toOption);

      return [province.code, options];
    }),
  );

  const countiesByCityCode = Object.fromEntries(
    Object.values(citiesByProvinceCode)
      .flat()
      .map((city) => [
        city.code,
        Object.entries(chinaAreaData[city.code] ?? {})
          .filter(([, name]) => name !== '市辖区' && name !== '县')
          .map(toOption),
      ]),
  );

  return {
    citiesByProvinceCode,
    countiesByCityCode,
    provinces,
  };
}

const AREA_PAYLOAD = buildAreaPayload();

function resolveLanguage(value?: string): SupportedLanguage {
  return value === 'en' || value === 'zh-TW' || value === 'zh-CN'
    ? value
    : 'zh-CN';
}

function getTexts(language: SupportedLanguage): PageTexts {
  return TEXTS[resolveLanguage(language)];
}

function buildBirthYearOptions(): number[] {
  const currentYear = new Date().getUTCFullYear();
  return Array.from({ length: currentYear - 1899 }, (_value, index) => currentYear - index);
}

const BIRTH_YEAR_OPTIONS = buildBirthYearOptions();

function buildFormHref(language: SupportedLanguage): string {
  return `/form?lang=${encodeURIComponent(language)}`;
}

function buildConfirmHref(language: SupportedLanguage): string {
  return `/form/confirm?lang=${encodeURIComponent(language)}`;
}

function formatSummaryValue(value: unknown, fallback: string): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.filter(Boolean).join('；') : fallback;
  }

  const text = String(value ?? '').trim();
  return text || fallback;
}

function buildSummaryItems(values: NoTorsionFormValues, texts: PageTexts) {
  return [
    [texts.fieldIdentity, values.identity],
    [texts.fieldRelationship, values.agentRelationship],
    [texts.fieldBirthYear, values.birthYear],
    [texts.fieldSex, values.sex],
    [texts.fieldSchoolName, values.schoolName],
    [texts.fieldAddress, values.schoolAddress],
    [texts.fieldDateStart, values.dateStart],
    [texts.fieldDateEnd, values.dateEnd],
    [texts.fieldContact, values.contactInformation],
    [texts.fieldHeadmaster, values.headmasterName],
    [texts.fieldExperience, values.experience],
    [texts.fieldScandal, values.scandal],
    [texts.fieldOther, values.other],
  ] as const;
}

function buildAreaScript() {
  return `
const areaPayload = JSON.parse(document.getElementById('area-payload').textContent || '{}');

function updateSelectOptions(select, options, placeholder, selectedValue) {
  if (!select) return;

  const normalizedOptions = Array.isArray(options) ? options : [];
  select.innerHTML = '';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  normalizedOptions.forEach((option) => {
    const nextOption = document.createElement('option');
    nextOption.value = option.code;
    nextOption.textContent = option.name;
    if (selectedValue && selectedValue === option.code) {
      nextOption.selected = true;
    }
    select.appendChild(nextOption);
  });
}

function syncAreaSelectors(rootId, labels) {
  const province = document.getElementById(rootId + '-province');
  const city = document.getElementById(rootId + '-city');
  const county = document.getElementById(rootId + '-county');

  if (!province || !city || !county) return;

  function renderCities() {
    const cityOptions = areaPayload.citiesByProvinceCode?.[province.value] || [];
    updateSelectOptions(city, cityOptions, labels.city, city.dataset.selectedValue || '');
    city.dataset.selectedValue = '';
    renderCounties();
  }

  function renderCounties() {
    const countyOptions = areaPayload.countiesByCityCode?.[city.value] || [];
    updateSelectOptions(county, countyOptions, labels.county, county.dataset.selectedValue || '');
    county.dataset.selectedValue = '';
  }

  province.addEventListener('change', () => {
    city.dataset.selectedValue = '';
    county.dataset.selectedValue = '';
    renderCities();
  });

  city.addEventListener('change', () => {
    county.dataset.selectedValue = '';
    renderCounties();
  });

  renderCities();
}

function syncConditionalVisibility() {
  const identitySelect = document.getElementById('identity');
  const relationshipField = document.getElementById('relationship-field');
  const relationshipSelect = document.getElementById('agent-relationship');
  const relationshipOtherField = document.getElementById('relationship-other-field');
  const sexSelect = document.getElementById('sex');
  const sexOtherField = document.getElementById('sex-other-field');
  const sexOtherType = document.getElementById('sex-other-type');
  const sexOtherTextField = document.getElementById('sex-other-text-field');

  function render() {
    const isAgent = identitySelect && identitySelect.value === ${JSON.stringify(AGENT_IDENTITY)};
    const usesOtherRelationship = relationshipSelect && relationshipSelect.value === ${JSON.stringify(CUSTOM_AGENT_RELATIONSHIP_OPTION)};
    const usesOtherSex = sexSelect && sexSelect.value === ${JSON.stringify(OTHER_SEX_OPTION)};
    const usesCustomSex = sexOtherType && sexOtherType.value === ${JSON.stringify(CUSTOM_OTHER_SEX_OPTION)};

    if (relationshipField) relationshipField.hidden = !isAgent;
    if (relationshipOtherField) relationshipOtherField.hidden = !(isAgent && usesOtherRelationship);
    if (sexOtherField) sexOtherField.hidden = !usesOtherSex;
    if (sexOtherTextField) sexOtherTextField.hidden = !(usesOtherSex && usesCustomSex);
  }

  if (identitySelect) identitySelect.addEventListener('change', render);
  if (relationshipSelect) relationshipSelect.addEventListener('change', render);
  if (sexSelect) sexSelect.addEventListener('change', render);
  if (sexOtherType) sexOtherType.addEventListener('change', render);
  render();
}

syncAreaSelectors('report-area', {
  city: document.body.dataset.cityPlaceholder || '',
  county: document.body.dataset.countyPlaceholder || '',
});
syncConditionalVisibility();
`;
}

const AREA_SCRIPT = buildAreaScript();

const HtmlDocument: FC<{
  children: unknown;
  cityPlaceholder: string;
  countyPlaceholder: string;
  description: string;
  title: string;
}> = ({ children, cityPlaceholder, countyPlaceholder, description, title }) => {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content={description} name="description" />
        <meta content="noindex, nofollow" name="robots" />
        <title>{title}</title>
        <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      </head>
      <body data-city-placeholder={cityPlaceholder} data-county-placeholder={countyPlaceholder}>
        {children}
      </body>
    </html>
  );
};

export const NoTorsionStandaloneFormPage: FC<FormPageState> = ({ lang, token }) => {
  const texts = getTexts(lang);

  return (
    <HtmlDocument
      cityPlaceholder={texts.placeholderCity}
      countyPlaceholder={texts.placeholderCounty}
      description={texts.pageDescription}
      title={`${texts.pageFormTitle} | NCT API SQL Sub`}
    >
      <main className="page-shell">
        <section className="hero">
          <span className="hero__eyebrow">Hono + JSX</span>
          <h1>{texts.pageFormTitle}</h1>
          <p>{texts.helperFormIntro}</p>
          <p>{texts.helperPageIntro}</p>
        </section>

        <section className="panel">
          <form action={buildFormHref(lang)} method="post">
            <div className="honeypot" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input autoComplete="off" id="website" name="website" spellCheck="false" tabIndex={-1} type="text" />
            </div>

            <input name="form_token" type="hidden" value={token} />
            <input name="lang" type="hidden" value={lang} />

            <div className="form-grid">
              <div className="field">
                <span className="field__label">{texts.fieldIdentity}</span>
                <select defaultValue={SELF_IDENTITY} id="identity" name="identity" required>
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value === SELF_IDENTITY ? texts.labelIdentitySelf : texts.labelIdentityAgent}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" hidden id="relationship-field">
                <span className="field__label">{texts.fieldRelationship}</span>
                <select defaultValue="" id="agent-relationship" name="agent_relationship">
                  <option value="">{texts.placeholderRelationship}</option>
                  {AGENT_RELATIONSHIP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {'label' in option ? option.label : texts.labelOther}
                    </option>
                  ))}
                </select>
                <p className="field-note">{texts.helperAgentRelationship}</p>
              </div>

              <div className="field" hidden id="relationship-other-field">
                <span className="field__label">{texts.labelOther}</span>
                <input maxLength={30} name="agent_relationship_other" placeholder={texts.placeholderRelationshipOther} type="text" />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldBirthYear}</span>
                <select defaultValue="" name="birth_year" required>
                  <option value="">{texts.placeholderBirthYear}</option>
                  {BIRTH_YEAR_OPTIONS.map((year) => (
                    <option key={year} value={String(year)}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldSex}</span>
                <select defaultValue="" id="sex" name="sex" required>
                  <option value="">{texts.placeholderSex}</option>
                  {SEX_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {'label' in option ? option.label : texts.labelOther}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field--full" hidden id="sex-other-field">
                <span className="field__label">{texts.fieldSexCustom}</span>
                <div className="inline-grid">
                  <select defaultValue="" id="sex-other-type" name="sex_other_type">
                    <option value="">{texts.placeholderSexCustom}</option>
                    {SEX_CUSTOM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {'label' in option ? option.label : texts.labelOther}
                      </option>
                    ))}
                  </select>
                  <div hidden id="sex-other-text-field">
                    <input maxLength={30} name="sex_other" placeholder={texts.placeholderSexCustomText} type="text" />
                  </div>
                </div>
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldSchoolName}</span>
                <input maxLength={20} name="school_name" placeholder={texts.placeholderSchoolName} required type="text" />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldCity.replace('城市', '省份')}</span>
                <select defaultValue="" id="report-area-province" name="provinceCode" required>
                  <option value="">{texts.placeholderProvince}</option>
                  {AREA_PAYLOAD.provinces.map((province) => (
                    <option key={province.code} value={province.code}>{province.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldCity}</span>
                <select data-selected-value="" defaultValue="" id="report-area-city" name="cityCode" required />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldCounty}</span>
                <select data-selected-value="" defaultValue="" id="report-area-county" name="countyCode" />
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldAddress}</span>
                <input maxLength={50} name="school_address" placeholder={texts.placeholderAddress} type="text" />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldDateStart}</span>
                <input name="date_start" required type="date" />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldDateEnd}</span>
                <input name="date_end" type="date" />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldHeadmaster}</span>
                <input maxLength={10} name="headmaster_name" placeholder={texts.placeholderHeadmaster} type="text" />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldContact}</span>
                <input maxLength={30} name="contact_information" placeholder={texts.placeholderContact} required type="text" />
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldExperience}</span>
                <textarea name="experience" placeholder={texts.placeholderExperience} />
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldScandal}</span>
                <textarea name="scandal" placeholder={texts.placeholderTextBlock} />
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldOther}</span>
                <textarea name="other" placeholder={texts.placeholderTextBlock} />
              </div>
            </div>

            <p className="field-note">{texts.helperPrivacy}</p>

            <div className="actions">
              <button className="button button--primary" type="submit">{texts.actionSubmit}</button>
            </div>
          </form>
        </section>
      </main>

      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(AREA_PAYLOAD),
        }}
        id="area-payload"
        type="application/json"
      />
      <script dangerouslySetInnerHTML={{ __html: AREA_SCRIPT }} />
    </HtmlDocument>
  );
};

export const NoTorsionStandalonePreviewPage: FC<PreviewPageState> = ({
  backHref,
  confirmationPayload,
  confirmationToken,
  formAction,
  lang,
  mode,
  values,
}) => {
  const texts = getTexts(lang);

  return (
    <HtmlDocument
      cityPlaceholder={texts.placeholderCity}
      countyPlaceholder={texts.placeholderCounty}
      description={texts.pageDescription}
      title={`${texts.pagePreviewTitle} | NCT API SQL Sub`}
    >
      <main className="page-shell">
        <section className="hero">
          <span className="hero__eyebrow">{mode === 'confirm' ? texts.actionConfirm : texts.actionSubmit}</span>
          <h1>{texts.previewTitle}</h1>
          <p>{texts.previewLead}</p>
        </section>

        <section className="panel">
          <div className="summary-list">
            {buildSummaryItems(values, texts).map(([label, value]) => (
              <div className="summary-item" key={label}>
                <strong>{label}</strong>
                <span>{formatSummaryValue(value, texts.previewEmpty)}</span>
              </div>
            ))}
          </div>

          <div className="actions">
            <a className="button button--secondary" href={backHref}>{texts.actionBack}</a>
            {mode === 'confirm' && confirmationPayload && confirmationToken ? (
              <form action={formAction} method="post">
                <input name="confirmation_payload" type="hidden" value={confirmationPayload} />
                <input name="confirmation_token" type="hidden" value={confirmationToken} />
                <input name="lang" type="hidden" value={lang} />
                <button className="button button--primary" type="submit">{texts.actionConfirm}</button>
              </form>
            ) : (
              <a className="button button--primary" href={backHref}>{texts.actionBack}</a>
            )}
          </div>
        </section>
      </main>
    </HtmlDocument>
  );
};

export const NoTorsionStandaloneResultPage: FC<ResultPageState> = ({
  backHref,
  lang,
  result,
  statusCode,
}) => {
  const texts = getTexts(lang);
  const entries = Object.entries(result.resultsByTarget || {});

  return (
    <HtmlDocument
      cityPlaceholder={texts.placeholderCity}
      countyPlaceholder={texts.placeholderCounty}
      description={texts.pageDescription}
      title={`${statusCode >= 400 ? texts.pageErrorTitle : texts.pageSuccessTitle} | NCT API SQL Sub`}
    >
      <main className="page-shell">
        <section className="hero">
          <span className="hero__eyebrow">{statusCode >= 400 ? texts.pageErrorTitle : texts.pageSuccessTitle}</span>
          <h1>{statusCode >= 400 ? texts.pageErrorTitle : texts.pageSuccessTitle}</h1>
          <p>{texts.pageResultTitle}</p>
        </section>

        <section className="panel">
          <div className="status-grid">
            {entries.map(([target, targetResult]) => {
              const isSuccess = Boolean(targetResult && targetResult.ok);

              return (
                <article
                  className={`status-card ${isSuccess ? 'status-card--success' : 'status-card--failure'}`}
                  key={target}
                >
                  <h3>{target}</h3>
                  <p>
                    <strong>{isSuccess ? texts.labelResultSucceeded : texts.labelResultFailed}</strong>
                  </p>
                  {!isSuccess ? (
                    <p>{targetResult && targetResult.error ? targetResult.error : texts.statusUnknownError}</p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="actions">
            <a className="button button--secondary" href={backHref}>{texts.actionBack}</a>
          </div>
        </section>
      </main>
    </HtmlDocument>
  );
};

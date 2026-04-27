import chinaAreaData from 'china-area-data';
import type { FC } from 'hono/jsx';
import {
  AGENT_IDENTITY,
  CUSTOM_AGENT_RELATIONSHIP_OPTION,
  CUSTOM_EXIT_METHOD_OPTION,
  CUSTOM_LEGAL_AID_OPTION,
  CUSTOM_OTHER_SEX_OPTION,
  CUSTOM_PARENT_MOTIVATION_OPTION,
  CUSTOM_VIOLENCE_CATEGORY_OPTION,
  OTHER_SEX_OPTION,
  SELF_IDENTITY,
  type NoTorsionConfirmResult,
  type NoTorsionFormValues,
} from '../lib/no-torsion-form';
import { MEDIA_PICKER_CSS, MEDIA_PICKER_SCRIPT } from './media-picker-assets';

type AreaOption = {
  code: string;
  name: string;
};

type SupportedLanguage = 'en' | 'zh-CN' | 'zh-TW';

type PageTexts = {
  actionBack: string;
  actionConfirm: string;
  actionOpenForm: string;
  actionOpenMapPicker: string;
  actionUploadMedia: string;
  actionSubmit: string;
  actionSubmitting: string;
  actionUseCurrentLocation: string;
  fieldAbuserInfo: string;
  fieldAddress: string;
  fieldBasicSection: string;
  fieldBirthYear: string;
  fieldCity: string;
  fieldContact: string;
  fieldCoordinates: string;
  fieldCounty: string;
  fieldDateEnd: string;
  fieldDateStart: string;
  fieldExitMethod: string;
  fieldExperienceSection: string;
  fieldExposureSection: string;
  fieldExperience: string;
  fieldHeadmaster: string;
  fieldIdentity: string;
  fieldLegalAidStatus: string;
  fieldMediaFile: string;
  fieldMediaR18: string;
  fieldMediaSection: string;
  fieldMediaTags: string;
  fieldOther: string;
  fieldParentMotivations: string;
  fieldPreInstitutionCity: string;
  fieldPreInstitutionProvince: string;
  fieldProvince: string;
  fieldRelationship: string;
  fieldScandal: string;
  fieldSchoolAwarenessBeforeEntry: string;
  fieldSchoolName: string;
  fieldSex: string;
  fieldSexCustom: string;
  fieldSexCustomText: string;
  fieldVictimBirthYear: string;
  fieldVictimExperienceSection: string;
  fieldVictimSex: string;
  fieldViolenceCategories: string;
  helperFormIntro: string;
  helperMediaUpload: string;
  helperCoordinates: string;
  hintDateEnd: string;
  hintDateStart: string;
  hintExperience: string;
  labelHotlineNotice: string;
  labelIdentityAgent: string;
  labelIdentitySelf: string;
  labelLanguage: string;
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
  placeholderAbuserInfo: string;
  placeholderBirthYear: string;
  placeholderCity: string;
  placeholderContact: string;
  placeholderCoordinates: string;
  placeholderCounty: string;
  placeholderExperience: string;
  placeholderExitMethod: string;
  placeholderExitMethodOther: string;
  placeholderHeadmaster: string;
  placeholderLegalAidOther: string;
  placeholderLegalAidStatus: string;
  placeholderParentMotivationOther: string;
  placeholderPreInstitutionCity: string;
  placeholderPreInstitutionProvince: string;
  placeholderProvince: string;
  placeholderRelationship: string;
  placeholderRelationshipOther: string;
  placeholderScandal: string;
  placeholderSchoolAwarenessBeforeEntry: string;
  placeholderSchoolName: string;
  placeholderSex: string;
  placeholderSexCustom: string;
  placeholderSexCustomText: string;
  placeholderTextBlock: string;
  placeholderViolenceCategoryOther: string;
  previewEmpty: string;
  previewLead: string;
  previewTitle: string;
  statusFailedTargets: string;
  statusLocationFailed: string;
  statusLocationSelected: string;
  statusLocationUnavailable: string;
  statusMapLoading: string;
  statusMapPrompt: string;
  statusSucceededTargets: string;
  statusUnknownError: string;
  validationDateFormat: string;
  validationExitMethodOther: string;
  validationLegalAidOther: string;
  validationParentMotivationOther: string;
  validationParentMotivations: string;
  validationViolenceCategoryOther: string;
};

type LanguageOption = {
  code: SupportedLanguage;
  label: string;
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

[hidden] {
  display: none !important;
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

.standalone-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 16px;
}

.standalone-language-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border: 1px solid rgba(22, 32, 51, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 14px 36px rgba(15, 28, 45, 0.06);
  backdrop-filter: blur(18px);
}

.standalone-language-picker__label {
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
}

.standalone-language-picker__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.6rem;
  min-width: 4.4rem;
  padding: 0.62rem 0.95rem;
  border-radius: 999px;
  color: var(--muted);
  font-weight: 700;
}

.standalone-language-picker__option:hover {
  color: var(--text);
  background: rgba(13, 107, 111, 0.08);
}

.standalone-language-picker__option.is-active {
  color: var(--accent);
  background: var(--accent-soft);
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
  display: grid;
  gap: 14px;
  justify-items: start;
  padding: 28px;
  margin-bottom: 20px;
}

.hero--form {
  justify-items: center;
  padding: 26px 32px 28px;
  text-align: center;
}

.hero__eyebrow {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.hero h1 {
  margin: 0;
  font-size: 2.25rem;
  line-height: 1.12;
}

.hero--form h1 {
  max-width: 100%;
  overflow-wrap: anywhere;
  font-size: clamp(2rem, 4.6vw, 3.9rem);
  font-weight: 800;
}

.hero p {
  margin: 0;
  max-width: 62ch;
  color: var(--muted);
  line-height: 1.7;
}

.hero--form p {
  width: min(100%, 58rem);
  max-width: none;
  text-align: left;
  font-size: 1.08rem;
  line-height: 1.85;
}

.panel {
  padding: 28px;
}

.form-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-section-title {
  grid-column: 1 / -1;
  margin: 10px 0 2px;
  padding-top: 10px;
  border-top: 1px solid rgba(22, 32, 51, 0.1);
  font-size: 1.25rem;
  line-height: 1.3;
}

.form-section-title:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
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

.field-note[data-state="error"] {
  color: var(--danger);
}

.field-note[data-state="ok"] {
  color: var(--success);
}

.inline-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.choice-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.media-preview-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.media-preview-grid[hidden] {
  display: none !important;
}

.media-preview-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(22, 32, 51, 0.12);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.7);
}

.media-preview-frame {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(22, 32, 51, 0.08);
}

.media-preview-frame img,
.media-preview-frame video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-preview-meta {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: var(--muted);
  font-size: 0.86rem;
  line-height: 1.45;
}

.media-preview-name {
  overflow-wrap: anywhere;
  color: var(--text);
  font-weight: 700;
}

.media-preview-status[data-state="error"] {
  color: var(--danger);
}

.media-preview-status[data-state="ok"] {
  color: var(--success);
}

.choice-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 48px;
  padding: 12px 14px;
  border: 1px solid rgba(22, 32, 51, 0.12);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.62);
  line-height: 1.45;
}

.choice-option input {
  width: auto;
  margin-top: 3px;
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

.hotline-notice {
  margin: 18px 0 0;
  padding: 16px 18px;
  border: 1px solid rgba(13, 107, 111, 0.18);
  border-radius: var(--radius-sm);
  background: rgba(223, 246, 241, 0.78);
  color: var(--accent);
  font-weight: 700;
  line-height: 1.7;
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

${MEDIA_PICKER_CSS}

.location-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.location-actions .button {
  border-radius: var(--radius-sm);
  padding: 12px 16px;
}

.map-picker[hidden] {
  display: none;
}

.map-picker {
  display: grid;
  gap: 10px;
}

.map-picker__canvas {
  width: 100%;
  min-height: 320px;
  overflow: hidden;
  border: 1px solid rgba(22, 32, 51, 0.14);
  border-radius: var(--radius-sm);
  background: rgba(22, 32, 51, 0.04);
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

  .hero--form h1 {
    white-space: normal;
  }

  .hero--form p {
    font-size: 1rem;
  }

  .standalone-toolbar {
    justify-content: stretch;
    flex-wrap: wrap;
  }

  .standalone-language-picker {
    width: 100%;
    justify-content: stretch;
    flex-wrap: wrap;
  }

  .standalone-language-picker__option {
    flex: 1 1 0;
    min-width: 0;
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

const PARENT_MOTIVATION_OPTIONS = [
  { label: '"网瘾"/游戏沉迷', value: '"网瘾"/游戏沉迷' },
  { label: '"厌学"/学业问题', value: '"厌学"/学业问题' },
  { label: '"叛逆"/行为管教', value: '"叛逆"/行为管教' },
  { label: '精神或心理健康相关问题', value: '精神或心理健康相关问题' },
  { label: '性别认同相关（如跨性别等）', value: '性别认同相关（如跨性别等）' },
  { label: '性取向相关（如同性恋、双性恋等）', value: '性取向相关（如同性恋、双性恋等）' },
  { label: '家庭冲突中的恶意施暴或惩罚手段', value: '家庭冲突中的恶意施暴或惩罚手段' },
  { label: '咨询师/医生/老师等人士建议', value: '咨询师/医生/老师等人士建议' },
  { label: '亲属或身边人建议', value: '亲属或身边人建议' },
  { label: '网络广告或机构宣传误导', value: '网络广告或机构宣传误导' },
  { label: '不清楚/从未被告知原因', value: '不清楚/从未被告知原因' },
  { labelKey: 'labelOther', value: CUSTOM_PARENT_MOTIVATION_OPTION },
] as const;

const EXIT_METHOD_OPTIONS = [
  { label: '到期后家长接回', value: '到期后家长接回' },
  { label: '自行逃离', value: '自行逃离' },
  { label: '被强制转学', value: '被强制转学' },
  { label: '被解救', value: '被解救' },
  { label: '机构关闭', value: '机构关闭' },
  { labelKey: 'labelOther', value: CUSTOM_EXIT_METHOD_OPTION },
] as const;

const LEGAL_AID_OPTIONS = [
  { label: '是', value: '是' },
  { label: '否', value: '否' },
  { label: '想但不知道途径', value: '想但不知道途径' },
  { label: '担心报复', value: '担心报复' },
  { labelKey: 'labelOther', value: CUSTOM_LEGAL_AID_OPTION },
] as const;

const VIOLENCE_CATEGORY_OPTIONS = [
  { label: '虚假/非法宣传', value: '虚假/非法宣传' },
  { label: '冒充警察绑架', value: '冒充警察绑架' },
  { label: '直接接触的肢体暴力（如扇耳光等）', value: '直接接触的肢体暴力（如扇耳光等）' },
  { label: '使用工具的肢体暴力（如棍棒殴打、电击等）', value: '使用工具的肢体暴力（如棍棒殴打、电击等）' },
  { label: '体罚（如长跑等）', value: '体罚（如长跑等）' },
  { label: '限制自由（如捆绑等）', value: '限制自由（如捆绑等）' },
  { label: '辱骂或公开羞辱', value: '辱骂或公开羞辱' },
  { label: '言语的性暴力（如性羞辱等）', value: '言语的性暴力（如性羞辱等）' },
  { label: '肢体的性暴力（如性侵犯等）', value: '肢体的性暴力（如性侵犯等）' },
  { label: '关禁闭', value: '关禁闭' },
  { label: '饮食限制或不健康饮食', value: '饮食限制或不健康饮食' },
  { label: '睡眠剥夺', value: '睡眠剥夺' },
  { label: '强迫服用药物', value: '强迫服用药物' },
  { label: '性别扭转（如强迫改变外表等）', value: '性别扭转（如强迫改变外表等）' },
  { label: '精神控制或洗脑', value: '精神控制或洗脑' },
  { labelKey: 'labelOther', value: CUSTOM_VIOLENCE_CATEGORY_OPTION },
] as const;

const CHOICE_LABELS: Record<SupportedLanguage, Record<string, string>> = {
  'zh-CN': {},
  'zh-TW': {
    朋友: '朋友',
    伴侣: '伴侶',
    亲属: '親屬',
    救助工作者: '救助工作者',
    女性: '女性',
    男性: '男性',
    '"网瘾"/游戏沉迷': '"網癮" / 遊戲沉迷',
    '"厌学"/学业问题': '"厭學" / 學業問題',
    '"叛逆"/行为管教': '"叛逆" / 行為管教',
    精神或心理健康相关问题: '精神或心理健康相關問題',
    '性别认同相关（如跨性别等）': '性別認同相關（如跨性別等）',
    '性取向相关（如同性恋、双性恋等）': '性取向相關（如同性戀、雙性戀等）',
    家庭冲突中的恶意施暴或惩罚手段: '家庭衝突中的惡意施暴或懲罰手段',
    '咨询师/医生/老师等人士建议': '諮詢師 / 醫生 / 老師等人士建議',
    亲属或身边人建议: '親屬或身邊人建議',
    网络广告或机构宣传误导: '網路廣告或機構宣傳誤導',
    '不清楚/从未被告知原因': '不清楚 / 從未被告知原因',
    到期后家长接回: '到期後家長接回',
    自行逃离: '自行逃離',
    被强制转学: '被強制轉學',
    被解救: '被解救',
    机构关闭: '機構關閉',
    是: '是',
    否: '否',
    想但不知道途径: '想但不知道途徑',
    担心报复: '擔心報復',
    '虚假/非法宣传': '虛假 / 非法宣傳',
    冒充警察绑架: '冒充警察綁架',
    '直接接触的肢体暴力（如扇耳光等）': '直接接觸的肢體暴力（如扇耳光等）',
    '使用工具的肢体暴力（如棍棒殴打、电击等）': '使用工具的肢體暴力（如棍棒毆打、電擊等）',
    '体罚（如长跑等）': '體罰（如長跑等）',
    '限制自由（如捆绑等）': '限制自由（如綑綁等）',
    辱骂或公开羞辱: '辱罵或公開羞辱',
    '言语的性暴力（如性羞辱等）': '言語的性暴力（如性羞辱等）',
    '肢体的性暴力（如性侵犯等）': '肢體的性暴力（如性侵犯等）',
    关禁闭: '關禁閉',
    饮食限制或不健康饮食: '飲食限制或不健康飲食',
    睡眠剥夺: '睡眠剝奪',
    强迫服用药物: '強迫服用藥物',
    '性别扭转（如强迫改变外表等）': '性別扭轉（如強迫改變外表等）',
    精神控制或洗脑: '精神控制或洗腦',
  },
  en: {
    朋友: 'Friend',
    伴侣: 'Partner',
    亲属: 'Family member',
    救助工作者: 'Support worker',
    女性: 'Female',
    男性: 'Male',
    '"网瘾"/游戏沉迷': '"Internet addiction" / gaming',
    '"厌学"/学业问题': '"School refusal" / academic issues',
    '"叛逆"/行为管教': '"Rebelliousness" / behavior control',
    精神或心理健康相关问题: 'Mental health or psychological concerns',
    '性别认同相关（如跨性别等）': 'Gender identity related (such as being transgender)',
    '性取向相关（如同性恋、双性恋等）': 'Sexual orientation related (such as being gay or bisexual)',
    家庭冲突中的恶意施暴或惩罚手段: 'Malicious abuse or punishment amid family conflict',
    '咨询师/医生/老师等人士建议': 'Suggested by a counselor / doctor / teacher / similar authority',
    亲属或身边人建议: 'Suggested by relatives or people nearby',
    网络广告或机构宣传误导: 'Misled by online ads or institutional promotion',
    '不清楚/从未被告知原因': 'Unknown / never told the reason',
    到期后家长接回: 'Picked up by parents after the term ended',
    自行逃离: 'Escaped independently',
    被强制转学: 'Forced transfer',
    被解救: 'Rescued',
    机构关闭: 'Institution shut down',
    是: 'Yes',
    否: 'No',
    想但不知道途径: 'Wanted to, but did not know how',
    担心报复: 'Worried about retaliation',
    '虚假/非法宣传': 'False / illegal promotion',
    冒充警察绑架: 'Kidnapping while impersonating police',
    '直接接触的肢体暴力（如扇耳光等）': 'Direct physical violence (such as slapping)',
    '使用工具的肢体暴力（如棍棒殴打、电击等）': 'Physical violence with tools (such as beatings or electric shocks)',
    '体罚（如长跑等）': 'Corporal punishment (such as forced running)',
    '限制自由（如捆绑等）': 'Restriction of freedom (such as tying someone up)',
    辱骂或公开羞辱: 'Insults or public humiliation',
    '言语的性暴力（如性羞辱等）': 'Verbal sexual violence (such as sexual humiliation)',
    '肢体的性暴力（如性侵犯等）': 'Physical sexual violence (such as assault)',
    关禁闭: 'Solitary confinement',
    饮食限制或不健康饮食: 'Food restriction or unhealthy diet',
    睡眠剥夺: 'Sleep deprivation',
    强迫服用药物: 'Forced medication',
    '性别扭转（如强迫改变外表等）': 'Gender conversion practices (such as forced appearance changes)',
    精神控制或洗脑: 'Psychological control or brainwashing',
  },
};

const TEXTS: Record<SupportedLanguage, PageTexts> = {
  'zh-CN': {
    actionBack: '返回',
    actionConfirm: '确认提交',
    actionOpenForm: '打开填写页',
    actionOpenMapPicker: '点击可直接在地图上选点',
    actionUploadMedia: '上传并提交审核',
    actionSubmit: '继续确认',
    actionSubmitting: '提交中...',
    actionUseCurrentLocation: '获取当前位置',
    fieldAbuserInfo: '已知施暴者/教官基本信息与描述',
    fieldAddress: '机构地址',
    fieldBasicSection: '个人基本信息',
    fieldBirthYear: '出生年份',
    fieldCity: '机构所在城市 / 区县',
    fieldContact: '机构联系方式',
    fieldCoordinates: '经纬度',
    fieldCounty: '机构所在县区',
    fieldDateEnd: '离开日期',
    fieldDateStart: '首次被送入日期',
    fieldExitMethod: '离开机构的方式',
    fieldExperience: '个人在校经历描述',
    fieldExperienceSection: '相关经历',
    fieldExposureSection: '机构曝光信息',
    fieldHeadmaster: '负责人 / 校长姓名',
    fieldIdentity: '请问您是作为什么身份来填写本表单？',
    fieldLegalAidStatus: '是否曾对此经历进行过举报或寻求法律援助',
    fieldMediaFile: '学校相关媒体',
    fieldMediaR18: '是否 R18',
    fieldMediaSection: '学校媒体',
    fieldMediaTags: '媒体标签，逗号分隔',
    fieldOther: '其它补充',
    fieldParentMotivations: '家长选择矫正机构的原因/动机？',
    fieldPreInstitutionCity: '进入机构前所在城市？',
    fieldPreInstitutionProvince: '进入机构前所在省份？',
    fieldProvince: '机构所在省份',
    fieldRelationship: '您与受害者的关系？',
    fieldScandal: '丑闻及暴力行为详细描述',
    fieldSchoolAwarenessBeforeEntry: '在你进去之前是否听说过这种学校或者任何关于这种学校的新闻',
    fieldSchoolName: '机构名称',
    fieldSex: '性别',
    fieldSexCustom: '其它性别认同',
    fieldSexCustomText: '自定义性别说明',
    fieldVictimBirthYear: '受害者出生年份',
    fieldVictimExperienceSection: '受害人经历',
    fieldVictimSex: '受害者性别',
    fieldViolenceCategories: '机构丑闻及暴力行为（请选出符合自己经历及目睹他人受暴的所有选项）',
    helperCoordinates: '如果通过地图或定位取得经纬度，会写入下面的文本框；也可以手动填写“纬度, 经度”。',
    helperFormIntro: '隐私说明：本问卷中填写的出生年份、性别等个人基本信息将被严格保密，相关经历、机构曝光信息未来可能公开展示，请勿在可能公开的字段中填写身份证号、私人电话、家庭住址等您的个人敏感信息。 填写过程中如感不适可随时停止',
    helperMediaUpload: '媒体按学校分类，不绑定具体受害者记录。选好后随问卷一起提交；如为 R18 内容请添加 r18 标签。',
    hintDateEnd: '若目前仍在校，可不填',
    hintDateStart: '假如有多次被送入经历，可在经历描述中说明情况',
    hintExperience: '若描述别人经历请在“其它补充”中填写',
    labelHotlineNotice: '全国统一心理援助：12356；青少年心理咨询和法律援助：12355；希望热线（全国性24小时心理危机干预）：400-161-9995',
    labelIdentityAgent: '受害者的代理人',
    labelIdentitySelf: '受害者本人',
    labelLanguage: '语言',
    labelOther: '其它',
    labelResultFailed: '投递失败',
    labelResultSucceeded: '投递成功',
    pageDescription: '隐私说明：本问卷中填写的出生年份、性别等个人基本信息将被严格保密，相关经历、机构曝光信息未来可能公开展示，请勿在可能公开的字段中填写身份证号、私人电话、家庭住址等您的个人敏感信息。 填写过程中如感不适可随时停止',
    pageErrorTitle: '提交失败',
    pageFormTitle: '扭转机构受害者情况问卷调查',
    pagePreviewTitle: '确认提交信息',
    pageResultTitle: '提交结果',
    pageSuccessTitle: '提交完成',
    placeholderAddress: '若已知，请详细填写机构地址',
    placeholderAbuserInfo: '可填写施暴者姓名、联系方式、施暴内容等信息。',
    placeholderBirthYear: '请选择年份',
    placeholderCity: '请先选择省份',
    placeholderContact: '电话、邮箱或其它公开联系方式',
    placeholderCoordinates: '例如：39.904200, 116.407400',
    placeholderCounty: '可选：请先选择城市',
    placeholderExperience: '请描述个人在校经历、管理方式等...',
    placeholderExitMethod: '可选：请选择离开机构的方式',
    placeholderExitMethodOther: '其它方式：请填写具体情况',
    placeholderHeadmaster: '姓名',
    placeholderLegalAidOther: '其它：请填写补充说明',
    placeholderLegalAidStatus: '可选：请选择当前情况',
    placeholderParentMotivationOther: '其它原因：请填写具体原因',
    placeholderPreInstitutionCity: '可选：请先选择进入机构前所在省份',
    placeholderPreInstitutionProvince: '可选：选择进入机构前所在省份',
    placeholderProvince: '请选择省份',
    placeholderRelationship: '请选择关系',
    placeholderRelationshipOther: '其它关系说明',
    placeholderScandal: '请描述已知的丑闻与暴力行为...',
    placeholderSchoolAwarenessBeforeEntry: '可以写“听说过 / 没听说过”，也可以补充你当时知道的信息或新闻来源。',
    placeholderSchoolName: '请填写机构完整名称',
    placeholderSex: '请选择',
    placeholderSexCustom: '请选择或填写',
    placeholderSexCustomText: '请填写',
    placeholderTextBlock: '任何您想补充的信息',
    placeholderViolenceCategoryOther: '其它暴力行为：请填写具体情况',
    previewEmpty: '未填写',
    previewLead: '以下信息将用于最终提交，请再次确认。',
    previewTitle: '提交前确认',
    statusFailedTargets: '失败目标',
    statusLocationFailed: '无法获取当前位置，请检查浏览器定位授权。',
    statusLocationSelected: '已记录经纬度。',
    statusLocationUnavailable: '当前浏览器不支持定位。',
    statusMapLoading: '地图载入中，请稍候。',
    statusMapPrompt: '点击地图上的位置即可写入经纬度。',
    statusSucceededTargets: '成功目标',
    statusUnknownError: '未知错误',
    validationDateFormat: '请输入 4 位年份的有效日期。',
    validationExitMethodOther: '请输入其它离开机构的方式',
    validationLegalAidOther: '请输入其它补充说明',
    validationParentMotivationOther: '请输入其它原因',
    validationParentMotivations: '请至少选择一项家长选择矫正机构的原因/动机',
    validationViolenceCategoryOther: '请输入其它暴力行为',
  },
  'zh-TW': {
    actionBack: '返回',
    actionConfirm: '確認送出',
    actionOpenForm: '開啟填寫頁',
    actionOpenMapPicker: '點擊可直接在地圖上選點',
    actionUploadMedia: '上傳並提交審核',
    actionSubmit: '繼續確認',
    actionSubmitting: '送出中...',
    actionUseCurrentLocation: '取得目前位置',
    fieldAbuserInfo: '已知施暴者 / 教官基本資訊與描述',
    fieldAddress: '機構地址',
    fieldBasicSection: '個人基本資訊',
    fieldBirthYear: '出生年份',
    fieldCity: '機構所在城市 / 區縣',
    fieldContact: '機構聯絡方式',
    fieldCoordinates: '經緯度',
    fieldCounty: '機構所在縣區',
    fieldDateEnd: '離開日期',
    fieldDateStart: '首次被送入日期',
    fieldExitMethod: '離開機構的方式',
    fieldExperience: '個人在校經歷描述',
    fieldExperienceSection: '相關經歷',
    fieldExposureSection: '機構曝光資訊',
    fieldHeadmaster: '負責人 / 校長姓名',
    fieldIdentity: '請問您是以什麼身份填寫本表單？',
    fieldLegalAidStatus: '是否曾對此經歷進行舉報或尋求法律援助',
    fieldMediaFile: '學校相關媒體',
    fieldMediaR18: '是否 R18',
    fieldMediaSection: '學校媒體',
    fieldMediaTags: '媒體標籤，逗號分隔',
    fieldOther: '其它補充',
    fieldParentMotivations: '家長選擇矯正機構的原因 / 動機？',
    fieldPreInstitutionCity: '進入機構前所在城市？',
    fieldPreInstitutionProvince: '進入機構前所在省份？',
    fieldProvince: '機構所在省份',
    fieldRelationship: '您與受害者的關係？',
    fieldScandal: '醜聞及暴力行為詳細描述',
    fieldSchoolAwarenessBeforeEntry: '在你進去之前是否聽說過這種學校，或任何關於這種學校的新聞',
    fieldSchoolName: '機構名稱',
    fieldSex: '性別',
    fieldSexCustom: '其它性別認同',
    fieldSexCustomText: '自定義性別說明',
    fieldVictimBirthYear: '受害者出生年份',
    fieldVictimExperienceSection: '受害人經歷',
    fieldVictimSex: '受害者性別',
    fieldViolenceCategories: '機構醜聞及暴力行為（請選出符合自己經歷及目睹他人受暴的所有選項）',
    helperCoordinates: '如果透過地圖或定位取得經緯度，會寫入下面的文字框；也可以手動填寫「緯度, 經度」。',
    helperFormIntro: '隱私說明：本問卷中填寫的出生年份、性別等個人基本資訊將被嚴格保密，相關經歷、機構曝光資訊未來可能公開展示，請勿在可能公開的欄位中填寫身分證號、私人電話、家庭住址等您的個人敏感資訊。 填寫過程中如感不適可隨時停止',
    helperMediaUpload: '媒體按學校分類，不綁定具體受害者記錄。選好後隨問卷一起提交；如為 R18 內容請加入 r18 標籤。',
    hintDateEnd: '若目前仍在校，可不填',
    hintDateStart: '假如有多次被送入經歷，可在經歷描述中說明情況',
    hintExperience: '若描述別人經歷請在「其它補充」中填寫',
    labelHotlineNotice: '全國統一心理援助：12356；青少年心理諮詢和法律援助：12355；希望熱線（全國性24小時心理危機干預）：400-161-9995',
    labelIdentityAgent: '受害者的代理人',
    labelIdentitySelf: '受害者本人',
    labelLanguage: '語言',
    labelOther: '其它',
    labelResultFailed: '投遞失敗',
    labelResultSucceeded: '投遞成功',
    pageDescription: '隱私說明：本問卷中填寫的出生年份、性別等個人基本資訊將被嚴格保密，相關經歷、機構曝光資訊未來可能公開展示，請勿在可能公開的欄位中填寫身分證號、私人電話、家庭住址等您的個人敏感資訊。 填寫過程中如感不適可隨時停止',
    pageErrorTitle: '送出失敗',
    pageFormTitle: '扭轉機構受害者情況問卷調查',
    pagePreviewTitle: '確認提交資訊',
    pageResultTitle: '提交結果',
    pageSuccessTitle: '提交完成',
    placeholderAddress: '若已知，請詳細填寫機構地址',
    placeholderAbuserInfo: '可填寫施暴者姓名、聯絡方式、施暴內容等資訊。',
    placeholderBirthYear: '請選擇年份',
    placeholderCity: '請先選擇省份',
    placeholderContact: '電話、Email 或其它公開聯絡方式',
    placeholderCoordinates: '例如：39.904200, 116.407400',
    placeholderCounty: '可選：請先選擇城市',
    placeholderExperience: '請描述個人在校經歷、管理方式等...',
    placeholderExitMethod: '可選：請選擇離開機構的方式',
    placeholderExitMethodOther: '其它方式：請填寫具體情況',
    placeholderHeadmaster: '姓名',
    placeholderLegalAidOther: '其它：請填寫補充說明',
    placeholderLegalAidStatus: '可選：請選擇目前情況',
    placeholderParentMotivationOther: '其它原因：請填寫具體原因',
    placeholderPreInstitutionCity: '可選：請先選擇進入機構前所在省份',
    placeholderPreInstitutionProvince: '可選：選擇進入機構前所在省份',
    placeholderProvince: '請選擇省份',
    placeholderRelationship: '請選擇關係',
    placeholderRelationshipOther: '其它關係說明',
    placeholderScandal: '請描述已知的醜聞與暴力行為...',
    placeholderSchoolAwarenessBeforeEntry: '可以寫「聽說過 / 沒聽說過」，也可以補充你當時知道的資訊或新聞來源。',
    placeholderSchoolName: '請填寫機構完整名稱',
    placeholderSex: '請選擇',
    placeholderSexCustom: '請選擇或填寫',
    placeholderSexCustomText: '請填寫',
    placeholderTextBlock: '任何您想補充的資訊',
    placeholderViolenceCategoryOther: '其它暴力行為：請填寫具體情況',
    previewEmpty: '未填寫',
    previewLead: '以下資訊將用於最終提交，請再次確認。',
    previewTitle: '提交前確認',
    statusFailedTargets: '失敗目標',
    statusLocationFailed: '無法取得目前位置，請檢查瀏覽器定位授權。',
    statusLocationSelected: '已記錄經緯度。',
    statusLocationUnavailable: '目前瀏覽器不支援定位。',
    statusMapLoading: '地圖載入中，請稍候。',
    statusMapPrompt: '點擊地圖上的位置即可寫入經緯度。',
    statusSucceededTargets: '成功目標',
    statusUnknownError: '未知錯誤',
    validationDateFormat: '請輸入 4 位年份的有效日期。',
    validationExitMethodOther: '請輸入其它離開機構的方式',
    validationLegalAidOther: '請輸入其它補充說明',
    validationParentMotivationOther: '請輸入其它原因',
    validationParentMotivations: '請至少選擇一項家長選擇矯正機構的原因 / 動機',
    validationViolenceCategoryOther: '請輸入其它暴力行為',
  },
  en: {
    actionBack: 'Back',
    actionConfirm: 'Confirm submission',
    actionOpenForm: 'Open form',
    actionOpenMapPicker: 'Pick on map',
    actionUploadMedia: 'Upload for review',
    actionSubmit: 'Continue',
    actionSubmitting: 'Submitting...',
    actionUseCurrentLocation: 'Use current location',
    fieldAbuserInfo: 'Known abusers / instructors',
    fieldAddress: 'Institution address',
    fieldBasicSection: 'Basic information',
    fieldBirthYear: 'Birth year',
    fieldCity: 'Institution city / district',
    fieldContact: 'Institution contact information',
    fieldCoordinates: 'Coordinates',
    fieldCounty: 'County / district',
    fieldDateEnd: 'End date',
    fieldDateStart: 'First admission date',
    fieldExitMethod: 'How the person left',
    fieldExperience: 'On-campus experience description',
    fieldExperienceSection: 'Experience',
    fieldExposureSection: 'Institution exposure',
    fieldHeadmaster: 'Headmaster / lead staff',
    fieldIdentity: 'What identity are you using to fill out this form?',
    fieldLegalAidStatus: 'Report or legal aid status',
    fieldMediaFile: 'School-related media',
    fieldMediaR18: 'R18 media?',
    fieldMediaSection: 'School media',
    fieldMediaTags: 'Media tags, comma-separated',
    fieldOther: 'Other notes',
    fieldParentMotivations: 'Why did the guardian choose the correction institution?',
    fieldPreInstitutionCity: 'City before entering the institution',
    fieldPreInstitutionProvince: 'Province before entering the institution',
    fieldProvince: 'Province',
    fieldRelationship: 'Relationship to the survivor',
    fieldScandal: 'Scandal and violence',
    fieldSchoolAwarenessBeforeEntry: 'Before you were sent there, had you heard of this kind of school or any news about it?',
    fieldSchoolName: 'Institution name',
    fieldSex: 'Sex / gender',
    fieldSexCustom: 'Other gender identity',
    fieldSexCustomText: 'Custom gender note',
    fieldVictimBirthYear: 'Victim birth year',
    fieldVictimExperienceSection: 'Victim experience',
    fieldVictimSex: 'Victim sex / gender',
    fieldViolenceCategories: 'Scandals and violent acts',
    helperCoordinates: 'Map selection or geolocation will write coordinates into this text field. You can also enter "latitude, longitude" manually.',
    helperFormIntro: 'Privacy notice: Personal basic information entered in this questionnaire, such as birth year and sex/gender, will be kept strictly confidential. Related experiences and institution exposure information may be publicly displayed in the future. Please do not enter ID numbers, private phone numbers, home addresses, or other personal sensitive information in fields that may become public. You may stop at any time if you feel uncomfortable while filling it out.',
    helperMediaUpload: 'Media is grouped by school and is not linked to a specific survivor record. Selected media is submitted with the questionnaire; add the r18 tag for R18 content.',
    hintDateEnd: 'Leave blank if the person is still there.',
    hintDateStart: 'If there were multiple admissions, describe them in the experience field.',
    hintExperience: 'If describing someone else, add context in Other notes.',
    labelHotlineNotice: 'National mental health support: 12356; youth mental health counseling and legal aid: 12355; Hope Hotline (national 24-hour psychological crisis intervention): 400-161-9995.',
    labelIdentityAgent: 'Representative of the survivor',
    labelIdentitySelf: 'Survivor',
    labelLanguage: 'Language',
    labelOther: 'Other',
    labelResultFailed: 'Failed',
    labelResultSucceeded: 'Delivered',
    pageDescription: 'Privacy notice: Personal basic information entered in this questionnaire, such as birth year and sex/gender, will be kept strictly confidential. Related experiences and institution exposure information may be publicly displayed in the future. Please do not enter ID numbers, private phone numbers, home addresses, or other personal sensitive information in fields that may become public. You may stop at any time if you feel uncomfortable while filling it out.',
    pageErrorTitle: 'Submission failed',
    pageFormTitle: 'Conversion Institution Survivor Questionnaire',
    pagePreviewTitle: 'Review the submission',
    pageResultTitle: 'Submission result',
    pageSuccessTitle: 'Submission complete',
    placeholderAddress: 'Detailed institution address if known',
    placeholderAbuserInfo: 'Names, contact details, or what they did if known.',
    placeholderBirthYear: 'Select a year',
    placeholderCity: 'Select a province first',
    placeholderContact: 'Phone, email, or another public contact',
    placeholderCoordinates: 'Example: 39.904200, 116.407400',
    placeholderCounty: 'Optional: select a city first',
    placeholderExperience: 'Describe the on-campus experience, management methods, and related details...',
    placeholderExitMethod: 'Optional: select how the person left',
    placeholderExitMethodOther: 'Other way: please describe',
    placeholderHeadmaster: 'Name',
    placeholderLegalAidOther: 'Other: please describe',
    placeholderLegalAidStatus: 'Optional: select current status',
    placeholderParentMotivationOther: 'Other reason: please describe',
    placeholderPreInstitutionCity: 'Optional: select the province first',
    placeholderPreInstitutionProvince: 'Optional: select the province before entry',
    placeholderProvince: 'Select a province',
    placeholderRelationship: 'Select the relationship',
    placeholderRelationshipOther: 'Describe the relationship',
    placeholderScandal: 'Describe known scandals and violence...',
    placeholderSchoolAwarenessBeforeEntry: 'You can answer yes/no and add what you had heard or where you heard it.',
    placeholderSchoolName: 'Enter the full institution name',
    placeholderSex: 'Select',
    placeholderSexCustom: 'Select or enter',
    placeholderSexCustomText: 'Please fill in',
    placeholderTextBlock: 'Anything else you want to add',
    placeholderViolenceCategoryOther: 'Other violent behavior: please describe',
    previewEmpty: 'Not provided',
    previewLead: 'These values will be used for the final submission. Please review them carefully.',
    previewTitle: 'Review before submission',
    statusFailedTargets: 'Failed targets',
    statusLocationFailed: 'Unable to get the current location. Check browser location permission.',
    statusLocationSelected: 'Coordinates recorded.',
    statusLocationUnavailable: 'This browser does not support geolocation.',
    statusMapLoading: 'Loading the map...',
    statusMapPrompt: 'Click a point on the map to write coordinates.',
    statusSucceededTargets: 'Successful targets',
    statusUnknownError: 'Unknown error',
    validationDateFormat: 'Enter a valid date with a 4-digit year.',
    validationExitMethodOther: 'Please describe the other exit method.',
    validationLegalAidOther: 'Please add the other legal aid note.',
    validationParentMotivationOther: 'Please describe the other reason.',
    validationParentMotivations: 'Select at least one reason.',
    validationViolenceCategoryOther: 'Please describe the other violent behavior.',
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

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['zh-CN', 'zh-TW', 'en'];

const LANGUAGE_OPTION_LABELS: Record<
  SupportedLanguage,
  Record<SupportedLanguage, string>
> = {
  'zh-CN': {
    'zh-CN': '简中',
    'zh-TW': '繁中',
    en: 'English',
  },
  'zh-TW': {
    'zh-CN': '簡中',
    'zh-TW': '繁中',
    en: 'English',
  },
  en: {
    'zh-CN': '简中',
    'zh-TW': '繁中',
    en: 'English',
  },
};

function getLanguageOptions(language: SupportedLanguage): LanguageOption[] {
  const labels = LANGUAGE_OPTION_LABELS[resolveLanguage(language)];

  return SUPPORTED_LANGUAGES.map((code) => ({
    code,
    label: labels[code],
  }));
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

const LanguagePicker: FC<{
  lang: SupportedLanguage;
  texts: PageTexts;
}> = ({ lang, texts }) => (
  <div className="standalone-toolbar" aria-label={texts.labelLanguage}>
    <span className="standalone-language-picker__label">{texts.labelLanguage}</span>
    <div className="standalone-language-picker" role="group" aria-label={texts.labelLanguage}>
      {getLanguageOptions(lang).map((option) => (
        <a
          aria-current={option.code === lang ? 'page' : undefined}
          className={`standalone-language-picker__option${option.code === lang ? ' is-active' : ''}`}
          data-standalone-language-link={option.code}
          href={buildFormHref(option.code)}
          key={option.code}
        >
          {option.label}
        </a>
      ))}
    </div>
  </div>
);

function localizeStoredChoice(
  value: unknown,
  texts: PageTexts,
  language: SupportedLanguage,
): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (value === SELF_IDENTITY) {
    return texts.labelIdentitySelf;
  }

  if (value === AGENT_IDENTITY) {
    return texts.labelIdentityAgent;
  }

  if (
    value === OTHER_SEX_OPTION
    || value === CUSTOM_OTHER_SEX_OPTION
    || value === CUSTOM_AGENT_RELATIONSHIP_OPTION
    || value === CUSTOM_PARENT_MOTIVATION_OPTION
    || value === CUSTOM_EXIT_METHOD_OPTION
    || value === CUSTOM_LEGAL_AID_OPTION
    || value === CUSTOM_VIOLENCE_CATEGORY_OPTION
  ) {
    return texts.labelOther;
  }

  return CHOICE_LABELS[language][value] ?? value;
}

function getOptionLabel(
  option: {
    label?: string;
    labelKey?: 'labelOther';
    value: string;
  },
  texts: PageTexts,
  language: SupportedLanguage,
): string {
  if (option.labelKey === 'labelOther') {
    return texts.labelOther;
  }

  return CHOICE_LABELS[language][option.value] ?? option.label ?? option.value;
}

function formatSummaryValue(
  value: unknown,
  fallback: string,
  texts: PageTexts,
  language: SupportedLanguage,
): string {
  if (Array.isArray(value)) {
    const localizedValues = value
      .map((item) => localizeStoredChoice(item, texts, language))
      .filter(Boolean);

    return localizedValues.length > 0 ? localizedValues.join('；') : fallback;
  }

  const text = String(localizeStoredChoice(value, texts, language) ?? '').trim();
  return text || fallback;
}

function buildSummaryItems(
  values: NoTorsionFormValues,
  texts: PageTexts,
  language: SupportedLanguage,
) {
  const items: Array<readonly [string, unknown]> = [
    [texts.fieldIdentity, localizeStoredChoice(values.identity, texts, language)],
  ];

  if (values.identity === AGENT_IDENTITY) {
    items.push([texts.fieldRelationship, values.agentRelationship]);
  }

  items.push(
    [texts.fieldBirthYear, values.birthYear],
    [texts.fieldSex, values.sex],
    [texts.fieldPreInstitutionProvince, values.preInstitutionProvince],
    [texts.fieldPreInstitutionCity, values.preInstitutionCity],
    [texts.fieldDateStart, values.dateStart],
    [texts.fieldDateEnd, values.dateEnd],
    [texts.fieldParentMotivations, values.parentMotivations],
    [texts.fieldExitMethod, values.exitMethod],
  );

  if (values.identity === SELF_IDENTITY) {
    items.push([
      texts.fieldSchoolAwarenessBeforeEntry,
      values.schoolAwarenessBeforeEntry,
    ]);
  }

  items.push(
    [texts.fieldExperience, values.experience],
    [texts.fieldLegalAidStatus, values.legalAidStatus],
    [texts.fieldSchoolName, values.schoolName],
    [texts.fieldProvince, values.province],
    [texts.fieldCity, values.city],
    [texts.fieldCounty, values.county],
    [texts.fieldAddress, values.schoolAddress],
    [texts.fieldCoordinates, values.schoolCoordinates],
    [texts.fieldContact, values.contactInformation],
    [texts.fieldHeadmaster, values.headmasterName],
    [texts.fieldAbuserInfo, values.abuserInfo],
    [texts.fieldViolenceCategories, values.violenceCategories],
    [texts.fieldScandal, values.scandal],
    [texts.fieldOther, values.other],
  );

  return items;
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

  if (!province || !city) return;

  function renderCities() {
    const cityOptions = areaPayload.citiesByProvinceCode?.[province.value] || [];
    updateSelectOptions(city, cityOptions, labels.city, city.dataset.selectedValue || '');
    city.dataset.selectedValue = '';
    renderCounties();
  }

  function renderCounties() {
    if (!county) return;

    const countyOptions = areaPayload.countiesByCityCode?.[city.value] || [];
    updateSelectOptions(county, countyOptions, labels.county, county.dataset.selectedValue || '');
    county.dataset.selectedValue = '';
  }

  province.addEventListener('change', () => {
    city.dataset.selectedValue = '';
    if (county) county.dataset.selectedValue = '';
    renderCities();
  });

  city.addEventListener('change', () => {
    if (county) county.dataset.selectedValue = '';
    renderCounties();
  });

  renderCities();
}

function syncConditionalVisibility() {
  const identitySelect = document.getElementById('identity');
  const birthYearLabel = document.getElementById('birth-year-label');
  const sexLabel = document.getElementById('sex-label');
  const experienceSectionTitle = document.getElementById('experience-section-title');
  const relationshipField = document.getElementById('relationship-field');
  const relationshipSelect = document.getElementById('agent-relationship');
  const relationshipOtherField = document.getElementById('relationship-other-field');
  const relationshipOtherInput = document.getElementById('agent-relationship-other');
  const schoolAwarenessField = document.getElementById('school-awareness-before-entry-field');
  const sexSelect = document.getElementById('sex');
  const sexOtherField = document.getElementById('sex-other-field');
  const sexOtherType = document.getElementById('sex-other-type');
  const sexOtherTextField = document.getElementById('sex-other-text-field');
  const sexOtherInput = document.getElementById('sex-other-text');
  const parentMotivationInputs = Array.from(document.querySelectorAll('input[name="parent_motivations"]'));
  const parentMotivationOtherField = document.getElementById('parent-motivation-other-field');
  const parentMotivationOtherInput = document.getElementById('parent-motivation-other');
  const dateEndInput = document.getElementById('date-end');
  const exitMethodField = document.getElementById('exit-method-field');
  const exitMethodSelect = document.getElementById('exit-method');
  const exitMethodOtherField = document.getElementById('exit-method-other-field');
  const exitMethodOtherInput = document.getElementById('exit-method-other');
  const legalAidSelect = document.getElementById('legal-aid-status');
  const legalAidOtherField = document.getElementById('legal-aid-other-field');
  const legalAidOtherInput = document.getElementById('legal-aid-other');
  const violenceCategoryInputs = Array.from(document.querySelectorAll('input[name="violence_categories"]'));
  const violenceCategoryOtherField = document.getElementById('violence-category-other-field');
  const violenceCategoryOtherInput = document.getElementById('violence-category-other');

  function setVisibility(field, input, shouldShow) {
    if (field) field.hidden = !shouldShow;
    if (input) {
      input.required = Boolean(shouldShow && input.dataset.requiredWhenShown === 'true');
      if (!shouldShow) {
        input.value = '';
        input.setCustomValidity('');
      }
    }
  }

  function selectedCheckboxValues(inputs) {
    return inputs.filter((input) => input.checked).map((input) => input.value);
  }

  function render() {
    const isAgent = identitySelect && identitySelect.value === ${JSON.stringify(AGENT_IDENTITY)};
    const isSelf = identitySelect && identitySelect.value === ${JSON.stringify(SELF_IDENTITY)};
    const usesOtherRelationship = relationshipSelect && relationshipSelect.value === ${JSON.stringify(CUSTOM_AGENT_RELATIONSHIP_OPTION)};
    const usesOtherSex = sexSelect && sexSelect.value === ${JSON.stringify(OTHER_SEX_OPTION)};
    const usesCustomSex = sexOtherType && sexOtherType.value === ${JSON.stringify(CUSTOM_OTHER_SEX_OPTION)};
    const usesOtherParentMotivation = selectedCheckboxValues(parentMotivationInputs).includes(${JSON.stringify(CUSTOM_PARENT_MOTIVATION_OPTION)});
    const hasDateEnd = Boolean(dateEndInput && dateEndInput.value);
    const usesOtherExitMethod = exitMethodSelect && exitMethodSelect.value === ${JSON.stringify(CUSTOM_EXIT_METHOD_OPTION)};
    const usesOtherLegalAid = legalAidSelect && legalAidSelect.value === ${JSON.stringify(CUSTOM_LEGAL_AID_OPTION)};
    const usesOtherViolenceCategory = selectedCheckboxValues(violenceCategoryInputs).includes(${JSON.stringify(CUSTOM_VIOLENCE_CATEGORY_OPTION)});

    if (birthYearLabel) {
      birthYearLabel.textContent = isAgent ? birthYearLabel.dataset.agentLabel || birthYearLabel.textContent : birthYearLabel.dataset.selfLabel || birthYearLabel.textContent;
    }
    if (sexLabel) {
      sexLabel.textContent = isAgent ? sexLabel.dataset.agentLabel || sexLabel.textContent : sexLabel.dataset.selfLabel || sexLabel.textContent;
    }
    if (experienceSectionTitle) {
      experienceSectionTitle.textContent = isAgent ? experienceSectionTitle.dataset.agentLabel || experienceSectionTitle.textContent : experienceSectionTitle.dataset.selfLabel || experienceSectionTitle.textContent;
    }

    if (relationshipField) relationshipField.hidden = !isAgent;
    if (relationshipOtherField) relationshipOtherField.hidden = !(isAgent && usesOtherRelationship);
    if (relationshipSelect) relationshipSelect.required = Boolean(isAgent);
    if (relationshipOtherInput) relationshipOtherInput.required = Boolean(isAgent && usesOtherRelationship);
    if (schoolAwarenessField) schoolAwarenessField.hidden = !isSelf;
    if (sexOtherField) sexOtherField.hidden = !usesOtherSex;
    if (sexOtherTextField) sexOtherTextField.hidden = !(usesOtherSex && usesCustomSex);
    if (sexOtherType) sexOtherType.required = Boolean(usesOtherSex);
    if (sexOtherInput) sexOtherInput.required = Boolean(usesOtherSex && usesCustomSex);
    setVisibility(parentMotivationOtherField, parentMotivationOtherInput, usesOtherParentMotivation);
    if (exitMethodField) exitMethodField.hidden = !hasDateEnd;
    if (exitMethodSelect) {
      exitMethodSelect.disabled = !hasDateEnd;
      if (!hasDateEnd) {
        exitMethodSelect.value = '';
        exitMethodSelect.setCustomValidity('');
      }
    }
    setVisibility(exitMethodOtherField, exitMethodOtherInput, Boolean(hasDateEnd && usesOtherExitMethod));
    setVisibility(legalAidOtherField, legalAidOtherInput, Boolean(usesOtherLegalAid));
    setVisibility(violenceCategoryOtherField, violenceCategoryOtherInput, usesOtherViolenceCategory);
  }

  if (identitySelect) identitySelect.addEventListener('change', render);
  if (relationshipSelect) relationshipSelect.addEventListener('change', render);
  if (sexSelect) sexSelect.addEventListener('change', render);
  if (sexOtherType) sexOtherType.addEventListener('change', render);
  parentMotivationInputs.forEach((input) => input.addEventListener('change', render));
  if (dateEndInput) dateEndInput.addEventListener('change', render);
  if (exitMethodSelect) exitMethodSelect.addEventListener('change', render);
  if (legalAidSelect) legalAidSelect.addEventListener('change', render);
  violenceCategoryInputs.forEach((input) => input.addEventListener('change', render));
  render();
}

function syncEnhancedValidation() {
  const form = document.querySelector('form');
  const parentMotivationInputs = Array.from(document.querySelectorAll('input[name="parent_motivations"]'));
  const parentMotivationValidityTarget = parentMotivationInputs[0];

  if (!form || !parentMotivationValidityTarget) return;

  function clearParentMotivationValidity() {
    parentMotivationValidityTarget.setCustomValidity('');
  }

  parentMotivationInputs.forEach((input) => {
    input.addEventListener('change', clearParentMotivationValidity);
  });

  form.addEventListener('submit', (event) => {
    clearParentMotivationValidity();

    const hasParentMotivation = parentMotivationInputs.some((input) => input.checked);
    if (!hasParentMotivation) {
      parentMotivationValidityTarget.setCustomValidity(parentMotivationValidityTarget.dataset.validationMessage || 'Select at least one option.');
      event.preventDefault();
      form.reportValidity();
    }
  });
}

function syncDateValidation() {
  const dateInputs = Array.from(document.querySelectorAll('input[type="date"][data-date-validation-message]'));
  const fourDigitYearPattern = /^\\d{4}-\\d{2}-\\d{2}$/;

  function validateDateInput(input) {
    if (input.value && !fourDigitYearPattern.test(input.value)) {
      input.setCustomValidity(input.dataset.dateValidationMessage || 'Enter a valid date with a 4-digit year.');
      return;
    }

    input.setCustomValidity('');
  }

  dateInputs.forEach((input) => {
    input.addEventListener('input', () => validateDateInput(input));
    input.addEventListener('change', () => validateDateInput(input));
    validateDateInput(input);
  });
}

function syncLocationPicker() {
  const coordinatesInput = document.getElementById('school-coordinates');
  const openMapButton = document.getElementById('open-map-picker');
  const currentLocationButton = document.getElementById('use-current-location');
  const mapPicker = document.getElementById('map-picker');
  const mapCanvas = document.getElementById('map-picker-canvas');
  const mapStatus = document.getElementById('map-picker-status');
  let map = null;
  let marker = null;

  if (!coordinatesInput || !openMapButton || !currentLocationButton || !mapPicker || !mapCanvas) {
    return;
  }

  function revealCoordinateOutput() {
    coordinatesInput.hidden = false;
    if (mapStatus) mapStatus.hidden = false;
  }

  function getStatusText(name, fallback) {
    return (mapStatus && mapStatus.dataset && mapStatus.dataset[name]) || fallback;
  }

  function setStatus(text) {
    if (mapStatus) mapStatus.textContent = text;
  }

  function parseCoordinates(value) {
    const match = String(value || '').trim().match(/^([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))\\s*[,，]\\s*([+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+))$/);
    if (!match) return null;

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

    return { latitude, longitude };
  }

  function formatCoordinates(latitude, longitude) {
    return latitude.toFixed(6) + ', ' + longitude.toFixed(6);
  }

  function updateMarker(latitude, longitude) {
    if (!map || !window.L) return;

    const point = [latitude, longitude];
    if (marker) {
      marker.setLatLng(point);
    } else {
      marker = window.L.marker(point).addTo(map);
    }
    map.setView(point, Math.max(map.getZoom(), 13));
  }

  function setCoordinates(latitude, longitude, shouldUpdateMap) {
    revealCoordinateOutput();
    coordinatesInput.value = formatCoordinates(latitude, longitude);
    setStatus(getStatusText('selected', 'Coordinates recorded.'));
    if (shouldUpdateMap) updateMarker(latitude, longitude);
  }

  function ensureMap() {
    revealCoordinateOutput();
    mapPicker.hidden = false;
    setStatus(getStatusText('prompt', 'Click a point on the map to write coordinates.'));

    if (!window.L) {
      setStatus(getStatusText('loading', 'Loading the map...'));
      return;
    }

    if (!map) {
      map = window.L.map(mapCanvas).setView([35.8617, 104.1954], 4);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      map.on('click', (event) => {
        setCoordinates(event.latlng.lat, event.latlng.lng, true);
      });
    }

    const parsedCoordinates = parseCoordinates(coordinatesInput.value);
    if (parsedCoordinates) {
      updateMarker(parsedCoordinates.latitude, parsedCoordinates.longitude);
    }

    setTimeout(() => map.invalidateSize(), 0);
  }

  openMapButton.addEventListener('click', ensureMap);

  currentLocationButton.addEventListener('click', () => {
    revealCoordinateOutput();

    if (!navigator.geolocation) {
      setStatus(getStatusText('unavailable', 'This browser does not support geolocation.'));
      return;
    }

    setStatus(getStatusText('loading', 'Loading the map...'));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const shouldUpdateMap = !mapPicker.hidden;
        setCoordinates(position.coords.latitude, position.coords.longitude, shouldUpdateMap);
      },
      () => {
        setStatus(getStatusText('failed', 'Unable to get the current location. Check browser location permission.'));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000,
      },
    );
  });

  coordinatesInput.addEventListener('change', () => {
    const parsedCoordinates = parseCoordinates(coordinatesInput.value);
    if (parsedCoordinates && !mapPicker.hidden) {
      updateMarker(parsedCoordinates.latitude, parsedCoordinates.longitude);
      setStatus(getStatusText('selected', 'Coordinates recorded.'));
    }
  });
}

function syncQuestionnaireMediaUpload() {
  const panel = document.getElementById('questionnaire-media-panel');
  if (!panel) return;

  const form = panel.closest('form');
  const fileInput = document.getElementById('questionnaire-media-file');
  const tagInput = document.getElementById('questionnaire-media-tags');
  const status = document.getElementById('questionnaire-media-status');
  const mediaPicker = window.createSchoolMediaPicker('questionnaire-media');
  let mediaSubmittedWithForm = false;

  function setStatus(message, isError) {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'ok';
    status.hidden = false;
  }

  function setFileStatus(index, message, isError) {
    mediaPicker.setFileStatus(index, message, isError);
  }

  function selectedText(selectId) {
    const select = document.getElementById(selectId);
    if (!select || !select.options || select.selectedIndex < 0) return '';
    const option = select.options[select.selectedIndex];
    return option ? option.textContent.trim() : '';
  }

  function parseTags() {
    return tagInput && tagInput.value
      ? tagInput.value.split(',').map((item) => item.trim()).filter(Boolean)
      : [];
  }

  if (!form || !fileInput) return;

  async function uploadFile(file, index, metadata) {
    setFileStatus(index, '正在上传到后端', false);
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('city', metadata.city);
    body.append('county', metadata.county);
    body.append('province', metadata.province);
    body.append('schoolAddress', metadata.schoolAddress);
    body.append('schoolName', metadata.schoolName);
    body.append('tags', JSON.stringify(metadata.tags));

    const response = await fetch('/api/media/uploads/direct', {
      method: 'POST',
      body,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || '上传失败。');
    }
    setFileStatus(index, '已提交审核：' + payload.media.status, false);
    return payload.media;
  }

  form.addEventListener('submit', async (event) => {
    if (mediaSubmittedWithForm || event.defaultPrevented) return;

    const files = mediaPicker.getFiles();
    if (files.length === 0) return;

    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const schoolNameInput = document.querySelector('input[name="school_name"]');
    const addressInput = document.querySelector('input[name="school_address"]');
    const schoolName = schoolNameInput ? schoolNameInput.value.trim() : '';
    const submitter = event.submitter && event.submitter instanceof HTMLElement
      ? event.submitter
      : null;
    const submitButtons = Array.from(form.querySelectorAll('button[type="submit"]'));

    if (!schoolName) {
      setStatus('请先填写机构名称。', true);
      return;
    }
    if (files.length === 0) {
      setStatus('请选择媒体文件。', true);
      return;
    }

    const metadata = {
      city: selectedText('report-area-city'),
      county: selectedText('report-area-county'),
      province: selectedText('report-area-province'),
      schoolAddress: addressInput ? addressInput.value.trim() : '',
      schoolName,
      tags: parseTags(),
    };

    let succeeded = 0;
    let failed = 0;
    submitButtons.forEach((button) => {
      button.disabled = true;
    });
    try {
      for (const [index, file] of files.entries()) {
        try {
          await uploadFile(file, index, metadata);
          succeeded += 1;
        } catch (error) {
          failed += 1;
          setFileStatus(index, error instanceof Error ? error.message : '上传失败', true);
        }
        setStatus('上传进度：' + succeeded + ' 成功，' + failed + ' 失败，合计 ' + files.length + ' 个。', failed > 0);
      }

      if (failed === 0) {
        mediaSubmittedWithForm = true;
        mediaPicker.clear();
        if (tagInput) tagInput.value = '';
        setStatus('媒体已提交审核，正在提交问卷。', false);
        submitButtons.forEach((button) => {
          button.disabled = false;
        });
        if (typeof form.requestSubmit === 'function') {
          if (submitter) {
            form.requestSubmit(submitter);
          } else {
            form.requestSubmit();
          }
        } else {
          form.submit();
        }
        return;
      }
      setStatus('上传完成：' + succeeded + ' 成功，' + failed + ' 失败。', failed > 0);
    } finally {
      if (!mediaSubmittedWithForm) {
        submitButtons.forEach((button) => {
          button.disabled = false;
        });
      }
    }
  });
}

syncAreaSelectors('report-area', {
  city: document.body.dataset.cityPlaceholder || '',
  county: document.body.dataset.countyPlaceholder || '',
});
syncAreaSelectors('pre-institution-area', {
  city: document.body.dataset.preInstitutionCityPlaceholder || '',
  county: '',
});
syncConditionalVisibility();
syncEnhancedValidation();
syncDateValidation();
syncLocationPicker();
syncQuestionnaireMediaUpload();
`;
}

const AREA_SCRIPT = buildAreaScript();

const HtmlDocument: FC<{
  children: unknown;
  cityPlaceholder: string;
  countyPlaceholder: string;
  description: string;
  includeMapAssets?: boolean;
  lang: SupportedLanguage;
  preInstitutionCityPlaceholder?: string;
  title: string;
}> = ({
  children,
  cityPlaceholder,
  countyPlaceholder,
  description,
  includeMapAssets = false,
  lang,
  preInstitutionCityPlaceholder = '',
  title,
}) => {
  return (
    <html lang={lang}>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content={description} name="description" />
        <meta content="noindex, nofollow" name="robots" />
        <title>{title}</title>
        {includeMapAssets ? (
          <link href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" rel="stylesheet" />
        ) : null}
        <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
        {includeMapAssets ? (
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" />
        ) : null}
      </head>
      <body
        data-city-placeholder={cityPlaceholder}
        data-county-placeholder={countyPlaceholder}
        data-pre-institution-city-placeholder={preInstitutionCityPlaceholder}
      >
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
      includeMapAssets
      lang={lang}
      preInstitutionCityPlaceholder={texts.placeholderPreInstitutionCity}
      title={`${texts.pageFormTitle} | NCT API SQL Sub`}
    >
      <main className="page-shell">
        <LanguagePicker lang={lang} texts={texts} />

        <section className="hero hero--form">
          <h1>{texts.pageFormTitle}</h1>
          <p>{texts.helperFormIntro}</p>
        </section>

        <section className="panel">
          <form action={buildFormHref(lang)} method="post">
            <div className="honeypot" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input autoComplete="off" id="website" name="website" spellCheck="false" tabIndex={-1} type="text" />
            </div>

            <input name="form_token" type="hidden" value={token} />
            <input name="lang" type="hidden" value={lang} />
            <input name="standalone_enhancements" type="hidden" value="true" />

            <div className="form-grid">
              <h2 className="form-section-title">{texts.fieldBasicSection}</h2>

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

              <div className="field field--full" hidden id="relationship-field">
                <span className="field__label">{texts.fieldRelationship}</span>
                <div className="inline-grid">
                  <select defaultValue="" id="agent-relationship" name="agent_relationship">
                    <option value="">{texts.placeholderRelationship}</option>
                    {AGENT_RELATIONSHIP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {getOptionLabel(option, texts, lang)}
                      </option>
                    ))}
                  </select>
                  <div hidden id="relationship-other-field">
                    <input id="agent-relationship-other" maxLength={30} name="agent_relationship_other" placeholder={texts.placeholderRelationshipOther} type="text" />
                  </div>
                </div>
              </div>

              <div className="field">
                <span
                  className="field__label"
                  data-agent-label={texts.fieldVictimBirthYear}
                  data-self-label={texts.fieldBirthYear}
                  id="birth-year-label"
                >
                  {texts.fieldBirthYear}
                </span>
                <select defaultValue="" id="birth-year" name="birth_year" required>
                  <option value="">{texts.placeholderBirthYear}</option>
                  {BIRTH_YEAR_OPTIONS.map((year) => (
                    <option key={year} value={String(year)}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span
                  className="field__label"
                  data-agent-label={texts.fieldVictimSex}
                  data-self-label={texts.fieldSex}
                  id="sex-label"
                >
                  {texts.fieldSex}
                </span>
                <select defaultValue="" id="sex" name="sex" required>
                  <option value="">{texts.placeholderSex}</option>
                  {SEX_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {getOptionLabel(option, texts, lang)}
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
                        {getOptionLabel(option, texts, lang)}
                      </option>
                    ))}
                  </select>
                  <div hidden id="sex-other-text-field">
                    <input id="sex-other-text" maxLength={30} name="sex_other" placeholder={texts.placeholderSexCustomText} type="text" />
                  </div>
                </div>
              </div>

              <h2
                className="form-section-title"
                data-agent-label={texts.fieldVictimExperienceSection}
                data-self-label={texts.fieldExperienceSection}
                id="experience-section-title"
              >
                {texts.fieldExperienceSection}
              </h2>

              <div className="field">
                <span className="field__label">{texts.fieldPreInstitutionProvince}</span>
                <select defaultValue="" id="pre-institution-area-province" name="pre_institution_province_code">
                  <option value="">{texts.placeholderPreInstitutionProvince}</option>
                  {AREA_PAYLOAD.provinces.map((province) => (
                    <option key={province.code} value={province.code}>{province.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldPreInstitutionCity}</span>
                <select data-selected-value="" defaultValue="" id="pre-institution-area-city" name="pre_institution_city_code" />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldDateStart}</span>
                <input
                  data-date-validation-message={texts.validationDateFormat}
                  id="date-start"
                  max="9999-12-31"
                  min="0001-01-01"
                  name="date_start"
                  required
                  type="date"
                />
                <p className="field-note">{texts.hintDateStart}</p>
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldDateEnd}</span>
                <input
                  data-date-validation-message={texts.validationDateFormat}
                  id="date-end"
                  max="9999-12-31"
                  min="0001-01-01"
                  name="date_end"
                  type="date"
                />
                <p className="field-note">{texts.hintDateEnd}</p>
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldParentMotivations}</span>
                <div className="choice-grid" id="parent-motivation-group">
                  {PARENT_MOTIVATION_OPTIONS.map((option, index) => (
                    <label className="choice-option" htmlFor={`parent-motivation-${index}`} key={option.value}>
                      <input
                        data-validation-message={index === 0 ? texts.validationParentMotivations : undefined}
                        id={`parent-motivation-${index}`}
                        name="parent_motivations"
                        type="checkbox"
                        value={option.value}
                      />
                      <span>{getOptionLabel(option, texts, lang)}</span>
                    </label>
                  ))}
                </div>
                <div hidden id="parent-motivation-other-field">
                  <input
                    data-required-when-shown="true"
                    id="parent-motivation-other"
                    maxLength={120}
                    name="parent_motivation_other"
                    placeholder={texts.placeholderParentMotivationOther}
                    type="text"
                  />
                </div>
              </div>

              <div className="field field--full" hidden id="exit-method-field">
                <span className="field__label">{texts.fieldExitMethod}</span>
                <div className="inline-grid">
                  <select defaultValue="" disabled id="exit-method" name="exit_method">
                    <option value="">{texts.placeholderExitMethod}</option>
                    {EXIT_METHOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {getOptionLabel(option, texts, lang)}
                      </option>
                    ))}
                  </select>
                  <div hidden id="exit-method-other-field">
                    <input
                      data-required-when-shown="true"
                      id="exit-method-other"
                      maxLength={120}
                      name="exit_method_other"
                      placeholder={texts.placeholderExitMethodOther}
                      type="text"
                    />
                  </div>
                </div>
              </div>

              <div className="field field--full" id="school-awareness-before-entry-field">
                <span className="field__label">{texts.fieldSchoolAwarenessBeforeEntry}</span>
                <textarea maxLength={1000} name="school_awareness_before_entry" placeholder={texts.placeholderSchoolAwarenessBeforeEntry} />
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldExperience}</span>
                <textarea maxLength={8000} name="experience" placeholder={texts.placeholderExperience} />
                <p className="field-note">{texts.hintExperience}</p>
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldLegalAidStatus}</span>
                <div className="inline-grid">
                  <select defaultValue="" id="legal-aid-status" name="legal_aid_status">
                    <option value="">{texts.placeholderLegalAidStatus}</option>
                    {LEGAL_AID_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {getOptionLabel(option, texts, lang)}
                      </option>
                    ))}
                  </select>
                  <div hidden id="legal-aid-other-field">
                    <input
                      data-required-when-shown="true"
                      id="legal-aid-other"
                      maxLength={120}
                      name="legal_aid_other"
                      placeholder={texts.placeholderLegalAidOther}
                      type="text"
                    />
                  </div>
                </div>
              </div>

              <h2 className="form-section-title">{texts.fieldExposureSection}</h2>

              <div className="field field--full">
                <span className="field__label">{texts.fieldSchoolName}</span>
                <input maxLength={20} name="school_name" placeholder={texts.placeholderSchoolName} required type="text" />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldProvince}</span>
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

              <div className="field field--full">
                <span className="field__label">{texts.fieldCoordinates}</span>
                <div className="location-actions">
                  <button className="button button--secondary" id="open-map-picker" type="button">
                    {texts.actionOpenMapPicker}
                  </button>
                  <button className="button button--secondary" id="use-current-location" type="button">
                    {texts.actionUseCurrentLocation}
                  </button>
                </div>
                <div className="map-picker" hidden id="map-picker">
                  <div aria-label={texts.fieldCoordinates} className="map-picker__canvas" id="map-picker-canvas" />
                </div>
                <input
                  hidden
                  id="school-coordinates"
                  maxLength={64}
                  name="school_coordinates"
                  placeholder={texts.placeholderCoordinates}
                  type="text"
                />
                <p
                  className="field-note"
                  data-failed={texts.statusLocationFailed}
                  data-loading={texts.statusMapLoading}
                  data-prompt={texts.statusMapPrompt}
                  data-selected={texts.statusLocationSelected}
                  data-unavailable={texts.statusLocationUnavailable}
                  hidden
                  id="map-picker-status"
                >
                  {texts.helperCoordinates}
                </p>
              </div>

              <div className="field field--full" id="questionnaire-media-panel">
                <h2 className="form-section-title">{texts.fieldMediaSection}</h2>
                <p className="field-note">{texts.helperMediaUpload}</p>
                <div className="inline-grid">
                  <div className="media-picker-field">
                    <span className="field__label">{texts.fieldMediaFile}</span>
                    <button className="media-picker-open-button" id="questionnaire-media-picker-open" type="button">
                      选择图片 / 视频
                    </button>
                    <p className="media-selected-summary" id="questionnaire-media-selected-summary">未选择媒体文件。</p>
                  </div>
                  <label>
                    <span className="field__label">{texts.fieldMediaTags}</span>
                    <input
                      id="questionnaire-media-tags"
                      maxLength={240}
                      placeholder="r18, 校门, 宿舍"
                      type="text"
                    />
                  </label>
                </div>
                <div className="media-preview-grid" hidden id="questionnaire-media-preview-list" />
                <p className="field-note" hidden id="questionnaire-media-status" />
                <div className="media-picker-modal" hidden id="questionnaire-media-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="questionnaire-media-picker-title">
                  <div className="media-picker-backdrop" data-media-picker-close="true" />
                  <section className="media-picker-panel">
                    <div className="media-picker-header">
                      <h2 id="questionnaire-media-picker-title">选择学校媒体</h2>
                      <button aria-label="关闭" className="media-picker-close" id="questionnaire-media-picker-close" type="button">×</button>
                    </div>
                    <div className="media-picker-body">
                      <div className="media-picker-dropzone" id="questionnaire-media-picker-dropzone">
                        <strong>拖拽图片或视频到这里</strong>
                        <p>也可以多次点击选择文件，一张一张补齐后再确认。</p>
                        <button className="media-picker-secondary" id="questionnaire-media-picker-choose" type="button">选择文件</button>
                        <input accept="image/gif,image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden id="questionnaire-media-file" multiple type="file" />
                      </div>
                      <p className="media-picker-message" id="questionnaire-media-picker-message">拖拽文件到此处，或点击选择文件。</p>
                      <div className="media-preview-grid" hidden id="questionnaire-media-picker-draft-list" />
                    </div>
                    <div className="media-picker-footer">
                      <button className="media-picker-secondary" id="questionnaire-media-picker-cancel" type="button">取消</button>
                      <button className="media-picker-confirm" id="questionnaire-media-picker-confirm" type="button">确定</button>
                    </div>
                  </section>
                </div>
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldContact}</span>
                <input maxLength={30} name="contact_information" placeholder={texts.placeholderContact} required type="text" />
              </div>

              <div className="field">
                <span className="field__label">{texts.fieldHeadmaster}</span>
                <input maxLength={10} name="headmaster_name" placeholder={texts.placeholderHeadmaster} type="text" />
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldAbuserInfo}</span>
                <textarea maxLength={600} name="abuser_info" placeholder={texts.placeholderAbuserInfo} />
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldViolenceCategories}</span>
                <div className="choice-grid" id="violence-category-group">
                  {VIOLENCE_CATEGORY_OPTIONS.map((option, index) => (
                    <label className="choice-option" htmlFor={`violence-category-${index}`} key={option.value}>
                      <input id={`violence-category-${index}`} name="violence_categories" type="checkbox" value={option.value} />
                      <span>{getOptionLabel(option, texts, lang)}</span>
                    </label>
                  ))}
                </div>
                <div hidden id="violence-category-other-field">
                  <input
                    data-required-when-shown="true"
                    id="violence-category-other"
                    maxLength={120}
                    name="violence_category_other"
                    placeholder={texts.placeholderViolenceCategoryOther}
                    type="text"
                  />
                </div>
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldScandal}</span>
                <textarea maxLength={3000} name="scandal" placeholder={texts.placeholderScandal} />
              </div>

              <div className="field field--full">
                <span className="field__label">{texts.fieldOther}</span>
                <textarea maxLength={3000} name="other" placeholder={texts.placeholderTextBlock} />
              </div>
            </div>
            <div className="actions">
              <button className="button button--primary" type="submit">{texts.actionSubmit}</button>
            </div>
          </form>
        </section>

        <p className="hotline-notice">{texts.labelHotlineNotice}</p>
      </main>

      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(AREA_PAYLOAD),
        }}
        id="area-payload"
        type="application/json"
      />
      <script dangerouslySetInnerHTML={{ __html: MEDIA_PICKER_SCRIPT }} />
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
      lang={lang}
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
            {buildSummaryItems(values, texts, lang).map(([label, value]) => (
              <div className="summary-item" key={label}>
                <strong>{label}</strong>
                <span>{formatSummaryValue(value, texts.previewEmpty, texts, lang)}</span>
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
      lang={lang}
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

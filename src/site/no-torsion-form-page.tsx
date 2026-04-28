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
  type NoTorsionMediaSummary,
} from '../lib/no-torsion-form';
import { MEDIA_PICKER_CSS, MEDIA_PICKER_SCRIPT } from './media-picker-assets';

type AreaOption = {
  code: string;
  name: string;
};

type SupportedLanguage = 'en' | 'zh-CN' | 'zh-TW';

type PageTexts = {
  actionBack: string;
  actionCancel: string;
  actionChooseFile: string;
  actionChooseMedia: string;
  actionConfirm: string;
  actionConfirmSelection: string;
  actionHome: string;
  actionOpenForm: string;
  actionOpenMapPicker: string;
  actionRemoveMedia: string;
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
  helperMediaPickerAdd: string;
  helperMediaPickerDrop: string;
  helperCoordinates: string;
  hintDateEnd: string;
  hintDateStart: string;
  hintExperience: string;
  labelHotlineNotice: string;
  labelHotlineEyebrow: string;
  labelIdentityAgent: string;
  labelIdentitySelf: string;
  labelLanguage: string;
  labelMediaPickerClose: string;
  labelMediaPickerTitle: string;
  labelMediaTypeImage: string;
  labelMediaTypeVideo: string;
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
  placeholderMediaTags: string;
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
  statusMediaAwaitingSchoolName: string;
  statusMediaAwaitingSchoolNameFile: string;
  statusMediaPickerDraftEmpty: string;
  statusMediaPickerDraftSaved: string;
  statusMediaPickerEmpty: string;
  statusMediaPickerPending: string;
  statusMediaPickerRejected: string;
  statusMediaPickerSelected: string;
  statusMediaSubmittedForReview: string;
  statusMediaUploadBlockingSubmit: string;
  statusMediaUploadComplete: string;
  statusMediaUploadFailed: string;
  statusMediaUploading: string;
  statusMediaUploadInProgress: string;
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
  homeHref?: string;
  lang: SupportedLanguage;
  token: string;
};

type PreviewPageState = {
  backHref: string;
  confirmationPayload?: string;
  confirmationToken?: string;
  formAction: string;
  lang: SupportedLanguage;
  mediaRecords?: NoTorsionMediaSummary[];
  mode: 'confirm' | 'preview';
  values: NoTorsionFormValues;
};

type ResultPageState = {
  backHref: string;
  lang: SupportedLanguage;
  result: NoTorsionConfirmResult;
  statusCode: number;
};

type DebugLink = {
  description: string;
  href: string;
  label: string;
};

type DebugPageState = {
  apiLinks: DebugLink[];
  lang: SupportedLanguage;
  pageLinks: DebugLink[];
};

const PAGE_CSS = `
:root {
  color-scheme: dark light;
  /* Mirror NCT_frontend styles.css so the embedded form matches the dark
     glass chrome of the host site. */
  --bg: #070a18;
  --bg-soft: #111a32;
  --card: rgba(12, 20, 43, 0.5);
  --card-strong: rgba(18, 29, 58, 0.68);
  --surface: rgba(12, 20, 43, 0.5);
  --surface-strong: rgba(18, 29, 58, 0.68);
  --border: rgba(231, 241, 255, 0.2);
  --border-strong: rgba(255, 255, 255, 0.42);
  --text: #f2f7ff;
  --text-muted: rgba(226, 235, 249, 0.74);
  --text-faint: rgba(226, 235, 249, 0.52);
  --muted: rgba(226, 235, 249, 0.74);

  --pride-1: #e63a3a;
  --pride-2: #f29438;
  --pride-3: #f7c94e;
  --pride-4: #2da26b;
  --pride-5: #2f6fea;
  --pride-6: #8a4fcc;
  --trans-blue: #5fc3f0;
  --trans-pink: #ffb1cc;
  --accent-gradient: linear-gradient(
    90deg,
    var(--pride-1) 0%,
    var(--pride-2) 20%,
    var(--pride-3) 40%,
    var(--pride-4) 60%,
    var(--pride-5) 80%,
    var(--pride-6) 100%
  );
  --accent-gradient-soft: linear-gradient(
    135deg,
    rgba(118, 195, 255, 0.94),
    rgba(255, 149, 210, 0.78)
  );

  --accent: #6da6ff;
  --accent-strong: #2f6fea;
  --accent-soft: rgba(115, 189, 255, 0.18);
  --accent-secondary: var(--trans-pink);
  --danger: #ff7aa6;
  --danger-strong: #c93b73;
  --danger-soft: rgba(201, 59, 115, 0.18);
  --success: #34d8a6;
  --success-strong: #15a37b;
  --success-soft: rgba(21, 163, 123, 0.18);
  --warning: #f29438;

  --shadow: 0 28px 90px rgba(0, 0, 0, 0.46);
  --shadow-soft: 0 18px 52px rgba(0, 0, 0, 0.34);
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
    radial-gradient(ellipse at 50% 112%, rgba(104, 159, 255, 0.18), transparent 48%),
    linear-gradient(180deg, #050716 0%, #0a0f29 48%, #170b25 100%);
  font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
}

body::before {
  content: "";
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(118deg, transparent 18%, rgba(114, 161, 255, 0.12) 37%, rgba(255, 151, 213, 0.1) 50%, rgba(134, 238, 255, 0.1) 63%, transparent 82%);
  filter: blur(10px);
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
  position: relative;
  z-index: 1;
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
  border: 1px solid var(--border);
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.055)),
    var(--card);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(26px) saturate(170%);
  -webkit-backdrop-filter: blur(26px) saturate(170%);
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
  background: rgba(255, 255, 255, 0.08);
}

.standalone-language-picker__option.is-active {
  color: #051121;
  background: var(--accent-gradient-soft);
}

.hero,
.panel,
.hotline-notice,
.status-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.055)),
    linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 42%),
    var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
}

.hero {
  display: grid;
  gap: 14px;
  justify-items: start;
  padding: 28px;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(125deg, rgba(255, 255, 255, 0.16), transparent 32%),
    linear-gradient(305deg, rgba(255, 255, 255, 0.06), transparent 42%);
  opacity: 0.9;
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
  position: relative;
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
  position: relative;
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
  border-top: 1px solid var(--border);
  color: var(--text);
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
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(7, 12, 28, 0.45);
  color: var(--text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(115, 189, 255, 0.22);
}

.field input::placeholder,
.field textarea::placeholder {
  color: var(--text-faint);
}

.field select option {
  color: #0b1730;
  background: #f6f9ff;
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
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.045);
}

.media-preview-frame {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(7, 12, 28, 0.55);
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

.media-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.media-progress progress {
  flex: 1;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  appearance: none;
  -webkit-appearance: none;
  background: rgba(0, 0, 0, 0.08);
}

.media-progress progress::-webkit-progress-bar {
  background: rgba(0, 0, 0, 0.08);
  border-radius: 999px;
}

.media-progress progress::-webkit-progress-value {
  background: linear-gradient(90deg, #4f8cff, #6f5cff);
  border-radius: 999px;
}

.media-progress progress::-moz-progress-bar {
  background: linear-gradient(90deg, #4f8cff, #6f5cff);
  border-radius: 999px;
}

.media-progress__label {
  font-variant-numeric: tabular-nums;
  font-size: 0.95rem;
  min-width: 4ch;
  text-align: right;
}

.media-summary {
  margin-top: 18px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(79, 140, 255, 0.06);
}

.media-summary__title {
  margin: 0 0 8px;
  font-size: 1rem;
}

.media-summary__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.media-summary__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.media-summary__item strong {
  word-break: break-all;
}

.media-summary__link {
  font-size: 0.85rem;
  word-break: break-all;
}

.choice-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 48px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
  line-height: 1.45;
}

.choice-option:hover {
  border-color: var(--border-strong);
  background: rgba(255, 255, 255, 0.07);
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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  color: var(--text);
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
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.actions__form {
  display: inline-flex;
  margin: 0;
}

.hotline-notice {
  display: grid;
  gap: 10px;
  margin: 20px 0 0;
  padding: 18px 20px;
  color: var(--text);
  line-height: 1.7;
}

.hotline-notice__label {
  display: inline-flex;
  align-items: center;
  width: max-content;
  max-width: 100%;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.hotline-notice__body {
  margin: 0;
  font-weight: 600;
  color: var(--muted);
}

.button {
  -webkit-appearance: none;
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3.25rem;
  min-width: 8.5rem;
  padding: 14px 20px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
  backdrop-filter: blur(20px) saturate(170%);
  -webkit-backdrop-filter: blur(20px) saturate(170%);
  box-shadow: var(--shadow-soft);
}

.button:focus {
  outline: none;
}

.button:focus-visible {
  outline: 3px solid rgba(13, 107, 111, 0.28);
  outline-offset: 3px;
}

.button--primary {
  background: var(--accent-gradient-soft);
  border-color: var(--border-strong);
  box-shadow: 0 14px 34px rgba(80, 115, 204, 0.24);
  color: #0b1730;
}

.button--secondary {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(255, 255, 255, 0.32));
  border-color: var(--border);
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
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.34);
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
  display: block;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.3);
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
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0.24)),
    var(--success-soft);
}

.status-card--failure {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0.24)),
    var(--danger-soft);
}

.status-card h3 {
  margin: 0 0 8px;
  font-size: 1rem;
}

  .status-card p {
    margin: 0;
    line-height: 1.6;
  }

@media (prefers-color-scheme: light) {
  /* Mirrors the NCT_frontend light-mode block so the embedded JSX form
     follows the OS theme together with the host page. */
  :root {
    --bg: #f8fbff;
    --bg-soft: #f0f5ff;
    --card: rgba(255, 255, 255, 0.58);
    --card-strong: rgba(255, 255, 255, 0.78);
    --surface: rgba(255, 255, 255, 0.58);
    --surface-strong: rgba(255, 255, 255, 0.78);
    --border: rgba(82, 109, 164, 0.22);
    --border-strong: rgba(255, 255, 255, 0.62);
    --text: #172a47;
    --text-muted: rgba(23, 42, 71, 0.74);
    --text-faint: rgba(23, 42, 71, 0.52);
    --muted: rgba(23, 42, 71, 0.74);
    --accent: #256de8;
    --accent-strong: #174fb8;
    --accent-soft: rgba(37, 109, 232, 0.12);
    --accent-secondary: #cf4b8f;
    --danger: #c93b73;
    --danger-strong: #9f2d57;
    --danger-soft: rgba(201, 59, 115, 0.12);
    --success: #15a37b;
    --success-strong: #0c7a62;
    --success-soft: rgba(21, 163, 123, 0.14);
    --shadow: 0 28px 70px rgba(102, 117, 176, 0.19);
    --shadow-soft: 0 18px 42px rgba(102, 117, 176, 0.14);
  }

  body {
    background:
      linear-gradient(115deg, rgba(214, 237, 255, 0.98) 0%, rgba(231, 225, 255, 0.92) 45%, rgba(255, 218, 238, 0.98) 100%);
  }

  body::before {
    background:
      linear-gradient(130deg, rgba(255, 255, 255, 0.38), transparent 36%),
      linear-gradient(315deg, rgba(255, 255, 255, 0.26), transparent 44%);
    filter: blur(8px);
  }

  .hero,
  .panel,
  .hotline-notice,
  .status-card {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.38)),
      linear-gradient(135deg, rgba(255, 255, 255, 0.32), transparent 42%),
      var(--card);
  }

  .standalone-language-picker {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.52)),
      rgba(237, 244, 255, 0.86);
  }

  .standalone-language-picker__option:hover {
    background: rgba(45, 84, 132, 0.06);
  }

  .standalone-language-picker__option.is-active {
    color: #041527;
    background: linear-gradient(135deg, rgba(115, 185, 255, 0.94), rgba(255, 155, 210, 0.78));
  }

  .field input,
  .field select,
  .field textarea {
    border-color: rgba(45, 84, 132, 0.14);
    background: rgba(255, 255, 255, 0.66);
    color: var(--text);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }

  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(37, 109, 232, 0.18);
  }

  .field input::placeholder,
  .field textarea::placeholder {
    color: var(--text-faint);
  }

  .field select option {
    color: var(--text);
    background: #ffffff;
  }

  .choice-option,
  .summary-item,
  .choice-pill,
  .button--secondary {
    border-color: rgba(45, 84, 132, 0.14);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.42)),
      rgba(255, 255, 255, 0.28);
    color: var(--text);
  }

  .choice-option:hover {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.55)),
      rgba(255, 255, 255, 0.34);
  }

  .button--primary {
    color: #041527;
    background: linear-gradient(135deg, rgba(115, 185, 255, 0.94), rgba(255, 155, 210, 0.78));
    box-shadow: 0 14px 34px rgba(80, 115, 204, 0.18);
  }

  .form-section-title {
    border-top-color: rgba(45, 84, 132, 0.14);
  }

  .media-preview-card {
    background: rgba(255, 255, 255, 0.7);
  }

  .media-preview-frame {
    background: rgba(22, 32, 51, 0.08);
  }

  .map-picker__canvas {
    background: rgba(255, 255, 255, 0.7);
  }
}

@media (max-width: 760px) {
  .page-shell {
    width: min(100%, calc(100% - 20px));
    padding-top: 18px;
  }

  .hero,
  .panel,
  .hotline-notice {
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

  .actions {
    align-items: stretch;
    flex-direction: column;
  }

  .actions__form,
  .actions .button {
    width: 100%;
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
    actionCancel: '取消',
    actionChooseFile: '选择文件',
    actionChooseMedia: '选择图片 / 视频',
    actionConfirm: '确认提交',
    actionConfirmSelection: '确定',
    actionHome: '返回主页',
    actionOpenForm: '打开填写页',
    actionOpenMapPicker: '点击可直接在地图上选点',
    actionRemoveMedia: '移除',
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
    fieldCoordinates: '坐标（纬度, 经度）',
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
    helperCoordinates: '坐标格式为“纬度, 经度”。地图选点或定位会自动填入，也可以手动修改。',
    helperFormIntro: '隐私说明：本问卷中填写的出生年份、性别等个人基本信息将被严格保密，相关经历、机构曝光信息未来可能公开展示，请勿在可能公开的字段中填写身份证号、私人电话、家庭住址等您的个人敏感信息。 填写过程中如感不适可随时停止',
    helperMediaUpload: '媒体按学校分类，不绑定具体受害者记录。选好后随问卷一起提交；如为 R18 内容请添加 r18 标签。',
    helperMediaPickerAdd: '也可以多次点击选择文件，一张一张补齐后再确认。',
    helperMediaPickerDrop: '拖拽图片或视频到这里',
    hintDateEnd: '若目前仍在校，可不填',
    hintDateStart: '假如有多次被送入经历，可在经历描述中说明情况',
    hintExperience: '若描述别人经历请在“其它补充”中填写',
    labelHotlineEyebrow: '紧急援助',
    labelHotlineNotice: '全国统一心理援助：12356；青少年心理咨询和法律援助：12355；希望热线（全国性24小时心理危机干预）：400-161-9995',
    labelIdentityAgent: '受害者的代理人',
    labelIdentitySelf: '受害者本人',
    labelLanguage: '语言',
    labelMediaPickerClose: '关闭',
    labelMediaPickerTitle: '选择学校媒体',
    labelMediaTypeImage: '图片',
    labelMediaTypeVideo: '视频',
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
    placeholderCoordinates: '纬度, 经度，例如：39.904200, 116.407400',
    placeholderCounty: '可选：请先选择城市',
    placeholderExperience: '请描述个人在校经历、管理方式等...',
    placeholderExitMethod: '可选：请选择离开机构的方式',
    placeholderExitMethodOther: '其它方式：请填写具体情况',
    placeholderHeadmaster: '姓名',
    placeholderLegalAidOther: '其它：请填写补充说明',
    placeholderLegalAidStatus: '可选：请选择当前情况',
    placeholderParentMotivationOther: '其它原因：请填写具体原因',
    placeholderMediaTags: 'r18, 校门, 宿舍',
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
    statusMediaAwaitingSchoolName: '请先填写机构名称，已选择的媒体会在填写后自动上传。',
    statusMediaAwaitingSchoolNameFile: '请先填写机构名称，填写后会自动上传',
    statusMediaPickerDraftEmpty: '拖拽文件到此处，或点击选择文件。',
    statusMediaPickerDraftSaved: '已暂存 {count} 个文件，确认后写入上传列表。',
    statusMediaPickerEmpty: '未选择媒体文件。',
    statusMediaPickerPending: '待上传',
    statusMediaPickerRejected: '已忽略 {count} 个不支持的文件。',
    statusMediaPickerSelected: '已选择 {count} 个媒体文件，可继续添加或删除。',
    statusMediaSubmittedForReview: '已提交审核：{status}',
    statusMediaUploadBlockingSubmit: '媒体上传仍在进行中，问卷将在所有文件上传完成后自动提交。',
    statusMediaUploadComplete: '媒体上传完成：{count} 个文件已提交审核。',
    statusMediaUploadFailed: '上传失败。',
    statusMediaUploading: '正在上传',
    statusMediaUploadInProgress: '上传中：{done} / {total}',
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
    actionCancel: '取消',
    actionChooseFile: '選擇檔案',
    actionChooseMedia: '選擇圖片 / 影片',
    actionConfirm: '確認送出',
    actionConfirmSelection: '確定',
    actionHome: '返回主頁',
    actionOpenForm: '開啟填寫頁',
    actionOpenMapPicker: '點擊可直接在地圖上選點',
    actionRemoveMedia: '移除',
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
    fieldCoordinates: '座標（緯度, 經度）',
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
    helperCoordinates: '座標格式為「緯度, 經度」。地圖選點或定位會自動填入，也可以手動修改。',
    helperFormIntro: '隱私說明：本問卷中填寫的出生年份、性別等個人基本資訊將被嚴格保密，相關經歷、機構曝光資訊未來可能公開展示，請勿在可能公開的欄位中填寫身分證號、私人電話、家庭住址等您的個人敏感資訊。 填寫過程中如感不適可隨時停止',
    helperMediaUpload: '媒體按學校分類，不綁定具體受害者記錄。選好後隨問卷一起提交；如為 R18 內容請加入 r18 標籤。',
    helperMediaPickerAdd: '也可以多次點擊選擇檔案，一個一個補齊後再確認。',
    helperMediaPickerDrop: '拖曳圖片或影片到這裡',
    hintDateEnd: '若目前仍在校，可不填',
    hintDateStart: '假如有多次被送入經歷，可在經歷描述中說明情況',
    hintExperience: '若描述別人經歷請在「其它補充」中填寫',
    labelHotlineEyebrow: '緊急援助',
    labelHotlineNotice: '全國統一心理援助：12356；青少年心理諮詢和法律援助：12355；希望熱線（全國性24小時心理危機干預）：400-161-9995',
    labelIdentityAgent: '受害者的代理人',
    labelIdentitySelf: '受害者本人',
    labelLanguage: '語言',
    labelMediaPickerClose: '關閉',
    labelMediaPickerTitle: '選擇學校媒體',
    labelMediaTypeImage: '圖片',
    labelMediaTypeVideo: '影片',
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
    placeholderCoordinates: '緯度, 經度，例如：39.904200, 116.407400',
    placeholderCounty: '可選：請先選擇城市',
    placeholderExperience: '請描述個人在校經歷、管理方式等...',
    placeholderExitMethod: '可選：請選擇離開機構的方式',
    placeholderExitMethodOther: '其它方式：請填寫具體情況',
    placeholderHeadmaster: '姓名',
    placeholderLegalAidOther: '其它：請填寫補充說明',
    placeholderLegalAidStatus: '可選：請選擇目前情況',
    placeholderParentMotivationOther: '其它原因：請填寫具體原因',
    placeholderMediaTags: 'r18, 校門, 宿舍',
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
    statusMediaAwaitingSchoolName: '請先填寫機構名稱，已選擇的媒體會在填寫後自動上傳。',
    statusMediaAwaitingSchoolNameFile: '請先填寫機構名稱，填寫後會自動上傳',
    statusMediaPickerDraftEmpty: '拖曳檔案到此處，或點擊選擇檔案。',
    statusMediaPickerDraftSaved: '已暫存 {count} 個檔案，確認後寫入上傳清單。',
    statusMediaPickerEmpty: '未選擇媒體檔案。',
    statusMediaPickerPending: '待上傳',
    statusMediaPickerRejected: '已忽略 {count} 個不支援的檔案。',
    statusMediaPickerSelected: '已選擇 {count} 個媒體檔案，可繼續新增或移除。',
    statusMediaSubmittedForReview: '已提交審核：{status}',
    statusMediaUploadBlockingSubmit: '媒體上傳仍在進行中，問卷將在所有檔案上傳完成後自動送出。',
    statusMediaUploadComplete: '媒體上傳完成：{count} 個檔案已提交審核。',
    statusMediaUploadFailed: '上傳失敗。',
    statusMediaUploading: '正在上傳',
    statusMediaUploadInProgress: '上傳中：{done} / {total}',
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
    actionCancel: 'Cancel',
    actionChooseFile: 'Choose files',
    actionChooseMedia: 'Choose images / videos',
    actionConfirm: 'Confirm submission',
    actionConfirmSelection: 'Done',
    actionHome: 'Back to home',
    actionOpenForm: 'Open form',
    actionOpenMapPicker: 'Pick on map',
    actionRemoveMedia: 'Remove',
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
    fieldCoordinates: 'Coordinates (latitude, longitude)',
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
    helperCoordinates: 'Coordinate format is "latitude, longitude". Map selection or geolocation will fill it automatically, and you can edit it manually.',
    helperFormIntro: 'Privacy notice: Personal basic information entered in this questionnaire, such as birth year and sex/gender, will be kept strictly confidential. Related experiences and institution exposure information may be publicly displayed in the future. Please do not enter ID numbers, private phone numbers, home addresses, or other personal sensitive information in fields that may become public. You may stop at any time if you feel uncomfortable while filling it out.',
    helperMediaUpload: 'Media is grouped by school and is not linked to a specific survivor record. Selected media is submitted with the questionnaire; add the r18 tag for R18 content.',
    helperMediaPickerAdd: 'You can choose files more than once, then confirm the final list.',
    helperMediaPickerDrop: 'Drop images or videos here',
    hintDateEnd: 'Leave blank if the person is still there.',
    hintDateStart: 'If there were multiple admissions, describe them in the experience field.',
    hintExperience: 'If describing someone else, add context in Other notes.',
    labelHotlineEyebrow: 'Crisis support',
    labelHotlineNotice: 'National mental health support: 12356; youth mental health counseling and legal aid: 12355; Hope Hotline (national 24-hour psychological crisis intervention): 400-161-9995.',
    labelIdentityAgent: 'Representative of the survivor',
    labelIdentitySelf: 'Survivor',
    labelLanguage: 'Language',
    labelMediaPickerClose: 'Close',
    labelMediaPickerTitle: 'Choose school media',
    labelMediaTypeImage: 'Image',
    labelMediaTypeVideo: 'Video',
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
    placeholderCoordinates: 'Latitude, longitude. Example: 39.904200, 116.407400',
    placeholderCounty: 'Optional: select a city first',
    placeholderExperience: 'Describe the on-campus experience, management methods, and related details...',
    placeholderExitMethod: 'Optional: select how the person left',
    placeholderExitMethodOther: 'Other way: please describe',
    placeholderHeadmaster: 'Name',
    placeholderLegalAidOther: 'Other: please describe',
    placeholderLegalAidStatus: 'Optional: select current status',
    placeholderParentMotivationOther: 'Other reason: please describe',
    placeholderMediaTags: 'r18, gate, dormitory',
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
    statusMediaAwaitingSchoolName: 'Enter the institution name first. Selected media will upload automatically after that.',
    statusMediaAwaitingSchoolNameFile: 'Enter the institution name first; this will upload automatically afterward.',
    statusMediaPickerDraftEmpty: 'Drop files here, or choose files.',
    statusMediaPickerDraftSaved: '{count} file(s) staged. Confirm to add them to the upload list.',
    statusMediaPickerEmpty: 'No media selected.',
    statusMediaPickerPending: 'Waiting to upload',
    statusMediaPickerRejected: 'Ignored {count} unsupported file(s).',
    statusMediaPickerSelected: '{count} media file(s) selected. You can add or remove files.',
    statusMediaSubmittedForReview: 'Submitted for review: {status}',
    statusMediaUploadBlockingSubmit: 'Media uploads are still in progress. The questionnaire will submit automatically after all files finish.',
    statusMediaUploadComplete: 'Media upload complete: {count} file(s) submitted for review.',
    statusMediaUploadFailed: 'Upload failed.',
    statusMediaUploading: 'Uploading',
    statusMediaUploadInProgress: 'Uploading: {done} / {total}',
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

function buildFormHref(language: SupportedLanguage): string {
  return `/form?lang=${encodeURIComponent(language)}`;
}

function buildConfirmHref(language: SupportedLanguage): string {
  return `/form/confirm?lang=${encodeURIComponent(language)}`;
}

const LanguagePicker: FC<{
  buildHref?: (language: SupportedLanguage) => string;
  lang: SupportedLanguage;
  texts: PageTexts;
}> = ({ buildHref = buildFormHref, lang, texts }) => (
  <div className="standalone-toolbar" aria-label={texts.labelLanguage}>
    <span className="standalone-language-picker__label">{texts.labelLanguage}</span>
    <div className="standalone-language-picker" role="group" aria-label={texts.labelLanguage}>
      {getLanguageOptions(lang).map((option) => (
        <a
          aria-current={option.code === lang ? 'page' : undefined}
          className={`standalone-language-picker__option${option.code === lang ? ' is-active' : ''}`}
          data-standalone-language-link={option.code}
          href={buildHref(option.code)}
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
  const recordsInput = document.getElementById('questionnaire-media-records');
  const progressWrap = document.getElementById('questionnaire-media-progress-wrap');
  const progressBar = document.getElementById('questionnaire-media-progress');
  const progressLabel = document.getElementById('questionnaire-media-progress-label');
  const mediaPicker = window.createSchoolMediaPicker('questionnaire-media');
  const completedRecords = [];
  const inFlight = new Set();
  const waitingForSchoolName = [];
  let pendingSubmit = null;

  function setStatus(message, isError) {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'ok';
    status.hidden = false;
  }

  function setFileStatus(index, message, isError) {
    mediaPicker.setFileStatus(index, message, isError);
  }

  function getMediaText(name, fallback) {
    return (panel.dataset && panel.dataset[name]) || fallback;
  }

  function formatMediaText(name, fallback, values) {
    let text = getMediaText(name, fallback);
    Object.keys(values || {}).forEach((key) => {
      text = text.replace(new RegExp('\\\\{' + key + '\\\\}', 'g'), String(values[key]));
    });
    return text;
  }

  function setProgress(done, total) {
    if (!progressWrap || !progressBar || !progressLabel) return;
    if (total <= 0) {
      progressWrap.hidden = true;
      progressBar.value = 0;
      progressLabel.textContent = '0%';
      return;
    }
    const pct = Math.round((done / total) * 100);
    progressWrap.hidden = false;
    progressBar.max = 100;
    progressBar.value = pct;
    progressLabel.textContent = pct + '%';
  }

  function syncRecordsInput() {
    if (recordsInput) {
      recordsInput.value = JSON.stringify(completedRecords);
    }
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

  function getNamedField(name) {
    const named = form.elements && form.elements.namedItem ? form.elements.namedItem(name) : null;
    if (named && typeof named.value !== 'undefined') return named;
    return form.querySelector('[name="' + name + '"]');
  }

  function getFormValue(name) {
    const field = getNamedField(name);
    return field && typeof field.value !== 'undefined' ? String(field.value || '').trim() : '';
  }

  function getSchoolName() {
    return getFormValue('school_name') || getFormValue('schoolName');
  }

  function getSchoolAddress() {
    return getFormValue('school_address') || getFormValue('schoolAddress');
  }

  function queueUntilSchoolName(file, index) {
    const exists = waitingForSchoolName.some((entry) => entry.file === file && entry.index === index);
    if (!exists) {
      waitingForSchoolName.push({ file, index });
    }
    setFileStatus(
      index,
      getMediaText('statusAwaitingSchoolNameFile', 'Enter the institution name first; this will upload automatically afterward.'),
      true,
    );
    setStatus(
      getMediaText('statusAwaitingSchoolName', 'Enter the institution name first. Selected media will upload automatically after that.'),
      true,
    );
    setProgress(completedRecords.length, completedRecords.length + inFlight.size + waitingForSchoolName.length);
  }

  function flushWaitingForSchoolName() {
    if (!getSchoolName() || waitingForSchoolName.length === 0) return;
    const entries = waitingForSchoolName.splice(0);
    setProgress(completedRecords.length, completedRecords.length + inFlight.size + entries.length);
    entries.forEach((entry) => {
      startUpload(entry.file, entry.index);
    });
  }

  async function uploadFile(file, index, metadata) {
    setFileStatus(index, getMediaText('statusUploading', 'Uploading'), false);
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
      throw new Error(payload.error || getMediaText('statusUploadFailed', 'Upload failed.'));
    }
    setFileStatus(
      index,
      formatMediaText('statusSubmittedForReview', 'Submitted for review: {status}', {
        status: payload.media.status,
      }),
      false,
    );
    return payload.media;
  }

  function summarizeMedia(media, sourceFile, tags) {
    return {
      id: media.id || ('local-' + Date.now()),
      fileName: media.fileName || (sourceFile && sourceFile.name) || '',
      mediaType: media.mediaType || ((sourceFile && sourceFile.type && sourceFile.type.indexOf('video') === 0) ? 'video' : 'image'),
      contentType: media.contentType || (sourceFile && sourceFile.type) || '',
      byteSize: typeof media.byteSize === 'number' ? media.byteSize : (sourceFile ? sourceFile.size : 0),
      publicUrl: media.publicUrl || '',
      status: media.status || 'pending_review',
      isR18: Boolean(media.isR18),
      tags: Array.isArray(tags) ? tags.slice() : [],
    };
  }

  async function startUpload(file, index) {
    const schoolName = getSchoolName();
    if (!schoolName) {
      queueUntilSchoolName(file, index);
      return;
    }
    const tags = parseTags();
    const metadata = {
      city: selectedText('report-area-city'),
      county: selectedText('report-area-county'),
      province: selectedText('report-area-province'),
      schoolAddress: getSchoolAddress(),
      schoolName,
      tags,
    };
    const token = Symbol('upload-' + index);
    inFlight.add(token);
    try {
      const media = await uploadFile(file, index, metadata);
      completedRecords.push(summarizeMedia(media, file, tags));
      syncRecordsInput();
    } catch (error) {
      setFileStatus(index, error && error.message ? error.message : getMediaText('statusUploadFailed', 'Upload failed.'), true);
    } finally {
      inFlight.delete(token);
      const total = completedRecords.length + inFlight.size;
      setProgress(completedRecords.length, total);
      if (inFlight.size === 0) {
        setStatus(
          formatMediaText('statusUploadComplete', 'Media upload complete: {count} file(s) submitted for review.', {
            count: completedRecords.length,
          }),
          false,
        );
        if (pendingSubmit) {
          const submitter = pendingSubmit.submitter;
          pendingSubmit = null;
          if (typeof form.requestSubmit === 'function') {
            if (submitter) {
              form.requestSubmit(submitter);
            } else {
              form.requestSubmit();
            }
          } else {
            form.submit();
          }
        }
      } else {
        setStatus(
          formatMediaText('statusUploadInProgress', 'Uploading: {done} / {total}', {
            done: completedRecords.length,
            total,
          }),
          false,
        );
      }
    }
  }

  if (typeof mediaPicker.setOnSelectionChanged === 'function') {
    mediaPicker.setOnSelectionChanged(function (entries) {
      if (!entries || !entries.length) return;
      const total = completedRecords.length + inFlight.size + entries.length;
      setProgress(completedRecords.length, total);
      entries.forEach(function (entry) {
        startUpload(entry.file, entry.index);
      });
    });
  }

  const schoolNameField = getNamedField('school_name') || getNamedField('schoolName');
  if (schoolNameField && typeof schoolNameField.addEventListener === 'function') {
    schoolNameField.addEventListener('input', flushWaitingForSchoolName);
    schoolNameField.addEventListener('change', flushWaitingForSchoolName);
  }

  form.addEventListener('submit', (event) => {
    if (event.defaultPrevented) return;
    if (inFlight.size === 0) return;
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setStatus(
      getMediaText('statusUploadBlockingSubmit', 'Media uploads are still in progress. The questionnaire will submit automatically after all files finish.'),
      false,
    );
    pendingSubmit = {
      submitter: event.submitter && event.submitter instanceof HTMLElement ? event.submitter : null,
    };
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

const EMBED_RESIZE_SCRIPT = `
(function () {
  if (window.parent === window) return;

  function measure() {
    var doc = document.documentElement;
    var body = document.body;
    return Math.max(
      doc ? doc.scrollHeight : 0,
      doc ? doc.offsetHeight : 0,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    );
  }

  var lastHeight = 0;
  function postHeight() {
    var height = measure();
    if (Math.abs(height - lastHeight) < 2) return;
    lastHeight = height;
    try {
      window.parent.postMessage({ type: 'nct:embed-resize', height: height }, '*');
    } catch (_error) {
      /* parent rejected the message */
    }
  }

  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  if ('ResizeObserver' in window) {
    var observer = new ResizeObserver(postHeight);
    observer.observe(document.documentElement);
    observer.observe(document.body);
  }

  if ('MutationObserver' in window) {
    var mutation = new MutationObserver(postHeight);
    mutation.observe(document.body, { attributes: true, childList: true, subtree: true });
  }

  window.addEventListener('load', postHeight);
  window.addEventListener('resize', postHeight);
  window.addEventListener('transitionend', postHeight);
  document.addEventListener('readystatechange', postHeight);
  setInterval(postHeight, 1500);
  postHeight();
})();
`;

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
        <script dangerouslySetInnerHTML={{ __html: EMBED_RESIZE_SCRIPT }} />
      </body>
    </html>
  );
};

export const NoTorsionStandaloneFormPage: FC<FormPageState> = ({ lang, token }) => {
  const texts = getTexts(lang);
  const birthYearOptions = buildBirthYearOptions();

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
                  {birthYearOptions.map((year) => (
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
                  id="map-picker-status"
                >
                  {texts.helperCoordinates}
                </p>
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

              <div
                className="field field--full"
                data-status-awaiting-school-name={texts.statusMediaAwaitingSchoolName}
                data-status-awaiting-school-name-file={texts.statusMediaAwaitingSchoolNameFile}
                data-status-submitted-for-review={texts.statusMediaSubmittedForReview}
                data-status-upload-blocking-submit={texts.statusMediaUploadBlockingSubmit}
                data-status-upload-complete={texts.statusMediaUploadComplete}
                data-status-upload-failed={texts.statusMediaUploadFailed}
                data-status-upload-in-progress={texts.statusMediaUploadInProgress}
                data-status-uploading={texts.statusMediaUploading}
                id="questionnaire-media-panel"
              >
                <h2 className="form-section-title">{texts.fieldMediaSection}</h2>
                <p className="field-note">{texts.helperMediaUpload}</p>
                <div className="inline-grid">
                  <div className="media-picker-field">
                    <span className="field__label">{texts.fieldMediaFile}</span>
                    <button className="media-picker-open-button" id="questionnaire-media-picker-open" type="button">
                      {texts.actionChooseMedia}
                    </button>
                    <p className="media-selected-summary" id="questionnaire-media-selected-summary">{texts.statusMediaPickerEmpty}</p>
                  </div>
                  <label>
                    <span className="field__label">{texts.fieldMediaTags}</span>
                    <input
                      id="questionnaire-media-tags"
                      maxLength={240}
                      placeholder={texts.placeholderMediaTags}
                      type="text"
                    />
                  </label>
                </div>
                <div className="media-progress" hidden id="questionnaire-media-progress-wrap">
                  <progress id="questionnaire-media-progress" max={100} value={0} />
                  <span className="media-progress__label" id="questionnaire-media-progress-label">0%</span>
                </div>
                <div className="media-preview-grid" hidden id="questionnaire-media-preview-list" />
                <p className="field-note" hidden id="questionnaire-media-status" />
                <input id="questionnaire-media-records" name="media_records" type="hidden" value="[]" />
                <div
                  className="media-picker-modal"
                  data-draft-empty-message={texts.statusMediaPickerDraftEmpty}
                  data-draft-summary={texts.statusMediaPickerDraftSaved}
                  data-empty-summary={texts.statusMediaPickerEmpty}
                  data-pending-status={texts.statusMediaPickerPending}
                  data-rejected-message={texts.statusMediaPickerRejected}
                  data-remove-label={texts.actionRemoveMedia}
                  data-selected-summary={texts.statusMediaPickerSelected}
                  hidden
                  id="questionnaire-media-picker-dialog"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="questionnaire-media-picker-title"
                >
                  <div className="media-picker-backdrop" data-media-picker-close="true" />
                  <section className="media-picker-panel">
                    <div className="media-picker-header">
                      <h2 id="questionnaire-media-picker-title">{texts.labelMediaPickerTitle}</h2>
                      <button aria-label={texts.labelMediaPickerClose} className="media-picker-close" id="questionnaire-media-picker-close" type="button">×</button>
                    </div>
                    <div className="media-picker-body">
                      <div className="media-picker-dropzone" id="questionnaire-media-picker-dropzone">
                        <strong>{texts.helperMediaPickerDrop}</strong>
                        <p>{texts.helperMediaPickerAdd}</p>
                        <label className="media-picker-secondary media-picker-file-label" id="questionnaire-media-picker-choose">
                          {texts.actionChooseFile}
                          <input accept="image/gif,image/jpeg,image/png,image/webp,video/mp4,video/webm" className="media-picker-file-input" id="questionnaire-media-file" multiple type="file" />
                        </label>
                      </div>
                      <p className="media-picker-message" id="questionnaire-media-picker-message">{texts.statusMediaPickerDraftEmpty}</p>
                      <div className="media-preview-grid" hidden id="questionnaire-media-picker-draft-list" />
                    </div>
                    <div className="media-picker-footer">
                      <button className="media-picker-secondary" id="questionnaire-media-picker-cancel" type="button">{texts.actionCancel}</button>
                      <button className="media-picker-confirm" id="questionnaire-media-picker-confirm" type="button">{texts.actionConfirmSelection}</button>
                    </div>
                  </section>
                </div>
              </div>
            </div>
            <div className="actions">
              <button className="button button--primary" type="submit">{texts.actionSubmit}</button>
            </div>
          </form>
        </section>

        <aside className="hotline-notice" role="note" aria-label={texts.labelHotlineEyebrow}>
          <span className="hotline-notice__label">{texts.labelHotlineEyebrow}</span>
          <p className="hotline-notice__body">{texts.labelHotlineNotice}</p>
        </aside>
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

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

const MediaSummaryBlock: FC<{
  heading: string;
  items: NoTorsionMediaSummary[];
  texts: PageTexts;
}> = ({ heading, items, texts }) => {
  if (!items.length) return null;
  return (
    <div className="media-summary">
      <h3 className="media-summary__title">{heading}</h3>
      <ul className="media-summary__list">
        {items.map((item) => (
          <li className="media-summary__item" key={item.id}>
            <strong>{item.fileName}</strong>
            <span>
              {item.mediaType === 'video' ? texts.labelMediaTypeVideo : texts.labelMediaTypeImage} · {formatBytes(item.byteSize)} · {item.status}
              {item.isR18 ? ' · R18' : ''}
            </span>
            {item.publicUrl ? (
              <a className="media-summary__link" href={item.publicUrl} rel="noreferrer" target="_blank">
                {item.publicUrl}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const NoTorsionStandalonePreviewPage: FC<PreviewPageState> = ({
  backHref,
  confirmationPayload,
  confirmationToken,
  formAction,
  lang,
  mediaRecords,
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

          <MediaSummaryBlock heading={texts.fieldMediaSection} items={mediaRecords ?? []} texts={texts} />

          <div className="actions">
            <a className="button button--secondary" href={backHref}>{texts.actionBack}</a>
            {mode === 'confirm' && confirmationPayload && confirmationToken ? (
              <form action={formAction} className="actions__form" method="post">
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

          <MediaSummaryBlock heading={texts.fieldMediaSection} items={result.mediaRecords ?? []} texts={texts} />

          <div className="actions">
            <a className="button button--secondary" href={backHref}>{texts.actionBack}</a>
          </div>
        </section>
      </main>
    </HtmlDocument>
  );
};

export const NoTorsionStandaloneDebugPage: FC<DebugPageState> = ({
  apiLinks,
  lang,
  pageLinks,
}) => {
  const texts = getTexts(lang);
  const isEnglish = lang === 'en';
  const title = isEnglish ? 'Debug routes' : lang === 'zh-TW' ? '調試路由' : '调试路由';
  const intro = isEnglish
    ? 'This page is available only when DEBUG_MOD=true. Use it to open every standalone page route without submitting real data.'
    : lang === 'zh-TW'
      ? '此頁面僅在 DEBUG_MOD=true 時可用，可用來開啟所有獨立頁面路由，不會送出真實資料。'
      : '此页面仅在 DEBUG_MOD=true 时可用，可用来进入所有独立页面路由，不会提交真实数据。';
  const pageSectionTitle = isEnglish ? 'Page routes' : lang === 'zh-TW' ? '頁面路由' : '页面路由';
  const apiSectionTitle = isEnglish ? 'API routes' : 'API 路由';

  function renderLinks(links: DebugLink[]) {
    return (
      <div className="summary-list">
        {links.map((link) => (
          <a className="summary-item" href={link.href} key={link.href}>
            <strong>{link.label}</strong>
            <span>
              <code>{link.href}</code>
              {link.description ? ` ${link.description}` : ''}
            </span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <HtmlDocument
      cityPlaceholder=""
      countyPlaceholder=""
      description={intro}
      lang={lang}
      title={`${title} | NCT API SQL Sub`}
    >
      <main className="page-shell">
        <LanguagePicker
          buildHref={(nextLang) => `/debug?lang=${encodeURIComponent(nextLang)}`}
          lang={lang}
          texts={texts}
        />

        <section className="hero">
          <span className="hero__eyebrow">DEBUG</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </section>

        <section className="panel">
          <h2>{pageSectionTitle}</h2>
          {renderLinks(pageLinks)}
        </section>

        <section className="panel">
          <h2>{apiSectionTitle}</h2>
          {renderLinks(apiLinks)}
        </section>
      </main>
    </HtmlDocument>
  );
};

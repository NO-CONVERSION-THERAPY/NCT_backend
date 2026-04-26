import { renderToString } from 'hono/jsx/dom/server';
import { describe, expect, it } from 'vitest';
import type {
  NoTorsionConfirmResult,
  NoTorsionFormValues,
} from '../lib/no-torsion-form';
import {
  NoTorsionStandaloneFormPage,
  NoTorsionStandalonePreviewPage,
  NoTorsionStandaloneResultPage,
} from './no-torsion-form-page';

const baseValues: NoTorsionFormValues = {
  abuserInfo: '',
  agentRelationship: '',
  birthDate: '',
  birthDay: '',
  birthMonth: '',
  birthYear: '2000',
  city: 'Beijing',
  cityCode: '110100',
  contactInformation: 'contact@example.com',
  county: 'Dongcheng',
  countyCode: '110101',
  dateEnd: '',
  dateStart: '2024-01-01',
  exitMethod: '',
  experience: 'Detailed experience summary.',
  googleFormAge: 24,
  headmasterName: 'Headmaster',
  identity: '受害者本人',
  latitude: 39.9042,
  legalAidStatus: '',
  longitude: 116.4074,
  other: '',
  parentMotivations: [],
  preInstitutionCity: '',
  preInstitutionCityCode: '',
  preInstitutionProvince: '',
  preInstitutionProvinceCode: '',
  province: 'Beijing',
  provinceCode: '110000',
  scandal: '',
  schoolAwarenessBeforeEntry: 'I had heard some news before admission.',
  schoolAddress: '1 Example Road',
  schoolCoordinates: '39.904200, 116.407400',
  schoolName: 'Example School',
  sex: '女性',
  standaloneEnhancements: true,
  submittedFields: {},
  violenceCategories: [],
};

describe('No-Torsion standalone JSX pages', () => {
  it('renders the standalone form page with server-side Hono JSX output', () => {
    const html = renderToString(
      NoTorsionStandaloneFormPage({
        lang: 'en',
        token: 'public-form-token',
      }),
    );

    expect(html).toContain('<title>Conversion Institution Survivor Questionnaire | NCT API SQL Sub</title>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<h1>Conversion Institution Survivor Questionnaire</h1>');
    expect(html).toContain(
      'You may stop at any time if you feel uncomfortable while filling it out.',
    );
    expect(html).toContain('National mental health support: 12356');
    expect(html).toContain('data-standalone-language-link="zh-CN"');
    expect(html).toContain('data-standalone-language-link="zh-TW"');
    expect(html).toContain('data-standalone-language-link="en"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('Hono + JSX');
    expect(html).not.toContain('Only fill this in when you are submitting as a representative.');
    expect(html).toContain('public-form-token');
    expect(html).toContain('[hidden]');
    expect(html).toContain('display: none !important');
    expect(html).toContain('Before you were sent there');
    expect(html).toContain('name="school_awareness_before_entry"');
    expect(html).toContain('name="standalone_enhancements" type="hidden" value="true"');
    expect(html).toContain('Basic information');
    expect(html).toContain('name="pre_institution_province_code"');
    expect(html).toContain('name="pre_institution_city_code"');
    expect(html).toContain("if (county) county.dataset.selectedValue = ''");
    expect(html).toContain('function syncDateValidation()');
    expect(html).toContain('data-date-validation-message="Enter a valid date with a 4-digit year."');
    expect(html).toMatch(/<input[^>]*id="date-start"[^>]*max="9999-12-31"|<input[^>]*max="9999-12-31"[^>]*id="date-start"/);
    expect(html).toContain('name="parent_motivations"');
    expect(html).toContain('name="parent_motivation_other"');
    expect(html).toContain('name="exit_method"');
    expect(html).toContain('name="legal_aid_status"');
    expect(html).toContain('name="abuser_info"');
    expect(html).toContain('name="violence_categories"');
    expect(html).toContain('name="violence_category_other"');
    expect(html).toContain('class="field field--full" hidden="" id="relationship-field"');
    expect(html).toContain('<div hidden="" id="relationship-other-field">');
    expect(html).toContain('class="field field--full" hidden="" id="sex-other-field"');
    expect(html).toContain('placeholder="Please fill in"');
    expect(html).toContain('Pick on map');
    expect(html).toContain('Use current location');
    expect(html).toContain('&quot;Internet addiction&quot; / gaming');
    expect(html).toContain('Kidnapping while impersonating police');
    expect(html).toContain('Picked up by parents after the term ended');
    expect(html).toContain('name="school_coordinates"');
    expect(html).toMatch(/<input[^>]*hidden=""[^>]*id="school-coordinates"|<input[^>]*id="school-coordinates"[^>]*hidden=""/);
    expect(html).toMatch(/<p[^>]*hidden=""[^>]*id="map-picker-status"|<p[^>]*id="map-picker-status"[^>]*hidden=""/);
    expect(html).toContain('Experience');
    expect(html).toContain('Select a province first');
    expect(html).toContain('"code":"110000"');
  });

  it('renders the zh-CN form title, privacy notice, hotline note, and language picker', () => {
    const html = renderToString(
      NoTorsionStandaloneFormPage({
        lang: 'zh-CN',
        token: 'public-form-token',
      }),
    );

    expect(html).toContain('<title>扭转机构受害者情况问卷调查 | NCT API SQL Sub</title>');
    expect(html).toContain('<h1>扭转机构受害者情况问卷调查</h1>');
    expect(html).toContain(
      '隐私说明：本问卷中填写的出生年份、性别等个人基本信息将被严格保密，相关经历、机构曝光信息未来可能公开展示，请勿在可能公开的字段中填写身份证号、私人电话、家庭住址等您的个人敏感信息。 填写过程中如感不适可随时停止',
    );
    expect(html).toContain(
      '全国统一心理援助：12356；青少年心理咨询和法律援助：12355；希望热线（全国性24小时心理危机干预）：400-161-9995',
    );
    expect(html).toContain('class="standalone-language-picker__option is-active"');
    expect(html).toContain('href="/form?lang=zh-TW"');
  });

  it('renders the review page with confirmation payload fields', () => {
    const html = renderToString(
      NoTorsionStandalonePreviewPage({
        backHref: '/form?lang=en',
        confirmationPayload: 'encoded-confirmation-payload',
        confirmationToken: 'encoded-confirmation-token',
        formAction: '/form/confirm?lang=en',
        lang: 'en',
        mode: 'confirm',
        values: {
          ...baseValues,
          schoolName: 'Preview School',
        },
      }),
    );

    expect(html).toContain('Review before submission');
    expect(html).toContain('Preview School');
    expect(html).not.toContain('Relationship to the survivor');
    expect(html).toContain('encoded-confirmation-payload');
    expect(html).toContain('encoded-confirmation-token');
    expect(html).toContain('Survivor');
    expect(html).toContain('Female');
    expect(html).toContain('/form/confirm?lang=en');
  });

  it('renders representative relationship in review only for agent submissions', () => {
    const html = renderToString(
      NoTorsionStandalonePreviewPage({
        backHref: '/form?lang=en',
        confirmationPayload: 'encoded-confirmation-payload',
        confirmationToken: 'encoded-confirmation-token',
        formAction: '/form/confirm?lang=en',
        lang: 'en',
        mode: 'confirm',
        values: {
          ...baseValues,
          agentRelationship: 'Teacher',
          identity: '受害者的代理人',
        },
      }),
    );

    expect(html).toContain('Relationship to the survivor');
    expect(html).toContain('Teacher');
  });

  it('renders success and failure result cards from the JSX result page', () => {
    const result: NoTorsionConfirmResult = {
      encodedPayload: 'encoded',
      resultsByTarget: {
        d1: {
          ok: true,
          recordKey: 'no-torsion:form:d1-record',
        },
        google: {
          error: 'Upstream rejected the submission.',
          ok: false,
        },
      },
      successfulTargets: ['d1'],
    };

    const html = renderToString(
      NoTorsionStandaloneResultPage({
        backHref: '/form?lang=en',
        lang: 'en',
        result,
        statusCode: 502,
      }),
    );

    expect(html).toContain('Submission failed | NCT API SQL Sub');
    expect(html).toContain('status-card status-card--success');
    expect(html).toContain('status-card status-card--failure');
    expect(html).toContain('Upstream rejected the submission.');
    expect(html).toContain('/form?lang=en');
  });
});

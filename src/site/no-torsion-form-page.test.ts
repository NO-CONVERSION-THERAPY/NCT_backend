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
  legalAidStatus: '',
  other: '',
  parentMotivations: [],
  preInstitutionCity: '',
  preInstitutionCityCode: '',
  preInstitutionProvince: '',
  preInstitutionProvinceCode: '',
  province: 'Beijing',
  provinceCode: '110000',
  scandal: '',
  schoolAddress: '1 Example Road',
  schoolName: 'Example School',
  sex: '女性',
  standaloneEnhancements: true,
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

    expect(html).toContain('<title>Standalone submission | NCT API SQL Sub</title>');
    expect(html).toContain('Hono + JSX');
    expect(html).toContain('public-form-token');
    expect(html).toContain('Experience');
    expect(html).toContain('Select a province first');
    expect(html).toContain('"code":"110000"');
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
    expect(html).toContain('encoded-confirmation-payload');
    expect(html).toContain('encoded-confirmation-token');
    expect(html).toContain('/form/confirm?lang=en');
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

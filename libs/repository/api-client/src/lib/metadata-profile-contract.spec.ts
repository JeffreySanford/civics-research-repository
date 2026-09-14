import { readFileSync } from 'node:fs';

import type { ResearchObjectDetail } from './repository-api-client';

const generatedTypes = readFileSync(
  new URL('../generated/repository-api.types.ts', import.meta.url),
  'utf8',
);

describe('ResearchObjectDetail metadata profile contract', () => {
  it('generates the structured access and profile fields from OpenAPI', () => {
    expect(generatedTypes).toContain('ResearchAccessGuidance: {');
    expect(generatedTypes).toContain('documentationUrl?: string;');
    expect(generatedTypes).toContain('geographicLevel?: string;');
    expect(generatedTypes).toContain('subjects: string[];');
    expect(generatedTypes).toContain(
      "accessGuidance?: components['schemas']['ResearchAccessGuidance'];",
    );
  });

  it('carries structured access guidance and profile inputs', () => {
    const detail: ResearchObjectDetail = {
      id: 'lehd-microdata-restricted',
      title: 'LEHD Longitudinal Employer-Household Dynamics microdata',
      program: 'LEHD',
      publisher: 'U.S. Census Bureau',
      abstractText: 'Restricted-use LEHD research metadata.',
      geography: 'United States',
      vintageYear: 2025,
      releasedOn: '2025-01-01',
      files: [],
      citation:
        'U.S. Census Bureau. Longitudinal Employer-Household Dynamics microdata.',
      sourceUrl: 'https://www.census.gov/about/adrm/fsrdc.html',
      documentationUrl: 'https://www.census.gov/about/adrm/fsrdc.html',
      geographicLevel: 'National',
      subjects: ['LEHD', 'Restricted use', 'Title 13'],
      accessGuidance: {
        mechanism: 'FSRDC',
        accessUrl: 'https://www.census.gov/about/adrm/fsrdc.html',
        instructions:
          'Access requires an approved research proposal and Special Sworn Status.',
        restrictionBasis: 'Title 13, U.S. Code',
      },
      relatedResearch: [],
    };

    expect(detail.accessGuidance?.mechanism).toBe('FSRDC');
    expect(detail.subjects).toContain('Title 13');
    expect(detail.documentationUrl).toBe(
      'https://www.census.gov/about/adrm/fsrdc.html',
    );
    expect(detail.geographicLevel).toBe('National');
  });
});

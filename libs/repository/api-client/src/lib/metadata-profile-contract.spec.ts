import type { ResearchObjectDetail } from './repository-api-client';

describe('ResearchObjectDetail metadata profile contract', () => {
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

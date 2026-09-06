import type { CountyBusinessPatternsChoropleth } from 'repository-api-client';
import {
  buildCountyBusinessPatternsScale,
  COUNTY_BUSINESS_PATTERNS_UNAVAILABLE_COLOR,
} from './county-business-patterns-scale';

function choropleth(
  counties: CountyBusinessPatternsChoropleth['counties'],
): CountyBusinessPatternsChoropleth {
  return {
    layerId: 'county-business-patterns-north-dakota',
    source: 'U.S. Census Bureau County Business Patterns',
    sourceUrl: 'https://example.test/cbp23co.zip',
    attribution: 'U.S. Census Bureau County Business Patterns',
    geography: 'North Dakota',
    geographyLevel: 'COUNTY',
    sourceReferenceYear: 2023,
    sourceSha256: 'a'.repeat(64),
    capturedAt: '2026-09-06',
    geometryVintage: 2023,
    geometrySourceUrl: 'https://example.test/counties',
    geometryAttribution: 'U.S. Census Bureau TIGERweb',
    measure: 'ESTABLISHMENTS',
    measureLabel: 'Establishments',
    units: 'establishments',
    industryCode: 'TOTAL',
    industryLabel: 'All sectors',
    year: 2023,
    availableCountyCount: counties.filter((county) => county.available).length,
    unavailableCountyCount: counties.filter((county) => !county.available).length,
    excludedStatewideRows: 753,
    missingRowSemantics:
      'A missing county/industry row is unavailable in the published source and must not be interpreted as zero.',
    geoJson: { type: 'FeatureCollection', features: [] },
    counties,
  };
}

describe('buildCountyBusinessPatternsScale', () => {
  it('keeps unavailable data outside numeric quantiles and exposes a separate legend break', () => {
    const scale = buildCountyBusinessPatternsScale(
      choropleth([
        {
          fips: '38001',
          name: 'Adams County',
          available: true,
          value: 0,
          noiseFlag: null,
        },
        {
          fips: '38017',
          name: 'Cass County',
          available: true,
          value: 100,
          noiseFlag: null,
        },
        {
          fips: '38095',
          name: 'Towner County',
          available: false,
          value: null,
          noiseFlag: null,
        },
      ]),
    );

    expect(scale.breaks.at(-1)).toEqual({
      label: 'Unavailable in published CBP source',
      color: COUNTY_BUSINESS_PATTERNS_UNAVAILABLE_COLOR,
      unavailable: true,
    });
    expect(scale.description).toContain('not zero');
    expect(scale.fillColor).toEqual(
      expect.arrayContaining([
        'case',
        expect.anything(),
        COUNTY_BUSINESS_PATTERNS_UNAVAILABLE_COLOR,
      ]),
    );
  });

  it('treats published zero as a numeric value', () => {
    const scale = buildCountyBusinessPatternsScale(
      choropleth([
        {
          fips: '38001',
          name: 'Adams County',
          available: true,
          value: 0,
          noiseFlag: null,
        },
      ]),
    );

    expect(scale.breaks[0].label).toBe('All published counties: 0');
    expect(scale.breaks[0].unavailable).toBeUndefined();
  });

  it('uses only the unavailable treatment when no county has a published value', () => {
    const scale = buildCountyBusinessPatternsScale(
      choropleth([
        {
          fips: '38095',
          name: 'Towner County',
          available: false,
          value: null,
          noiseFlag: null,
        },
      ]),
    );

    expect(scale.fillColor).toBe(COUNTY_BUSINESS_PATTERNS_UNAVAILABLE_COLOR);
    expect(scale.breaks).toHaveLength(1);
  });
});

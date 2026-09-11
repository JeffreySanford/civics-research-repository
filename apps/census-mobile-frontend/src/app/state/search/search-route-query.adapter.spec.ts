import { convertToParamMap } from '@angular/router';
import { SearchRouteQueryAdapter } from './search-route-query.adapter';

describe('SearchRouteQueryAdapter', () => {
  const adapter = new SearchRouteQueryAdapter();

  it('hydrates a shareable search intent from supported query parameters', () => {
    const query = adapter.fromParamMap(
      convertToParamMap({
        q: ' North Dakota migration ',
        program: ['ACS', 'CPS'],
        publisher: 'U.S. Census Bureau',
        sourceSystem: 'CENSUS',
        geography: 'North Dakota',
        type: 'DATASET',
        vintageYear: '2025',
      }),
    );

    expect(query).toEqual({
      q: 'North Dakota migration',
      programs: ['ACS', 'CPS'],
      publisher: 'U.S. Census Bureau',
      sourceSystem: 'CENSUS',
      geography: 'North Dakota',
      contentType: 'DATASET',
      vintageYear: 2025,
      page: 0,
      pageSize: 10,
    });
  });

  it('drops malformed controlled values instead of casting arbitrary URL text', () => {
    const query = adapter.fromParamMap(
      convertToParamMap({
        sourceSystem: 'NOT_A_SOURCE',
        type: 'NOT_A_TYPE',
        vintageYear: 'twenty-five',
      }),
    );

    expect(query).toEqual({ page: 0, pageSize: 10 });
  });

  it('serializes search and filter intent without pretending cursor page history is shareable', () => {
    expect(
      adapter.toQueryParams({
        q: 'North Dakota migration',
        programs: ['ACS', 'ACS', 'CPS'],
        sourceSystem: 'CENSUS',
        contentType: 'DATASET',
        page: 8,
        pageSize: 10,
      }),
    ).toEqual({
      q: 'North Dakota migration',
      program: ['ACS', 'CPS'],
      publisher: null,
      sourceSystem: 'CENSUS',
      geography: null,
      type: 'DATASET',
      vintageYear: null,
    });
  });

  it('recognizes only search-related URL intent', () => {
    expect(adapter.hasSearchIntent(convertToParamMap({ q: 'migration' }))).toBe(
      true,
    );
    expect(
      adapter.hasSearchIntent(convertToParamMap({ unrelated: 'value' })),
    ).toBe(false);
  });
});

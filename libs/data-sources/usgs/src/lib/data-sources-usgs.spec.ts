import { dataSourcesUsgs } from './data-sources-usgs';

describe('dataSourcesUsgs', () => {
  it('should work', () => {
    expect(dataSourcesUsgs()).toEqual('data-sources-usgs');
  });
});

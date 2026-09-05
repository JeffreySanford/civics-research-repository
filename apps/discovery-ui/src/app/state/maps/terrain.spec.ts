import {
  DEFAULT_USGS_TERRAIN_MODE,
  isUsgsTerrainMode,
  USGS_3DEP_TERRAIN_TILE_TEMPLATE,
  usgsTerrainModeLabel,
  withUsgsTerrainMode,
} from './terrain';

describe('USGS terrain mode contract', () => {
  it('defaults to hillshade and keeps the repository proxy boundary', () => {
    expect(DEFAULT_USGS_TERRAIN_MODE).toBe('hillshade');
    expect(USGS_3DEP_TERRAIN_TILE_TEMPLATE).toContain(
      '/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}',
    );
    expect(USGS_3DEP_TERRAIN_TILE_TEMPLATE).toContain('mode=hillshade');
    expect(USGS_3DEP_TERRAIN_TILE_TEMPLATE).not.toContain(
      'elevation.nationalmap.gov',
    );
  });

  it('accepts only the three application visualization modes', () => {
    expect(isUsgsTerrainMode('hillshade')).toBe(true);
    expect(isUsgsTerrainMode('tinted')).toBe(true);
    expect(isUsgsTerrainMode('slope')).toBe(true);
    expect(isUsgsTerrainMode('aspect')).toBe(false);
    expect(isUsgsTerrainMode(null)).toBe(false);
  });

  it('provides stable user-facing labels for every mode', () => {
    expect(usgsTerrainModeLabel('hillshade')).toBe('Hillshade');
    expect(usgsTerrainModeLabel('tinted')).toBe('Tinted elevation');
    expect(usgsTerrainModeLabel('slope')).toBe('Slope');
  });

  it('replaces an existing mode without changing the rest of the template', () => {
    expect(
      withUsgsTerrainMode(
        '/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}&mode=hillshade',
        'slope',
      ),
    ).toBe(
      '/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}&mode=slope',
    );
  });

  it('adds a mode when an approved template does not already contain one', () => {
    expect(
      withUsgsTerrainMode(
        '/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}',
        'tinted',
      ),
    ).toBe(
      '/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}&mode=tinted',
    );
  });
});

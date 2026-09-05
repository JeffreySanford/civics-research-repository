export type UsgsTerrainMode = 'hillshade' | 'tinted' | 'slope';

export const DEFAULT_USGS_TERRAIN_MODE: UsgsTerrainMode = 'hillshade';

export const USGS_3DEP_TERRAIN_TILE_TEMPLATE =
  '/overlays/usgs/terrain/export?bbox={bbox-epsg-3857}&mode=hillshade';

export function isUsgsTerrainMode(
  value: string | null,
): value is UsgsTerrainMode {
  return value === 'hillshade' || value === 'tinted' || value === 'slope';
}

export function usgsTerrainModeLabel(mode: UsgsTerrainMode): string {
  switch (mode) {
    case 'hillshade':
      return 'Hillshade';
    case 'tinted':
      return 'Tinted elevation';
    case 'slope':
      return 'Slope';
  }
}

export function withUsgsTerrainMode(
  template: string,
  mode: UsgsTerrainMode,
): string {
  if (/([?&])mode=[^&]*/.test(template)) {
    return template.replace(/([?&])mode=[^&]*/, `$1mode=${mode}`);
  }

  return `${template}${template.includes('?') ? '&' : '?'}mode=${mode}`;
}

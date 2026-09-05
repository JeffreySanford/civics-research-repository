export type UsgsTerrainMode = 'hillshade' | 'tinted' | 'slope';

export const DEFAULT_USGS_TERRAIN_MODE: UsgsTerrainMode = 'hillshade';

export function isUsgsTerrainMode(value: string | null): value is UsgsTerrainMode {
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

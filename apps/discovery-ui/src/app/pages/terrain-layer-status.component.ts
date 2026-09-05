import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { UsgsTerrainMode } from '../state/maps/terrain';
import { usgsTerrainModeLabel } from '../state/maps/terrain';

export type TerrainLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-terrain-layer-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="terrain-status" data-testid="terrain-semantic-status">
      @if (!available) {
        <p role="status">
          USGS 3DEP terrain is not available for this map configuration.
        </p>
      } @else if (!visible) {
        <p>USGS 3DEP terrain is available and currently off.</p>
      } @else if (status === 'loading') {
        <p role="status">Loading USGS 3DEP {{ modeLabel }} terrain imagery…</p>
      } @else if (status === 'error') {
        <p role="alert">
          USGS 3DEP terrain imagery is unavailable. The other map layers remain
          usable.
        </p>
      } @else {
        <p role="status">
          USGS 3DEP terrain is on — {{ modeLabel }}. Terrain is contextual
          imagery only; research and economic meaning remains available through
          the map's vector layers and semantic equivalents.
        </p>
      }

      @if (available && sourceUrl) {
        <p class="feature-hint">
          Source:
          <a [href]="sourceUrl" target="_blank" rel="noreferrer">USGS 3DEP</a>
        </p>
      }
    </div>
  `,
})
export class TerrainLayerStatusComponent {
  @Input() available = true;
  @Input() visible = false;
  @Input() mode: UsgsTerrainMode = 'hillshade';
  @Input() status: TerrainLoadStatus = 'idle';
  @Input() sourceUrl: string | null = null;

  protected get modeLabel(): string {
    return usgsTerrainModeLabel(this.mode);
  }
}

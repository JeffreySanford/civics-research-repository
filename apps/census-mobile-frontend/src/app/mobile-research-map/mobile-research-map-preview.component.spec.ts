import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import {
  RepositoryMapsApi,
  type ResearchSpatialCoverageResponse,
} from 'repository-api-client';
import { of } from 'rxjs';
import { MobileResearchMapPreviewComponent } from './mobile-research-map-preview.component';
import { MobileResearchMapPreviewModule } from './mobile-research-map-preview.module';

const response = {
  buildId: 'mobile-map-test',
  sourceSystem: 'DATA_GOV',
  schemaVersion: 1,
  sourceSnapshotAt: '2026-09-12T12:00:00Z',
  capturedAt: '2026-09-12T12:05:00Z',
  compositionSha256: 'a'.repeat(64),
  projectionId: 'projection-mobile',
  criteriaFingerprint: 'criteria-mobile',
  viewport: { west: -180, south: -85, east: 180, north: 85 },
  summary: {
    matchingRecords: 12,
    mappedRecords: 8,
    unmappedRecords: 4,
    quarantinedRecords: 0,
    unanchoredAntimeridianRecords: 0,
    viewportMappedRecords: 8,
    returnedFeatures: 1,
    omittedFeatures: 7,
    featureLimit: 80,
    truncated: true,
  },
  features: [
    {
      sourceSystem: 'DATA_GOV',
      sourceIdentifier: 'nd-migration-map',
      title: 'North Dakota migration coverage',
      publisher: 'U.S. Census Bureau',
      program: 'ACS',
      contentType: 'DATASET',
      sourceUrl: 'https://example.test/research',
      geometryStatus: 'VALID',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-104.05, 45.94],
            [-96.55, 45.94],
            [-96.55, 49.0],
            [-104.05, 49.0],
            [-104.05, 45.94],
          ],
        ],
      },
      renderLon: null,
      renderLat: null,
      renderPointMethod: null,
    },
  ],
} as unknown as ResearchSpatialCoverageResponse;

describe('MobileResearchMapPreviewComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([]), MobileResearchMapPreviewModule],
      providers: [
        {
          provide: RepositoryMapsApi,
          useValue: {
            getResearchSpatialCoverage: () => of(response),
          },
        },
      ],
    }).compileComponents();
  });

  it('keeps spatial counts semantic and preserves the current query in the map link', async () => {
    const fixture = TestBed.createComponent(MobileResearchMapPreviewComponent);
    fixture.componentRef.setInput('query', {
      q: 'North Dakota migration',
      publisher: 'U.S. Census Bureau',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(
      '8 of 12 matching Data.gov spatial records',
    );
    expect(compiled.textContent).toContain(
      '4 matching records do not declare publisher geometry',
    );
    expect(compiled.textContent).toContain('Showing 1 of 8');

    const link = compiled.querySelector(
      'a[aria-label="Open research coverage map for the current search"]',
    );
    expect(link).not.toBeNull();
  });
});

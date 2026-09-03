import { TestBed } from '@angular/core/testing';
import type { ResearchCoverageSummary } from '../state/maps/research-coverage';
import { expectNoAxeViolations } from '../testing/axe';
import { ResearchCoverageSummaryComponent } from './research-coverage-summary.component';

const populatedSummary = {
  query: { q: 'climate', sourceSystem: 'DATA_GOV' },
  buildId: 'spatial-build-a11y',
  sourceSystem: 'DATA_GOV',
  sourceSnapshotAt: '2026-09-02T12:00:00Z',
  capturedAt: '2026-09-02T12:05:00Z',
  compositionSha256: 'a'.repeat(64),
  projectionId: 'projection-a11y',
  criteriaFingerprint: 'criteria-a11y',
  totalResults: 33,
  mappedResults: 30,
  unmappedResults: 3,
  quarantinedResults: 1,
  unanchoredAntimeridianResults: 1,
  viewportMappedResults: 3,
  returnedFeatures: 1,
  omittedFeatures: 2,
  featureLimit: 200,
  truncated: true,
  features: [
    {
      sourceSystem: 'DATA_GOV',
      sourceIdentifier: 'coverage-a11y',
      title: 'Accessible publisher coverage',
      publisher: 'Example Federal Agency',
      program: 'Climate',
      contentType: 'DATASET',
      sourceUrl: 'https://catalog.data.gov/dataset/coverage-a11y',
      geometryStatus: 'VALID',
      geometry: { type: 'Point', coordinates: [-100, 40] },
      renderLon: -100,
      renderLat: 40,
      renderPointMethod: 'SHAPE_BOUNDS_CENTER',
    },
  ],
} as ResearchCoverageSummary;

describe('ResearchCoverageSummaryComponent accessibility', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResearchCoverageSummaryComponent],
    }).compileComponents();
  });

  it('has no axe violations for populated and truncated publisher coverage', async () => {
    const fixture = TestBed.createComponent(ResearchCoverageSummaryComponent);
    fixture.componentRef.setInput('summary', populatedSummary);
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('has no axe violations while bounded coverage is loading', async () => {
    const fixture = TestBed.createComponent(ResearchCoverageSummaryComponent);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('has no axe violations for an empty viewport result', async () => {
    const fixture = TestBed.createComponent(ResearchCoverageSummaryComponent);
    fixture.componentRef.setInput('summary', {
      ...populatedSummary,
      viewportMappedResults: 0,
      returnedFeatures: 0,
      omittedFeatures: 0,
      truncated: false,
      features: [],
    });
    fixture.detectChanges();

    await expectNoAxeViolations(fixture.nativeElement);
  });
});

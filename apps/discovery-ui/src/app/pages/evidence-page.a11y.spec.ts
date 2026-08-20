import { TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { EvidencePage } from './evidence-page';
import { expectNoAxeViolations } from '../testing/axe';
import {
  evidenceFeatureKey,
  initialEvidenceState,
} from '../state/evidence/evidence.reducer';
import {
  pipelineFeatureKey,
  initialPipelineState,
} from '../state/pipeline/pipeline.reducer';

/**
 * Accessibility of the evidence page in states a browser test cannot easily reach.
 *
 * <p>The Playwright suite scans this route as it normally renders: loaded, populated, healthy. The
 * states that go unscanned are the ones a reader is most likely to meet on a bad day — a spinner, a
 * failed load, an empty table — and each is a different tree with different labelling.
 *
 * <p>Driving those through a running application means failing an API on purpose and waiting; here
 * they are one store value apart.
 */
describe('EvidencePage accessibility', () => {
  const renderWith = async (evidence: object, pipeline: object) => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [EvidencePage],
      providers: [
        provideNoopAnimations(),
        provideMockStore({
          initialState: {
            [evidenceFeatureKey]: { ...initialEvidenceState, ...evidence },
            [pipelineFeatureKey]: { ...initialPipelineState, ...pipeline },
          },
        }),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EvidencePage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('is accessible while loading', async () => {
    const fixture = await renderWith({ loading: true }, { loading: true });

    await expectNoAxeViolations(fixture.nativeElement);
  });

  /** A failed load is an alert plus whatever stale content remains; both have to stay labelled. */
  it('is accessible when both panels failed to load', async () => {
    const fixture = await renderWith(
      { loading: false, error: 'Accessibility evidence failed to load.' },
      { loading: false, error: 'Pipeline figures failed to load.' },
    );

    await expectNoAxeViolations(fixture.nativeElement);
  });

  /** The empty state is a distinct tree: tables disappear and headings must not be left dangling. */
  it('is accessible with nothing to show', async () => {
    const fixture = await renderWith(
      { loading: false, entries: [] },
      { loading: false, inventory: null, dspace: null, solr: null },
    );

    await expectNoAxeViolations(fixture.nativeElement);
  });
});

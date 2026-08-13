import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { firstValueFrom, of } from 'rxjs';
import { ErrorSnackbarService } from 'shared-material';
import { DatasetsActions } from '../datasets/datasets.actions';
import { SearchActions } from '../search/search.actions';
import { ErrorNotificationEffects } from './error-notification.effects';

describe('ErrorNotificationEffects', () => {
  it('shows a snackbar when search fails', async () => {
    const show = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ErrorNotificationEffects,
        provideMockActions(() =>
          of(
            SearchActions.searchFailed({
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Search results failed to load.',
              },
            }),
          ),
        ),
        { provide: ErrorSnackbarService, useValue: { show } },
      ],
    });

    await firstValueFrom(
      TestBed.inject(ErrorNotificationEffects).notifySearchFailure$,
    );

    expect(show).toHaveBeenCalledWith({
      code: 'INTERNAL_ERROR',
      message: 'Search results failed to load.',
    });
  });

  it('shows a snackbar when dataset detail fails', async () => {
    const show = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        ErrorNotificationEffects,
        provideMockActions(() =>
          of(
            DatasetsActions.datasetFailed({
              error: {
                code: 'NOT_FOUND',
                message: 'Dataset not found.',
              },
            }),
          ),
        ),
        { provide: ErrorSnackbarService, useValue: { show } },
      ],
    });

    await firstValueFrom(
      TestBed.inject(ErrorNotificationEffects).notifyDatasetFailure$,
    );

    expect(show).toHaveBeenCalledWith({
      code: 'NOT_FOUND',
      message: 'Dataset not found.',
    });
  });
});

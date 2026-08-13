import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorSnackbarService } from './error-snackbar.service';

describe('ErrorSnackbarService', () => {
  it('opens a semantic error snackbar with trace id action', () => {
    const open = vi.fn().mockReturnValue({
      onAction: () => ({ subscribe: vi.fn() }),
    });
    TestBed.configureTestingModule({
      providers: [
        ErrorSnackbarService,
        { provide: MatSnackBar, useValue: { open } },
      ],
    });

    const service = TestBed.inject(ErrorSnackbarService);
    service.show({
      code: 'SERVICE_UNAVAILABLE',
      message: 'DSpace is unavailable.',
      traceId: 'trace-42',
    });

    expect(open).toHaveBeenCalledWith(
      'DSpace is unavailable.',
      'Copy trace ID',
      expect.objectContaining({
        panelClass: ['snackbar-error'],
        politeness: 'assertive',
      }),
    );
  });

  it('uses warn styling for validation failures', () => {
    const open = vi.fn().mockReturnValue({
      onAction: () => ({ subscribe: vi.fn() }),
    });
    TestBed.configureTestingModule({
      providers: [
        ErrorSnackbarService,
        { provide: MatSnackBar, useValue: { open } },
      ],
    });

    TestBed.inject(ErrorSnackbarService).show({
      code: 'BAD_REQUEST',
      message: 'Request validation failed.',
      details: ['mode: must not be null'],
    });

    expect(open).toHaveBeenCalledWith(
      'Request validation failed. mode: must not be null',
      'Dismiss',
      expect.objectContaining({
        panelClass: ['snackbar-warn'],
        politeness: 'polite',
      }),
    );
  });
});

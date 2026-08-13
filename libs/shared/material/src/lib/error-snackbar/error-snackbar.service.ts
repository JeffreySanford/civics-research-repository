import { Injectable, inject } from '@angular/core';
import {
  MatSnackBar,
  type MatSnackBarConfig,
} from '@angular/material/snack-bar';
import type { RepositoryError } from 'repository-api-client';

export type ErrorSnackbarTone = 'error' | 'warn' | 'info';

const DEFAULT_DURATION_MS = 8_000;

@Injectable({ providedIn: 'root' })
export class ErrorSnackbarService {
  private readonly snackBar = inject(MatSnackBar);

  show(error: RepositoryError): void {
    const tone = toneForCode(error.code);
    const message = formatMessage(error);
    const config: MatSnackBarConfig = {
      duration: DEFAULT_DURATION_MS,
      panelClass: [`snackbar-${tone}`],
      politeness: tone === 'error' ? 'assertive' : 'polite',
      announcementMessage: message,
    };

    if (error.traceId) {
      this.snackBar
        .open(message, 'Copy trace ID', config)
        .onAction()
        .subscribe(() => {
          void navigator.clipboard?.writeText(error.traceId ?? '');
        });
      return;
    }

    this.snackBar.open(message, 'Dismiss', config);
  }
}

function toneForCode(code: string): ErrorSnackbarTone {
  switch (code) {
    case 'BAD_REQUEST':
      return 'warn';
    case 'NOT_FOUND':
      return 'info';
    case 'INTERNAL_ERROR':
    case 'SERVICE_UNAVAILABLE':
      return 'error';
    default:
      return code.startsWith('4') ? 'warn' : 'error';
  }
}

function formatMessage(error: RepositoryError): string {
  const detailSuffix =
    error.details && error.details.length > 0 ? ` ${error.details[0]}` : '';
  return `${error.message}${detailSuffix}`;
}

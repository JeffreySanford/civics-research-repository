import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewChild,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import {
  type CorpusProfile,
  type CorpusStorageMeasurement,
} from 'repository-api-client';

@Component({
  selector: 'app-admin-corpus-history-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
  ],
  template: `
    @if (dataSource.data.length > 0) {
      <div class="history-controls">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Filter historical measurements</mat-label>
          <input
            matInput
            type="search"
            aria-label="Filter historical measurements"
            placeholder="Profile, topology, count, or storage"
            (input)="applyFilter($event)"
          />
        </mat-form-field>
      </div>

      <div class="table-scroll" tabindex="0">
        <table
          mat-table
          [dataSource]="dataSource"
          matSort
          matSortActive="capturedAt"
          matSortDirection="desc"
          matSortDisableClear
        >
          <caption class="visually-hidden">
            Historical corpus scale and local storage measurements
          </caption>

          <ng-container matColumnDef="capturedAt">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by capture time"
            >
              Captured
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ measurement.capturedAt | date: 'short' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="profile">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by corpus profile"
            >
              Profile
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ profileLabel(measurement.profile) }}
            </td>
          </ng-container>

          <ng-container matColumnDef="topology">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by deployment topology"
            >
              Topology
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ topologyLabel(measurement.topology) }}
            </td>
          </ng-container>

          <ng-container matColumnDef="activeProjectionCount">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by active projection count"
            >
              Active
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ measurement.activeProjectionCount | number }}
            </td>
          </ng-container>

          <ng-container matColumnDef="retainedFederatedCount">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by retained federated record count"
            >
              Retained
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ measurement.retainedFederatedCount | number }}
            </td>
          </ng-container>

          <ng-container matColumnDef="applicationPostgresBytes">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by application PostgreSQL size"
            >
              Postgres
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ formatBytes(measurement.applicationPostgresBytes) }}
            </td>
          </ng-container>

          <ng-container matColumnDef="dspaceStoredBytes">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by DSpace storage size"
            >
              DSpace
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ formatBytes(measurement.dspaceStoredBytes) }}
            </td>
          </ng-container>

          <ng-container matColumnDef="solrIndexBytes">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by Solr index size"
            >
              Solr
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ formatBytes(measurement.solrIndexBytes) }}
            </td>
          </ng-container>

          <ng-container matColumnDef="openSearchIndexBytes">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by OpenSearch index size"
            >
              OpenSearch
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ formatBytes(measurement.openSearchIndexBytes) }}
            </td>
          </ng-container>

          <ng-container matColumnDef="totalMeasuredLocalBytes">
            <th
              mat-header-cell
              *matHeaderCellDef
              mat-sort-header
              sortActionDescription="Sort by known measured total size"
            >
              Known total
            </th>
            <td mat-cell *matCellDef="let measurement">
              {{ formatBytes(measurement.totalMeasuredLocalBytes) }}
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell no-data" [attr.colspan]="displayedColumns.length">
              No historical measurements match the current filter.
            </td>
          </tr>
        </table>
      </div>

      <mat-paginator
        [pageSize]="10"
        [pageSizeOptions]="[5, 10, 25, 50]"
        showFirstLastButtons
        aria-label="Historical footprint pagination"
      ></mat-paginator>
    } @else {
      <p>No storage captures have been recorded yet.</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .history-controls {
      display: flex;
      justify-content: flex-end;
      margin-top: 1rem;
    }

    mat-form-field {
      width: min(100%, 26rem);
    }

    .table-scroll {
      overflow-x: auto;
      border: 1px solid var(--civics-border-subtle);
      border-radius: 0.75rem 0.75rem 0 0;
    }

    table {
      width: 100%;
      min-width: 70rem;
    }

    .mat-mdc-header-cell,
    .mat-mdc-cell {
      white-space: nowrap;
    }

    .mat-mdc-header-cell {
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .no-data {
      padding: 1rem;
      color: var(--mat-sys-on-surface-variant);
      text-align: center;
    }

    mat-paginator {
      border: 1px solid var(--civics-border-subtle);
      border-top: 0;
      border-radius: 0 0 0.75rem 0.75rem;
      background: var(--mat-sys-surface-container-lowest);
    }

    @media (max-width: 720px) {
      .history-controls {
        justify-content: stretch;
      }

      mat-form-field {
        width: 100%;
      }
    }
  `,
})
export class AdminCorpusHistoryTableComponent {
  protected readonly displayedColumns = [
    'capturedAt',
    'profile',
    'topology',
    'activeProjectionCount',
    'retainedFederatedCount',
    'applicationPostgresBytes',
    'dspaceStoredBytes',
    'solrIndexBytes',
    'openSearchIndexBytes',
    'totalMeasuredLocalBytes',
  ];

  protected readonly dataSource =
    new MatTableDataSource<CorpusStorageMeasurement>([]);

  constructor() {
    this.dataSource.filterPredicate = (measurement, filter) =>
      this.filterText(measurement).includes(filter);
    this.dataSource.sortingDataAccessor = (measurement, column) =>
      this.sortValue(measurement, column);
  }

  @Input({ required: true })
  set history(history: readonly CorpusStorageMeasurement[] | null | undefined) {
    this.dataSource.data = [...(history ?? [])];
  }

  @ViewChild(MatPaginator)
  set paginator(paginator: MatPaginator | undefined) {
    if (paginator) {
      this.dataSource.paginator = paginator;
    }
  }

  @ViewChild(MatSort)
  set sort(sort: MatSort | undefined) {
    if (sort) {
      this.dataSource.sort = sort;
    }
  }

  protected applyFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dataSource.filter = value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  private filterText(measurement: CorpusStorageMeasurement): string {
    return [
      measurement.capturedAt,
      this.profileLabel(measurement.profile),
      this.topologyLabel(measurement.topology),
      measurement.activeProjectionCount,
      measurement.retainedFederatedCount,
      measurement.applicationPostgresBytes,
      this.formatBytes(measurement.applicationPostgresBytes),
      measurement.dspaceStoredBytes,
      this.formatBytes(measurement.dspaceStoredBytes),
      measurement.solrIndexBytes,
      this.formatBytes(measurement.solrIndexBytes),
      measurement.openSearchIndexBytes,
      this.formatBytes(measurement.openSearchIndexBytes),
      measurement.totalMeasuredLocalBytes,
      this.formatBytes(measurement.totalMeasuredLocalBytes),
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(' ')
      .toLowerCase();
  }

  private sortValue(
    measurement: CorpusStorageMeasurement,
    column: string,
  ): string | number {
    switch (column) {
      case 'capturedAt':
        return Date.parse(measurement.capturedAt);
      case 'profile':
        return this.profileLabel(measurement.profile);
      case 'topology':
        return this.topologyLabel(measurement.topology);
      case 'activeProjectionCount':
        return measurement.activeProjectionCount;
      case 'retainedFederatedCount':
        return measurement.retainedFederatedCount;
      case 'applicationPostgresBytes':
        return measurement.applicationPostgresBytes ?? -1;
      case 'dspaceStoredBytes':
        return measurement.dspaceStoredBytes ?? -1;
      case 'solrIndexBytes':
        return measurement.solrIndexBytes ?? -1;
      case 'openSearchIndexBytes':
        return measurement.openSearchIndexBytes ?? -1;
      case 'totalMeasuredLocalBytes':
        return measurement.totalMeasuredLocalBytes;
      default:
        return '';
    }
  }

  protected formatBytes(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'Not measured';
    }
    if (value < 1024) {
      return `${value} B`;
    }

    const units = ['KiB', 'MiB', 'GiB', 'TiB'];
    let amount = value / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && amount >= 1024; index += 1) {
      amount /= 1024;
      unit = units[index];
    }
    const precision = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
    return `${amount.toFixed(precision)} ${unit}`;
  }

  protected profileLabel(profile: CorpusProfile): string {
    switch (profile) {
      case 'CURATED_DEMO':
        return 'Curated demo';
      case 'FEDERATED_10K':
        return 'Federated 10K';
      case 'FEDERATED_100K':
        return 'Federated 100K';
      case 'FEDERATED_1M':
        return 'Federated 1M';
      case 'FULL':
        return 'Full source bounds';
    }
  }

  protected topologyLabel(
    topology: CorpusStorageMeasurement['topology'],
  ): string {
    switch (topology) {
      case 'DOCKER_COMPOSE':
        return 'Docker Compose';
      case 'KIND_CLUSTER':
        return 'kind cluster';
      case 'OTHER':
        return 'Other';
    }
  }
}

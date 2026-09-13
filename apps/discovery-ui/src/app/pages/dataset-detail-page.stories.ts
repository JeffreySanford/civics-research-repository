import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { expect, userEvent, within } from 'storybook/test';
import type {
  ResearchArtifactVersion,
  ResearchObjectDetail,
  VersionHistoryStatus,
} from 'repository-api-client';
import {
  datasetsFeatureKey,
  initialDatasetsState,
} from '../state/datasets/datasets.reducer';
import { ResearchObjectDetailPage } from './dataset-detail-page';

const checksum =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const detail = {
  source: 'REPOSITORY',
  origin: 'REPOSITORY',
  sourceSystem: 'CENSUS',
  id: 'version-history-story',
  title: 'Version provenance contract example',
  program: 'OTHER',
  publisher: 'Example Federal Publisher',
  abstractText:
    'Story fixture for observed, available, and unavailable version-history states.',
  geography: 'United States',
  files: [],
  citation: 'Version provenance contract example.',
  sourceUrl: 'https://example.gov/research/version-history-story',
  relatedResearch: [],
  contentType: 'DATASET',
  accessLevel: 'PUBLIC',
} as ResearchObjectDetail;

const currentVersion: ResearchArtifactVersion = {
  id: 'version-history-story-current',
  label: 'Observed release 2025.2',
  releasedOn: '2025-09-01',
  current: true,
  versionLabel: '2025.2',
  versionDate: '2025-08-29',
  sourceSha256: checksum,
  capturedAt: '2026-09-12T18:45:00-05:00',
  isVersionOf: 'version-history-story',
  changeNote: 'Publisher-issued metadata revision.',
  sourceUrl: 'https://example.gov/research/version-history-story/2025.2',
};

function withState(
  status: VersionHistoryStatus,
  versions: readonly ResearchArtifactVersion[],
) {
  return applicationConfig({
    providers: [
      provideMockStore({
        initialState: {
          [datasetsFeatureKey]: {
            ...initialDatasetsState,
            detail,
            versions,
            versionHistoryStatus: status,
          },
        },
      }),
    ],
  });
}

async function openVersions(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole('tab', { name: 'Versions' }));
  return canvas;
}

const meta: Meta<ResearchObjectDetailPage> = {
  title: 'Accessibility/Research detail/Version provenance',
  component: ResearchObjectDetailPage,
  decorators: [
    applicationConfig({
      providers: [provideNoopAnimations(), provideRouter([])],
    }),
  ],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<ResearchObjectDetailPage>;

export const ObservedCurrentOnly: Story = {
  decorators: [withState('OBSERVED_CURRENT_ONLY', [currentVersion])],
  play: async ({ canvasElement }) => {
    const canvas = await openVersions(canvasElement);
    await expect(
      canvas.getByText(
        'Only the current repository/source record has been observed. Earlier or later version history is not established.',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: 'Authority and evidence trail' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('DSpace curated repository record'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        'Derived projections only; Solr/OpenSearch are not authority.',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Current observed record'),
    ).toBeInTheDocument();
    await expect(canvas.getByText('2025.2')).toBeInTheDocument();
    await expect(canvas.getByText(checksum)).toBeInTheDocument();
    await expect(
      canvas.getByText('Publisher-issued metadata revision.'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: 'What this record proves' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/Established by the recorded SHA-256 digest/),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/current-record evidence does not prove earlier or later versions/),
    ).toBeInTheDocument();
    await expect(canvas.queryByText('TIGER_LINE 2024')).toBeNull();
  },
};

export const ObservedWithoutFixityOrCapture: Story = {
  decorators: [
    withState('OBSERVED_CURRENT_ONLY', [
      {
        id: 'version-history-story-current',
        label: 'Observed release 2025.2',
        current: true,
        versionLabel: '2025.2',
        sourceUrl: 'https://example.gov/research/version-history-story/2025.2',
      },
    ]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = await openVersions(canvasElement);
    await expect(
      canvas.getByText(/Not established; no source digest is recorded/),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/sync time is not substituted for capture evidence/),
    ).toBeInTheDocument();
    await expect(canvas.queryByText(checksum)).toBeNull();
  },
};

export const HistoryAvailable: Story = {
  decorators: [
    withState('HISTORY_AVAILABLE', [
      { ...currentVersion, supersedes: 'version-history-story-prior' },
      {
        id: 'version-history-story-prior',
        label: 'Observed release 2025.1',
        releasedOn: '2025-06-01',
        current: false,
        versionLabel: '2025.1',
        isVersionOf: 'version-history-story',
        sourceUrl: 'https://example.gov/research/version-history-story/2025.1',
      },
    ]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = await openVersions(canvasElement);
    await expect(
      canvas.getByText(
        'The repository has observed version-lineage records for this research artifact.',
      ),
    ).toBeInTheDocument();
    await expect(canvas.getByText('Observed multi-version lineage')).toBeInTheDocument();
    await expect(
      canvas.getByText('Observed release 2025.2'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Observed release 2025.1'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('version-history-story-prior'),
    ).toBeInTheDocument();
    await expect(
      canvas.getAllByText(/Established from observed version-lineage records/)
        .length,
    ).toBeGreaterThan(0);
  },
};

export const ProvenanceUnavailable: Story = {
  decorators: [withState('UNAVAILABLE', [])],
  play: async ({ canvasElement }) => {
    const canvas = await openVersions(canvasElement);
    await expect(
      canvas.getByText(
        'Version provenance is not available for this research artifact.',
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: 'Authority and evidence trail' }),
    ).toBeInTheDocument();
    await expect(canvas.getByText('Version provenance unavailable')).toBeInTheDocument();
    await expect(canvas.queryByText('Current observed record')).toBeNull();
    await expect(
      canvas.queryByRole('heading', { name: 'What this record proves' }),
    ).toBeNull();
  },
};

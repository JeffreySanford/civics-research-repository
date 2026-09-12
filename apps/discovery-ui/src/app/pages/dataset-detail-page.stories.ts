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
      canvas.getByText('Current observed record'),
    ).toBeInTheDocument();
    await expect(canvas.queryByText('TIGER_LINE 2024')).toBeNull();
  },
};

export const HistoryAvailable: Story = {
  decorators: [
    withState('HISTORY_AVAILABLE', [
      currentVersion,
      {
        id: 'version-history-story-prior',
        label: 'Observed release 2025.1',
        releasedOn: '2025-06-01',
        current: false,
        versionLabel: '2025.1',
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
    await expect(
      canvas.getByText('Observed release 2025.2'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Observed release 2025.1'),
    ).toBeInTheDocument();
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
    await expect(canvas.queryByText('Current observed record')).toBeNull();
  },
};

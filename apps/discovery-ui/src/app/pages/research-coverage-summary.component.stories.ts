import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import type { ResearchCoverageSummary } from '../state/maps/research-coverage';
import { ResearchCoverageSummaryComponent } from './research-coverage-summary.component';

const populatedSummary = {
  query: { q: 'climate', sourceSystem: 'DATA_GOV' },
  buildId: 'spatial-build-storybook',
  sourceSystem: 'DATA_GOV',
  sourceSnapshotAt: '2026-09-02T12:00:00Z',
  capturedAt: '2026-09-02T12:05:00Z',
  compositionSha256: 'a'.repeat(64),
  projectionId: 'projection-storybook',
  criteriaFingerprint: 'criteria-storybook',
  totalResults: 440_379,
  mappedResults: 418_462,
  unmappedResults: 21_917,
  quarantinedResults: 679,
  unanchoredAntimeridianResults: 12,
  viewportMappedResults: 225,
  returnedFeatures: 2,
  omittedFeatures: 23,
  featureLimit: 200,
  truncated: true,
  features: [
    {
      sourceSystem: 'DATA_GOV',
      sourceIdentifier: 'publisher-climate-polygon',
      title: 'California Climate Resilience Study',
      publisher: 'Example Federal Agency',
      program: 'Climate',
      contentType: 'DATASET',
      sourceUrl:
        'https://catalog.data.gov/dataset/california-climate-resilience',
      geometryStatus: 'VALID',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-122.6, 37.1],
            [-121.8, 37.1],
            [-121.8, 37.8],
            [-122.6, 37.1],
          ],
        ],
      },
      renderLon: -122.2,
      renderLat: 37.45,
      renderPointMethod: 'SHAPE_BOUNDS_CENTER',
    },
    {
      sourceSystem: 'DATA_GOV',
      sourceIdentifier: 'antimeridian-observation',
      title: 'Pacific Observation Coverage',
      publisher: null,
      program: null,
      contentType: 'PUBLICATION',
      sourceUrl: null,
      geometryStatus: 'ANTIMERIDIAN_CANDIDATE',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [179, 10],
            [-179, 10],
            [-179, 11],
            [179, 10],
          ],
        ],
      },
      renderLon: 179.5,
      renderLat: 10.5,
      renderPointMethod: 'DATA_GOV_SOURCE_POINT_FOR_ANTIMERIDIAN_CANDIDATE',
    },
  ],
} as ResearchCoverageSummary;

const meta: Meta<ResearchCoverageSummaryComponent> = {
  title: 'Accessibility/Maps/Research coverage summary',
  component: ResearchCoverageSummaryComponent,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<ResearchCoverageSummaryComponent>;

export const PopulatedAndTruncated: Story = {
  args: { summary: populatedSummary, loading: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', {
        name: 'Data.gov research extents',
      }),
    ).toBeInTheDocument();
    const table = canvas.getByRole('table', {
      name: 'Data.gov research extents returned for the current map viewport',
    });
    const semanticTable = within(table);
    await expect(
      semanticTable.getByRole('rowheader', {
        name: 'California Climate Resilience Study',
      }),
    ).toBeInTheDocument();
    await expect(
      semanticTable.getByRole('link', {
        name: 'Open source record for California Climate Resilience Study',
      }),
    ).toHaveAttribute(
      'href',
      'https://catalog.data.gov/dataset/california-climate-resilience',
    );
    await expect(
      semanticTable.getByRole('cell', {
        name: 'Source-derived display anchor for antimeridian candidate',
      }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        /23 additional mapped objects in this viewport are omitted/,
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        /12 antimeridian candidate geometries lack a safe render anchor/,
      ),
    ).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { summary: null, loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('status', {
        name: '',
      }),
    ).toHaveTextContent(
      'Updating Data.gov research extents for the current map viewport.',
    );
  },
};

export const EmptyViewport: Story = {
  args: {
    loading: false,
    summary: {
      ...populatedSummary,
      viewportMappedResults: 0,
      returnedFeatures: 0,
      omittedFeatures: 0,
      truncated: false,
      features: [],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        'No Data.gov research extents from this search intersect the current viewport.',
      ),
    ).toBeInTheDocument();
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
  },
};

export const NoPublisherGeometry: Story = {
  args: {
    loading: false,
    summary: {
      ...populatedSummary,
      totalResults: 10,
      mappedResults: 0,
      unmappedResults: 9,
      quarantinedResults: 1,
      unanchoredAntimeridianResults: 0,
      viewportMappedResults: 0,
      returnedFeatures: 0,
      omittedFeatures: 0,
      truncated: false,
      features: [],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        /0 of 10 matching Data.gov research objects have publisher-declared spatial geometry/,
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/9 have no publisher geometry/),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/1 have geometry that failed validation/),
    ).toBeInTheDocument();
  },
};

export const NoResponse: Story = {
  args: { summary: null, loading: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(
        'No bounded Data.gov research-extent response is available for the current viewport.',
      ),
    ).toBeInTheDocument();
  },
};

export const SelectedExtent: Story = {
  args: {
    summary: populatedSummary,
    loading: false,
    selectedSourceIdentifier: 'publisher-climate-polygon',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const selected = canvas.getByRole('button', {
      name: 'California Climate Resilience Study',
    });

    await expect(selected).toHaveAttribute('aria-pressed', 'true');

    await expect(
      canvas.getByRole('status', {
        name: 'Research extent selection',
      }),
    ).toHaveTextContent('Selected California Climate Resilience Study');

    await expect(
      canvas.getByText('Publisher-declared spatial geometry selected on map'),
    ).toBeInTheDocument();

    await expect(
      canvas.getByRole('button', {
        name: 'Clear research extent selection',
      }),
    ).toBeInTheDocument();
  },
};

export const SelectedAntimeridianAnchor: Story = {
  args: {
    summary: populatedSummary,
    loading: false,
    selectedSourceIdentifier: 'antimeridian-observation',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const selected = canvas.getByRole('button', {
      name: 'Pacific Observation Coverage',
    });

    await expect(selected).toHaveAttribute('aria-pressed', 'true');

    await expect(
      canvas.getByText(
        'Source-derived display anchor for antimeridian candidate',
      ),
    ).toBeInTheDocument();

    await expect(
      canvas.queryByText('Publisher-declared spatial geometry selected on map'),
    ).not.toBeInTheDocument();
  },
};

import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import type { CountyBusinessPatternsChoropleth } from 'repository-api-client';
import { CountyBusinessPatternsSummaryComponent } from './county-business-patterns-summary.component';

const establishments = {
  layerId: 'county-business-patterns-north-dakota',
  source: 'U.S. Census Bureau County Business Patterns',
  sourceUrl: 'https://example.test/cbp23co.zip',
  attribution: 'U.S. Census Bureau County Business Patterns',
  geography: 'North Dakota',
  geographyLevel: 'COUNTY',
  sourceReferenceYear: 2023,
  sourceSha256: 'a'.repeat(64),
  capturedAt: '2026-09-06',
  geometryVintage: 2023,
  geometrySourceUrl: 'https://example.test/tigerweb/counties',
  geometryAttribution: 'U.S. Census Bureau TIGERweb',
  measure: 'ESTABLISHMENTS',
  measureLabel: 'Establishments',
  units: 'establishments',
  industryCode: 'TOTAL',
  industryLabel: 'All sectors',
  year: 2023,
  availableCountyCount: 2,
  unavailableCountyCount: 1,
  excludedStatewideRows: 753,
  missingRowSemantics:
    'A missing county/industry row is unavailable in the published source and must not be interpreted as zero.',
  geoJson: { type: 'FeatureCollection', features: [] },
  counties: [
    {
      fips: '38001',
      name: 'Adams County',
      available: true,
      value: 0,
      noiseFlag: null,
    },
    {
      fips: '38017',
      name: 'Cass County',
      available: true,
      value: 5_400,
      noiseFlag: null,
    },
    {
      fips: '38095',
      name: 'Towner County',
      available: false,
      value: null,
      noiseFlag: null,
    },
  ],
} as CountyBusinessPatternsChoropleth;

const meta: Meta<CountyBusinessPatternsSummaryComponent> = {
  title: 'Accessibility/Maps/County Business Patterns summary',
  component: CountyBusinessPatternsSummaryComponent,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<CountyBusinessPatternsSummaryComponent>;

export const PublishedZeroAndUnavailable: Story = {
  args: {
    choropleth: establishments,
    loading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', { name: 'County business activity' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('status', { name: 'County business activity context' }),
    ).toHaveTextContent(
      'Showing Establishments for All sectors in North Dakota, 2023.',
    );
    await expect(
      canvas.getByRole('rowheader', { name: 'Adams County' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('rowheader', { name: 'Towner County' }),
    ).toBeInTheDocument();
    await expect(canvas.getByRole('table')).toHaveTextContent('0 establishments');
    await expect(canvas.getByRole('table')).toHaveTextContent('Unavailable');
  },
};

export const ManufacturingPayroll: Story = {
  args: {
    choropleth: {
      ...establishments,
      measure: 'ANNUAL_PAYROLL',
      measureLabel: 'Annual payroll',
      units: 'thousand dollars',
      industryCode: '31',
      industryLabel: '31-33 Manufacturing',
      availableCountyCount: 2,
      unavailableCountyCount: 0,
      counties: [
        {
          fips: '38017',
          name: 'Cass County',
          available: true,
          value: 820_000,
          noiseFlag: 'G',
        },
        {
          fips: '38035',
          name: 'Grand Forks County',
          available: true,
          value: 310_000,
          noiseFlag: 'H',
        },
      ],
    },
  },
};

export const Loading: Story = {
  args: { choropleth: null, loading: true, error: null },
};

export const Error: Story = {
  args: {
    choropleth: null,
    loading: false,
    error: 'County geometry service unavailable.',
  },
};

import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import type { PopulationEstimatesChoropleth } from 'repository-api-client';
import { PopulationEstimatesSummaryComponent } from './population-estimates-summary.component';

const growth = {
  source: 'U.S. Census Bureau Population Estimates Program',
  sourceUrl: 'https://example.test/co-est2025-alldata.csv',
  attribution: 'U.S. Census Bureau Population Estimates Program',
  geography: 'North Dakota',
  sourceVintage: 2025,
  sourceSha256: 'a'.repeat(64),
  capturedAt: '2026-09-05',
  geometryVintage: 2025,
  geometrySourceUrl: 'https://example.test/tigerweb/counties',
  geometryAttribution: 'U.S. Census Bureau TIGERweb',
  measure: 'ANNUAL_GROWTH_RATE',
  measureLabel: 'Annual population growth rate',
  units: 'percent',
  year: 2025,
  priorYear: 2024,
  supportedPopulationYears: [2020, 2021, 2022, 2023, 2024, 2025],
  supportedChangeYears: [2021, 2022, 2023, 2024, 2025],
  geoJson: {
    type: 'FeatureCollection',
    features: [],
  },
  counties: [
    {
      fips: '38001',
      name: 'Adams County',
      value: -2.5,
      population: 2_100,
      priorPopulation: 2_154,
    },
    {
      fips: '38017',
      name: 'Cass County',
      value: 3.25,
      population: 202_000,
      priorPopulation: 195_640,
    },
    {
      fips: '38035',
      name: 'Grand Forks County',
      value: 0,
      population: 73_000,
      priorPopulation: 73_000,
    },
  ],
} as PopulationEstimatesChoropleth;

const meta: Meta<PopulationEstimatesSummaryComponent> = {
  title: 'Accessibility/Maps/Population estimates summary',
  component: PopulationEstimatesSummaryComponent,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<PopulationEstimatesSummaryComponent>;

export const PositiveAndNegativeGrowth: Story = {
  args: {
    choropleth: growth,
    loading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', { name: 'County population' }),
    ).toBeInTheDocument();

    await expect(
      canvas.getByRole('status', {
        name: 'County population context',
      }),
    ).toHaveTextContent(
      'Showing Annual population growth rate for North Dakota, 2024–2025.',
    );

    await expect(
      canvas.getByRole('table', {
        name: /Annual population growth rate for North Dakota, 2024–2025/,
      }),
    ).toBeInTheDocument();

    await expect(
      canvas.getByRole('rowheader', { name: 'Cass County' }),
    ).toBeInTheDocument();
  },
};

export const Population: Story = {
  args: {
    choropleth: {
      ...growth,
      measure: 'POPULATION',
      measureLabel: 'Resident population estimate',
      units: 'people',
      priorYear: undefined,
      counties: growth.counties.map((county) => ({
        ...county,
        value: county.population,
        priorPopulation: undefined,
      })),
    },
  },
};

export const OneValue: Story = {
  args: {
    choropleth: {
      ...growth,
      counties: [growth.counties[0]],
    },
  },
};

export const NoValues: Story = {
  args: {
    choropleth: {
      ...growth,
      counties: [],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByText(
        'No county values are available for this Population Estimates view.',
      ),
    ).toBeInTheDocument();

    await expect(canvas.queryByRole('table')).not.toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: {
    choropleth: null,
    loading: true,
    error: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Updating County population',
    );
  },
};

export const Error: Story = {
  args: {
    choropleth: null,
    loading: false,
    error: 'County geometry service unavailable.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'County population unavailable: County geometry service unavailable.',
    );
  },
};

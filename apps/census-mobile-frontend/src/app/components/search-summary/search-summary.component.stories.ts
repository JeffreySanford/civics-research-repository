import type { Meta, StoryObj } from '@storybook/angular';
import type { FacetGroup } from 'repository-api-client';
import { SearchSummaryComponent } from './search-summary.component';

const typeFacet: FacetGroup = {
  field: 'type',
  label: 'Type',
  values: [
    { value: 'DATASET', label: 'Dataset', count: 3420, selected: false },
    {
      value: 'PUBLICATION',
      label: 'Publication',
      count: 1280,
      selected: false,
    },
    { value: 'METHODOLOGY', label: 'Methodology', count: 721, selected: false },
    { value: 'CODE', label: 'Code', count: 360, selected: false },
    { value: 'PROJECT', label: 'Project', count: 100, selected: false },
  ],
};

const meta: Meta<SearchSummaryComponent> = {
  title: 'Mobile Search/Search Summary',
  component: SearchSummaryComponent,
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
};

export default meta;
type Story = StoryObj<SearchSummaryComponent>;

export const QueryWideTypeMix: Story = {
  args: {
    facet: typeFacet,
    totalResults: 5881,
  },
};

export const Mobile320: Story = {
  args: {
    facet: typeFacet,
    totalResults: 5881,
  },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 288px; max-width: 100%; margin: 0 auto;">
        <app-search-summary [facet]="facet" [totalResults]="totalResults"></app-search-summary>
      </div>
    `,
  }),
};

export const SingleType: Story = {
  args: {
    facet: {
      field: 'type',
      label: 'Type',
      values: [
        { value: 'DATASET', label: 'Dataset', count: 42, selected: false },
      ],
    },
    totalResults: 42,
  },
};

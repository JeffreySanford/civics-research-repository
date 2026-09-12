import type { Meta, StoryObj } from '@storybook/angular';
import { SearchExplainabilityDialogComponent } from 'shared-ui';

const meta: Meta<SearchExplainabilityDialogComponent> = {
  title: 'Mobile Search/Result Explainability Dialog',
  component: SearchExplainabilityDialogComponent,
  parameters: {
    layout: 'centered',
  },
  args: {
    resultTitle: 'Migration Flows for North Dakota',
    query: 'North Dakota migration',
    rank: 1,
    relevance: { band: 'STRONG', normalizedScore: 1 },
    relevanceModel: {
      engine: 'SOLR',
      normalization: 'SOLR_MAX_SCORE_RATIO_V1',
      calibrated: false,
    },
    matchEvidence: [
      { label: 'Title', matchedTerms: ['migration'] },
      { label: 'Geography', matchedTerms: ['North Dakota'] },
    ],
  },
};

export default meta;
type Story = StoryObj<SearchExplainabilityDialogComponent>;

export const StrongUncalibrated: Story = {};

export const WithActiveFilters: Story = {
  args: {
    activeFilters: [
      { label: 'Dataset' },
      { label: 'Geography: North Dakota' },
    ],
  },
};

export const WeakWithoutFieldEvidence: Story = {
  args: {
    resultTitle: 'North Dakota Geographic Reference File',
    rank: 7,
    relevance: { band: 'WEAK', normalizedScore: 0.3 },
    matchEvidence: [],
  },
};

export const Mobile320: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

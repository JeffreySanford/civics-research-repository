import type { Meta, StoryObj } from '@storybook/angular';
import { SearchRelevanceBadgeComponent } from 'shared-ui';

const meta: Meta<SearchRelevanceBadgeComponent> = {
  title: 'Mobile Search/Relevance Badge',
  component: SearchRelevanceBadgeComponent,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<SearchRelevanceBadgeComponent>;

export const Strong: Story = {
  args: {
    relevance: { rawScore: 10, normalizedScore: 1, band: 'STRONG' },
  },
};

export const Good: Story = {
  args: {
    relevance: { rawScore: 7, normalizedScore: 0.7, band: 'GOOD' },
  },
};

export const Moderate: Story = {
  args: {
    relevance: { rawScore: 5, normalizedScore: 0.5, band: 'MODERATE' },
  },
};

export const Weak: Story = {
  args: {
    relevance: { rawScore: 3, normalizedScore: 0.3, band: 'WEAK' },
  },
};

export const Low: Story = {
  args: {
    relevance: { rawScore: 1, normalizedScore: 0.1, band: 'LOW' },
  },
};

export const Mobile320Scale: Story = {
  render: () => ({
    template: `
      <div style="width: 320px; display: grid; gap: 12px; padding: 16px; box-sizing: border-box;">
        <lib-search-relevance-badge [relevance]="strong"></lib-search-relevance-badge>
        <lib-search-relevance-badge [relevance]="good"></lib-search-relevance-badge>
        <lib-search-relevance-badge [relevance]="moderate"></lib-search-relevance-badge>
        <lib-search-relevance-badge [relevance]="weak"></lib-search-relevance-badge>
        <lib-search-relevance-badge [relevance]="low"></lib-search-relevance-badge>
      </div>
    `,
    props: {
      strong: { rawScore: 10, normalizedScore: 1, band: 'STRONG' },
      good: { rawScore: 7, normalizedScore: 0.7, band: 'GOOD' },
      moderate: { rawScore: 5, normalizedScore: 0.5, band: 'MODERATE' },
      weak: { rawScore: 3, normalizedScore: 0.3, band: 'WEAK' },
      low: { rawScore: 1, normalizedScore: 0.1, band: 'LOW' },
    },
  }),
};

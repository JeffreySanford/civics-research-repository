import type { Meta, StoryObj } from '@storybook/angular';
import { SearchMatchEvidenceComponent } from './search-match-evidence.component';

const meta: Meta<SearchMatchEvidenceComponent> = {
  title: 'Mobile Search/Match Evidence',
  component: SearchMatchEvidenceComponent,
  parameters: {
    layout: 'padded',
    viewport: { defaultViewport: 'mobile320' },
  },
};

export default meta;
type Story = StoryObj<SearchMatchEvidenceComponent>;

export const NorthDakotaMigration: Story = {
  args: {
    evidence: [
      { field: 'TITLE', label: 'Title', matchedTerms: ['migration'] },
      {
        field: 'GEOGRAPHY',
        label: 'Geography',
        matchedTerms: ['North Dakota'],
      },
      {
        field: 'SUMMARY',
        label: 'Summary',
        matchedTerms: ['migration flows'],
      },
    ],
  },
};

export const NoEvidence: Story = {
  args: { evidence: null },
};

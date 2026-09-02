import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import { AdminBarChartComponent } from './bar-chart.component';

const meta: Meta<AdminBarChartComponent> = {
  title: 'Accessibility/Admin visualizations/Bar chart',
  component: AdminBarChartComponent,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<AdminBarChartComponent>;

export const CertifiedC2Composition: Story = {
  args: {
    caption: 'Certified C2 corpus by source',
    items: [
      { label: 'Data.gov', value: 500_000 },
      { label: 'DOE OSTI', value: 500_000 },
      { label: 'Curated DSpace', value: 181 },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = canvas.getByRole('table', {
      name: 'Certified C2 corpus by source',
    });
    const semanticTable = within(table);
    await expect(
      semanticTable.getByRole('rowheader', { name: 'Data.gov' }),
    ).toBeInTheDocument();
    await expect(
      semanticTable.getByRole('cell', { name: '181' }),
    ).toBeInTheDocument();
  },
};

export const LongLabelsAndReflow: Story = {
  args: {
    caption: 'Long source labels for reflow and zoom review',
    items: [
      {
        label:
          'Data.gov retained federal research metadata with an intentionally long source label',
        value: 500_000,
      },
      {
        label:
          'Department of Energy Office of Scientific and Technical Information retained metadata',
        value: 500_000,
      },
    ],
  },
};

export const Empty: Story = {
  args: { caption: 'No indexed research objects', items: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('table', { name: 'No indexed research objects' }),
    ).toBeInTheDocument();
  },
};

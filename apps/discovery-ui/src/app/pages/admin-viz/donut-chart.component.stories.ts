import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import { AdminDonutChartComponent } from './donut-chart.component';

const meta: Meta<AdminDonutChartComponent> = {
  title: 'Accessibility/Admin visualizations/Donut chart',
  component: AdminDonutChartComponent,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<AdminDonutChartComponent>;

export const CertifiedC2Composition: Story = {
  args: {
    caption: 'Certified C2 corpus by source',
    segments: [
      { label: 'Data.gov', value: 500_000, color: '#315da8' },
      { label: 'DOE OSTI', value: 500_000, color: '#8a4f12' },
      { label: 'Curated DSpace', value: 181, color: '#5b5f63' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('img', { name: 'Certified C2 corpus by source' }),
    ).toBeInTheDocument();
    const table = canvas.getByRole('table', {
      name: 'Certified C2 corpus by source',
    });
    await expect(
      within(table).getByRole('rowheader', { name: 'Curated DSpace' }),
    ).toBeInTheDocument();
  },
};

export const UnevenAndLongLabels: Story = {
  args: {
    caption: 'Uneven source distribution with long labels',
    segments: [
      {
        label:
          'Data.gov retained federal research metadata with an intentionally long source label',
        value: 999_999,
        color: '#315da8',
      },
      {
        label: 'Curated repository authority records',
        value: 1,
        color: '#5b5f63',
      },
    ],
  },
};

export const Empty: Story = {
  args: { caption: 'No indexed research objects', segments: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('img', { name: 'No indexed research objects' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('table', { name: 'No indexed research objects' }),
    ).toBeInTheDocument();
  },
};

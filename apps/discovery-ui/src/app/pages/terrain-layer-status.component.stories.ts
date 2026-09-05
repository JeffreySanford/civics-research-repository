import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import { TerrainLayerStatusComponent } from './terrain-layer-status.component';

const meta: Meta<TerrainLayerStatusComponent> = {
  title: 'Accessibility/Maps/USGS terrain status',
  component: TerrainLayerStatusComponent,
  parameters: { layout: 'padded' },
  args: {
    sourceUrl:
      'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
  },
};

export default meta;
type Story = StoryObj<TerrainLayerStatusComponent>;

export const Available: Story = {
  args: {
    available: true,
    visible: false,
    mode: 'hillshade',
    status: 'idle',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('USGS 3DEP terrain is available and currently off.'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: 'USGS 3DEP' }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('3DEPElevation/ImageServer'),
    );
  },
};

export const Loading: Story = {
  args: {
    available: true,
    visible: true,
    mode: 'tinted',
    status: 'loading',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Loading USGS 3DEP Tinted elevation terrain imagery',
    );
  },
};

export const Ready: Story = {
  args: {
    available: true,
    visible: true,
    mode: 'slope',
    status: 'ready',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'USGS 3DEP terrain is on — Slope',
    );
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'contextual imagery only',
    );
  },
};

export const Error: Story = {
  args: {
    available: true,
    visible: true,
    mode: 'hillshade',
    status: 'error',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'USGS 3DEP terrain imagery is unavailable',
    );
  },
};

export const Unsupported: Story = {
  args: {
    available: false,
    visible: false,
    mode: 'hillshade',
    status: 'idle',
    sourceUrl: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'USGS 3DEP terrain is not available',
    );
    await expect(canvas.queryByRole('link')).not.toBeInTheDocument();
  },
};

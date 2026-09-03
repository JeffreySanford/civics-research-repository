import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { expect, within } from 'storybook/test';
import { HomePage } from './home-page';

const meta: Meta<HomePage> = {
  title: 'Accessibility/Landing page',
  component: HomePage,
  decorators: [applicationConfig({ providers: [provideRouter([])] })],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<HomePage>;

export const CurrentPlatformOverview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('heading', {
        level: 1,
        name: 'Discover, connect, and map public research at federal scale',
      }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', {
        name: '1,000,181 searchable records',
      }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('500K Data.gov + 500K DOE OSTI'),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('link', { name: 'Search the research corpus' }),
    ).toHaveAttribute('href', '/discovery');
    await expect(
      canvas.getByRole('link', { name: 'Explore research maps' }),
    ).toHaveAttribute('href', '/maps');
    await expect(
      canvas.getByRole('navigation', {
        name: 'Operator and engineering tools',
      }),
    ).toBeInTheDocument();
  },
};

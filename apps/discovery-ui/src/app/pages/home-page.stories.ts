import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { expect, within } from 'storybook/test';
import { HomePage } from './home-page';

@Component({
  standalone: true,
  template: '',
})
class StoryRoutePlaceholder {}

const meta: Meta<HomePage> = {
  title: 'Accessibility/Landing page',
  component: HomePage,
  decorators: [
    applicationConfig({
      providers: [
        provideRouter([
          { path: '', component: StoryRoutePlaceholder },
          { path: '**', component: StoryRoutePlaceholder },
        ]),
      ],
    }),
  ],
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

    const searchLink = canvas.getByRole('link', {
      name: 'Search the research corpus',
    });
    const mapsLink = canvas.getByRole('link', {
      name: 'Explore research maps',
    });
    await expect(searchLink.getAttribute('href')).toBe('/discovery');
    await expect(mapsLink.getAttribute('href')).toBe('/maps');

    await expect(
      canvas.getByRole('navigation', {
        name: 'Operator and engineering tools',
      }),
    ).toBeInTheDocument();
  },
};

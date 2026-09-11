import type { Preview } from '@storybook/angular';

const preview: Preview = {
  parameters: {
    a11y: {
      test: 'error',
      options: {
        runOnly: {
          type: 'tag',
          values: [
            'wcag2a',
            'wcag2aa',
            'wcag21a',
            'wcag21aa',
            'wcag22aa',
            'best-practice',
          ],
        },
      },
    },
  },
};

export default preview;

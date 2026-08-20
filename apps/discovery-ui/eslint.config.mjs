import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    /**
     * Accessibility rules that hold at lint time rather than at review time.
     *
     * The audit that prompted these found nothing wrong: no img without alt, no unlabelled icon,
     * because there are no img elements yet and every mat-icon is aria-hidden. That is a fact about
     * today, and the first image anyone adds is the one nobody checks. axe covers rendered output,
     * but only for states a test happens to render; the linter covers every template unconditionally
     * and says so before the code runs.
     */
    rules: {
      // 1.1.1 Non-text Content. An image without alt is either unlabelled or undeclared as
      // decorative, and the fix differs, so the rule requires the author to say which.
      '@angular-eslint/template/alt-text': 'error',
      // 2.4.4 Link Purpose and 4.1.2 Name, Role, Value: a control with no discernible text is
      // announced as its role and nothing else.
      '@angular-eslint/template/elements-content': 'error',
      // 1.3.1 Info and Relationships.
      '@angular-eslint/template/label-has-associated-control': 'error',
      '@angular-eslint/template/table-scope': 'error',
      // 4.1.2: an aria attribute pointing at nothing is worse than no attribute, because it
      // replaces the name the element would otherwise have had.
      '@angular-eslint/template/valid-aria': 'error',
      '@angular-eslint/template/role-has-required-aria': 'error',
      // 2.1.1 Keyboard: a click handler on a non-interactive element is reachable by mouse only.
      '@angular-eslint/template/click-events-have-key-events': 'error',
      '@angular-eslint/template/interactive-supports-focus': 'error',
      // 2.4.3 Focus Order: a positive tabindex reorders the page for keyboard users only, so the
      // focus order stops matching the visual one.
      '@angular-eslint/template/no-positive-tabindex': 'error',
    },
  },
];

// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      // eslint ignore globs here
    ],
  },
  {
    rules: {
      // overrides
      'no-cond-assign': 'off',
      'jsdoc/require-returns-check': 'off',
      'no-template-curly-in-string': 'off',
    },
  },
)

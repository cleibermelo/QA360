// https://github.com/angular-eslint/angular-eslint
// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = tseslint.config(
	{
		// folder patterns to ignore
		ignores: ['src/generated-code/**/*', 'src/custom-code/samples/**/*'],
	},
	{
		files: ['**/*.ts'],
		// typescript file patterns to ignore
		ignores: ['**/*.generated.*.ts'],
		extends: [
			eslint.configs.recommended,
			...tseslint.configs.recommended,
			...tseslint.configs.stylistic,
			...angular.configs.tsRecommended,
			prettierRecommended
		],
		processor: angular.processInlineTemplates,
		rules: {
			'@angular-eslint/directive-selector': [
				'error',
				{
					type: 'attribute',
					prefix: 'app',
					style: 'camelCase'
				}
			],
			'@angular-eslint/component-selector': [
				'error',
				{
					type: 'element',
					prefix: 'app',
					style: 'kebab-case'
				}
			],
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					args: 'all',
					argsIgnorePattern: '^_',
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true
				}
			],
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'property',
					format: ['strictCamelCase'],
					filter: {
						// you can expand this regex to add more allowed names: ^(Property-Name-One|Property-Name-Two)$
						regex: '^_*|(Content-Type|Cache-Control)$',
						match: false
					}
				}
			],
			// https://typescript-eslint.io/rules/member-ordering/
			"@typescript-eslint/member-ordering": [
				"error",
				{
					"default": [
						"decorated-field",
						"public-field",
						"field",
						"constructor",
						"public-method",
						"method",
						"private-method"
					]
				}
			],
			'max-len': [
				'error',
				{
					code: 140,
					ignorePattern: '^import\\s.+\\sfrom\\s.+;$',
				}
			],
			'prettier/prettier': ['error', {}]
		}
	},
	{
		files: ['**/*.html'],
		// html file patterns to ignore
		ignores: [],
		extends: [
			...angular.configs.templateRecommended,
			...angular.configs.templateAccessibility,
			prettierRecommended
		],
		rules: {

			'@angular-eslint/template/click-events-have-key-events': 'warn',
			'@angular-eslint/template/interactive-supports-focus': 'warn',
			'prettier/prettier': [
				'error',
				{
					parser: 'angular'
				}
			]
		}
	}
);

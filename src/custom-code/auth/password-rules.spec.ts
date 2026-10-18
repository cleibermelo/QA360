import { validateNewPassword } from './password-rules';

describe('validateNewPassword', () => {
	it('accepts matching passwords of the minimum length', () => {
		expect(validateNewPassword('abcdef', 'abcdef', 6)).toBeNull();
	});

	it('rejects a password shorter than the minimum', () => {
		expect(validateNewPassword('abcde', 'abcde', 6)).toBe('SetPassword_ErrorTooShort');
	});

	it('rejects a confirmation that differs', () => {
		expect(validateNewPassword('abcdef', 'abcdeg', 6)).toBe('SetPassword_ErrorMismatch');
	});

	it('reports the length problem before the mismatch', () => {
		expect(validateNewPassword('abc', 'abd', 6)).toBe('SetPassword_ErrorTooShort');
	});
});

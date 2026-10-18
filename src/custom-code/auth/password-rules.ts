/** Translation key (without `RES_`) of the first problem found, or null when the new password is acceptable. */
export const validateNewPassword = (password: string, confirmation: string, minLength: number): string | null => {
	if (password.length < minLength) {
		return 'SetPassword_ErrorTooShort';
	}
	if (password !== confirmation) {
		return 'SetPassword_ErrorMismatch';
	}
	return null;
};

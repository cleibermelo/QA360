/** Remembers, until the user chooses a password, that the session came from an invite link. */
const PENDING_PASSWORD_KEY = 'qa360.password-pending';

/** The invite link carries `type=invite` in the URL fragment; auth-js has no event that tells it apart from a normal sign-in. */
export const isInviteHash = (hash: string): boolean =>
	new URLSearchParams(hash.replace(/^#/, '')).get('type') === 'invite';

/** Must run before the Supabase client is created: the client removes the fragment while reading the session from it. */
export const rememberInviteFromUrl = (hash: string = location.hash): void => {
	if (isInviteHash(hash)) {
		sessionStorage.setItem(PENDING_PASSWORD_KEY, '1');
	}
};

export const isPasswordPending = (): boolean => sessionStorage.getItem(PENDING_PASSWORD_KEY) === '1';

export const clearPasswordPending = (): void => sessionStorage.removeItem(PENDING_PASSWORD_KEY);

/** Kind of screen being opened. */
export type AccessArea = 'login' | 'set-password' | 'logout' | 'private';

export interface SessionState {
	loading: boolean;
	signedIn: boolean;
	passwordPending: boolean;
}

export type AccessDecision = { kind: 'wait' } | { kind: 'allow' } | { kind: 'redirect'; to: string };

export const LOGIN_PATH = '/login';
export const SET_PASSWORD_PATH = '/set-password';
export const HOME_PATH = '/dashboard';

/** Which kind of screen a path (relative to the app base, e.g. "/records") belongs to. */
export const areaOfPath = (path: string): AccessArea => {
	const first = path.split(/[?#]/)[0].split('/').filter(Boolean)[0];
	return first === 'login' || first === 'set-password' || first === 'logout' ? first : 'private';
};

/** Decides whether the screen can be shown. Nothing is decided while the session is still unknown. */
export const resolveAccess = (state: SessionState, area: AccessArea): AccessDecision => {
	if (state.loading) {
		return { kind: 'wait' };
	}
	if (area === 'logout') {
		return { kind: 'allow' };
	}
	if (!state.signedIn) {
		return area === 'login' ? { kind: 'allow' } : { kind: 'redirect', to: LOGIN_PATH };
	}
	if (state.passwordPending) {
		return area === 'set-password' ? { kind: 'allow' } : { kind: 'redirect', to: SET_PASSWORD_PATH };
	}
	return area === 'private' ? { kind: 'allow' } : { kind: 'redirect', to: HOME_PATH };
};

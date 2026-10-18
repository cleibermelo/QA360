import { AccessArea, areaOfPath, resolveAccess, SessionState } from './access';

describe('resolveAccess', () => {
	const state = (changes: Partial<SessionState> = {}): SessionState => ({
		loading: false,
		signedIn: false,
		passwordPending: false,
		...changes
	});
	const areas: AccessArea[] = ['login', 'set-password', 'logout', 'private'];

	it('waits without redirecting while the session is unknown', () => {
		for (const area of areas) {
			expect(resolveAccess(state({ loading: true }), area)).toEqual({ kind: 'wait' });
			expect(resolveAccess(state({ loading: true, signedIn: true }), area)).toEqual({ kind: 'wait' });
		}
	});

	it('without a session, sends every protected screen to the login', () => {
		expect(resolveAccess(state(), 'private')).toEqual({ kind: 'redirect', to: '/login' });
		expect(resolveAccess(state(), 'set-password')).toEqual({ kind: 'redirect', to: '/login' });
		expect(resolveAccess(state(), 'login')).toEqual({ kind: 'allow' });
	});

	it('with a session, sends the login screen to the dashboard', () => {
		expect(resolveAccess(state({ signedIn: true }), 'login')).toEqual({ kind: 'redirect', to: '/dashboard' });
		expect(resolveAccess(state({ signedIn: true }), 'private')).toEqual({ kind: 'allow' });
	});

	it('with a session but no password yet, only allows the set-password screen', () => {
		const invited = state({ signedIn: true, passwordPending: true });
		expect(resolveAccess(invited, 'set-password')).toEqual({ kind: 'allow' });
		expect(resolveAccess(invited, 'private')).toEqual({ kind: 'redirect', to: '/set-password' });
		expect(resolveAccess(invited, 'login')).toEqual({ kind: 'redirect', to: '/set-password' });
	});

	it('does not offer set-password once the password is defined', () => {
		expect(resolveAccess(state({ signedIn: true }), 'set-password')).toEqual({
			kind: 'redirect',
			to: '/dashboard'
		});
	});

	it('always allows the logout screen', () => {
		expect(resolveAccess(state(), 'logout')).toEqual({ kind: 'allow' });
		expect(resolveAccess(state({ signedIn: true }), 'logout')).toEqual({ kind: 'allow' });
	});
});

describe('areaOfPath', () => {
	it('classifies the paths of the app', () => {
		expect(areaOfPath('/login')).toBe('login');
		expect(areaOfPath('/login?x=1')).toBe('login');
		expect(areaOfPath('/set-password')).toBe('set-password');
		expect(areaOfPath('/logout')).toBe('logout');
		expect(areaOfPath('/records')).toBe('private');
		expect(areaOfPath('/')).toBe('private');
	});
});

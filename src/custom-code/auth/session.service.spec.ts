import { TestBed } from '@angular/core/testing';
import { AuthApiError, AuthRetryableFetchError, Session, SupabaseClient } from '@supabase/supabase-js';
import { isInviteHash, isPasswordPending, rememberInviteFromUrl } from './invite-link';
import { SessionService } from './session.service';
import { SUPABASE_CLIENT } from './supabase.client';

type Listener = (event: string, session: Session | null) => void;

/** A stand-in for the Supabase client: no network, and the test decides what auth-js reports. */
const createFakeClient = () => {
	let listener: Listener = () => undefined;
	const unsubscribe = jasmine.createSpy('unsubscribe');
	const auth = {
		onAuthStateChange: jasmine.createSpy('onAuthStateChange').and.callFake((callback: Listener) => {
			listener = callback;
			return { data: { subscription: { unsubscribe } } };
		}),
		getSession: jasmine.createSpy('getSession').and.resolveTo({ data: { session: null } }),
		signInWithPassword: jasmine.createSpy('signInWithPassword').and.resolveTo({ error: null }),
		updateUser: jasmine.createSpy('updateUser').and.resolveTo({ error: null }),
		signOut: jasmine.createSpy('signOut').and.resolveTo({ error: null })
	};
	return {
		client: { auth } as unknown as SupabaseClient,
		auth,
		unsubscribe,
		emit: (event: string, session: Session | null) => listener(event, session)
	};
};

const sessionOf = (id: string) => ({ user: { id } }) as unknown as Session;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('invite link', () => {
	beforeEach(() => sessionStorage.clear());

	it('recognizes the invite type in the URL fragment', () => {
		expect(isInviteHash('#access_token=a&refresh_token=b&type=invite')).toBeTrue();
		expect(isInviteHash('#access_token=a&type=recovery')).toBeFalse();
		expect(isInviteHash('')).toBeFalse();
	});

	it('remembers only invites', () => {
		rememberInviteFromUrl('#type=magiclink');
		expect(isPasswordPending()).toBeFalse();
		rememberInviteFromUrl('#type=invite');
		expect(isPasswordPending()).toBeTrue();
	});
});

describe('SessionService', () => {
	let fake: ReturnType<typeof createFakeClient>;

	const create = (): SessionService => {
		TestBed.configureTestingModule({ providers: [{ provide: SUPABASE_CLIENT, useValue: fake.client }] });
		return TestBed.inject(SessionService);
	};

	beforeEach(() => {
		sessionStorage.clear();
		fake = createFakeClient();
	});

	it('is loading until the stored session is read, then has no user', async () => {
		const service = create();
		expect(service.loading()).toBeTrue();
		await settle();
		expect(service.loading()).toBeFalse();
		expect(service.user()).toBeNull();
		expect(service.signedIn()).toBeFalse();
	});

	it('restores an existing session', async () => {
		fake.auth.getSession.and.resolveTo({ data: { session: sessionOf('u1') } });
		const service = create();
		await settle();
		expect(service.userId()).toBe('u1');
		expect(service.signedIn()).toBeTrue();
	});

	it('follows sign-in and sign-out events', async () => {
		const service = create();
		await settle();
		fake.emit('SIGNED_IN', sessionOf('u2'));
		expect(service.userId()).toBe('u2');
		fake.emit('SIGNED_OUT', null);
		expect(service.user()).toBeNull();
	});

	it('keeps the same user id when the token is refreshed', async () => {
		const service = create();
		await settle();
		fake.emit('SIGNED_IN', sessionOf('u3'));
		fake.emit('TOKEN_REFRESHED', sessionOf('u3'));
		expect(service.userId()).toBe('u3');
	});

	it('cancels the subscription when destroyed', () => {
		create();
		TestBed.resetTestingModule();
		expect(fake.unsubscribe).toHaveBeenCalled();
	});

	it('marks the password as pending after an invite until it is set', async () => {
		rememberInviteFromUrl('#type=invite');
		fake.auth.getSession.and.resolveTo({ data: { session: sessionOf('u4') } });
		const service = create();
		await settle();
		expect(service.passwordPending()).toBeTrue();
		expect(await service.setPassword('a-valid-password')).toEqual({ ok: true });
		expect(service.passwordPending()).toBeFalse();
		expect(isPasswordPending()).toBeFalse();
		expect(fake.auth.updateUser).toHaveBeenCalledWith({ password: 'a-valid-password' });
	});

	it('drops the pending password mark when there is no session (expired link)', async () => {
		rememberInviteFromUrl('#type=invite');
		const service = create();
		await settle();
		expect(service.passwordPending()).toBeFalse();
	});

	it('signs in with the credentials and does not tell a wrong password from an unknown user', async () => {
		const service = create();
		expect(await service.signIn('a@example.test', 'secret')).toEqual({ ok: true });
		expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@example.test', password: 'secret' });

		fake.auth.signInWithPassword.and.resolveTo({
			error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')
		});
		expect(await service.signIn('a@example.test', 'wrong')).toEqual({ ok: false, reason: 'credentials' });
	});

	it('reports an unavailable service apart from invalid credentials', async () => {
		const service = create();
		fake.auth.signInWithPassword.and.resolveTo({ error: new AuthRetryableFetchError('network', 0) });
		expect(await service.signIn('a@example.test', 'secret')).toEqual({ ok: false, reason: 'unavailable' });
	});

	it('reports a weak password on update', async () => {
		const service = create();
		fake.auth.updateUser.and.resolveTo({ error: new AuthApiError('weak', 422, 'weak_password') });
		expect(await service.setPassword('abc')).toEqual({ ok: false, reason: 'weak' });
	});

	it('clears the user on sign-out', async () => {
		fake.auth.getSession.and.resolveTo({ data: { session: sessionOf('u5') } });
		const service = create();
		await settle();
		await service.signOut();
		expect(fake.auth.signOut).toHaveBeenCalled();
		expect(service.user()).toBeNull();
	});
});

import { computed, DestroyRef, inject, Injectable, Signal, signal } from '@angular/core';
import { isAuthRetryableFetchError, User } from '@supabase/supabase-js';
import { clearPasswordPending, isPasswordPending } from './invite-link';
import { SUPABASE_CLIENT } from './supabase.client';

export type SignInResult = { ok: true } | { ok: false; reason: 'credentials' | 'unavailable' };
export type SetPasswordResult = { ok: true } | { ok: false; reason: 'weak' | 'unavailable' | 'generic' };

/** Current user and loading state, kept in sync with the Supabase session. */
@Injectable({ providedIn: 'root' })
export class SessionService {
	readonly user: Signal<User | null>;
	/** True until the stored session has been read. */
	readonly loading: Signal<boolean>;
	/** True when the user arrived by an invite link and has not chosen a password yet. */
	readonly passwordPending: Signal<boolean>;
	readonly signedIn: Signal<boolean>;
	/** Changes only when another user signs in, not when the token is refreshed. */
	readonly userId: Signal<string | null>;

	private readonly client = inject(SUPABASE_CLIENT);
	private readonly currentUser = signal<User | null>(null);
	private readonly isLoading = signal(true);
	private readonly isPasswordPending = signal(isPasswordPending());

	constructor() {
		this.user = this.currentUser.asReadonly();
		this.loading = this.isLoading.asReadonly();
		this.passwordPending = this.isPasswordPending.asReadonly();
		this.signedIn = computed(() => this.currentUser() !== null);
		this.userId = computed(() => this.currentUser()?.id ?? null);

		// The callback must not call Supabase itself, or auth-js deadlocks.
		const { data } = this.client.auth.onAuthStateChange((event, session) => {
			this.currentUser.set(session?.user ?? null);
			if (event === 'SIGNED_OUT') {
				this.clearPending();
			}
		});
		inject(DestroyRef).onDestroy(() => data.subscription.unsubscribe());

		void this.client.auth
			.getSession()
			.then(({ data: { session } }) => {
				this.currentUser.set(session?.user ?? null);
				if (!session) {
					this.clearPending();
				}
			})
			.catch(() => this.currentUser.set(null))
			.finally(() => this.isLoading.set(false));
	}

	/** Credentials errors are not told apart (wrong password and unknown e-mail look the same). */
	async signIn(email: string, password: string): Promise<SignInResult> {
		const { error } = await this.client.auth.signInWithPassword({ email, password });
		if (!error) {
			return { ok: true };
		}
		return { ok: false, reason: isAuthRetryableFetchError(error) ? 'unavailable' : 'credentials' };
	}

	async setPassword(password: string): Promise<SetPasswordResult> {
		const { error } = await this.client.auth.updateUser({ password });
		if (!error) {
			this.clearPending();
			return { ok: true };
		}
		if (error.code === 'weak_password') {
			return { ok: false, reason: 'weak' };
		}
		return { ok: false, reason: isAuthRetryableFetchError(error) ? 'unavailable' : 'generic' };
	}

	async signOut(): Promise<void> {
		await this.client.auth.signOut();
		this.currentUser.set(null);
		this.clearPending();
	}

	private clearPending(): void {
		clearPasswordPending();
		this.isPasswordPending.set(false);
	}
}

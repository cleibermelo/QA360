import {
	effect,
	EnvironmentProviders,
	inject,
	provideEnvironmentInitializer,
	Signal,
	untracked,
	WritableSignal
} from '@angular/core';
import { Router } from '@angular/router';
import { AUTH_PROVIDER_TOKEN, USER } from '@polygon/core';
import { User } from '@supabase/supabase-js';
import { LOGIN_PATH } from './access';
import { SessionService } from './session.service';

/** The parts of Polygon's identity service that the bridge replaces. */
interface PatchableIdentity {
	isEnabled: WritableSignal<boolean>;
	/** Set by Polygon when its own startup is done; patching earlier would start the Cegid ID login. */
	isInitialized: Signal<boolean>;
	isAuthenticated: () => boolean;
	getClaims: () => Record<string, string>;
	getToken: () => string;
	login: () => void;
	logout: () => void;
}

/** What the user area shows for the signed-in account. */
export const claimsOf = (user: User | null): Record<string, string> => {
	if (!user) {
		return {};
	}
	const email = user.email ?? '';
	const name = String(user.user_metadata?.['full_name'] ?? user.user_metadata?.['name'] ?? email.split('@')[0]);
	return { sub: user.id, name, display_name: name, email };
};

/**
 * Makes the Polygon user area (avatar menu) work with the Supabase session: it shows the account name and
 * e-mail, and its "Logout" button signs out. Polygon only shows that button when its identity service is enabled,
 * and its own provider talks to Cegid ID, so the provider is adapted here once Polygon has started.
 */
export const provideUserAreaIdentity = (): EnvironmentProviders =>
	provideEnvironmentInitializer(() => {
		const identity = inject(AUTH_PROVIDER_TOKEN) as unknown as PatchableIdentity;
		const session = inject(SessionService);
		const router = inject(Router);
		const user = inject(USER);
		let patched = false;

		effect(() => {
			if (!identity.isInitialized() || patched) {
				return;
			}
			patched = true;
			identity.isAuthenticated = () => session.signedIn();
			identity.getClaims = () => claimsOf(session.user());
			// Supabase calls do not go through Angular's HttpClient, so no token is sent to other requests.
			identity.getToken = () => '';
			identity.login = () => void router.navigateByUrl(LOGIN_PATH);
			identity.logout = () => void router.navigateByUrl('/logout');
			identity.isEnabled.set(true);
		});

		// Reads the name and e-mail again whenever another account signs in or out.
		effect(() => {
			session.userId();
			untracked(() => user.refreshUserData$.next());
		});
	});

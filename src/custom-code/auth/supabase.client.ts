import { inject, InjectionToken } from '@angular/core';
import { EnvironmentSettings } from '@polygon/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { rememberInviteFromUrl } from './invite-link';

/** The `supabase` block of assets/environment.json; the key is the public (anon) one, never the service role key. */
export interface SupabaseEnvironment {
	url: string;
	anonKey: string;
	/** Same value as the minimum password length of the Supabase project. */
	passwordMinLength?: number;
}

export const DEFAULT_PASSWORD_MIN_LENGTH = 6;

/** Reads the Supabase settings from the Polygon environment file. */
export const readSupabaseEnvironment = (settings: EnvironmentSettings): SupabaseEnvironment => {
	const supabase = (settings as EnvironmentSettings & { supabase?: Partial<SupabaseEnvironment> }).supabase;
	if (!supabase?.url || !supabase.anonKey) {
		throw new Error(
			'Supabase is not configured: set "supabase.url" and "supabase.anonKey" in assets/environment.json.'
		);
	}
	return { passwordMinLength: DEFAULT_PASSWORD_MIN_LENGTH, ...supabase } as SupabaseEnvironment;
};

/** The only Supabase client of the app, shared by the session and the data repository. */
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT', {
	providedIn: 'root',
	factory: () => {
		const { url, anonKey } = readSupabaseEnvironment(inject(EnvironmentSettings));
		rememberInviteFromUrl();
		return createClient(url, anonKey);
	}
});

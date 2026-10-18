import { User } from '@supabase/supabase-js';
import { claimsOf } from './polygon-user-area';

describe('claimsOf', () => {
	const userWith = (changes: Partial<User>): User =>
		({ id: 'u1', email: 'someone@example.test', user_metadata: {}, ...changes }) as User;

	it('has no claims without a user', () => {
		expect(claimsOf(null)).toEqual({});
	});

	it('uses the e-mail name part when the account has no name', () => {
		expect(claimsOf(userWith({}))).toEqual({
			sub: 'u1',
			name: 'someone',
			display_name: 'someone',
			email: 'someone@example.test'
		});
	});

	it('prefers the name in the user metadata', () => {
		const claims = claimsOf(userWith({ user_metadata: { full_name: 'Some One' } }));
		expect(claims).toEqual(jasmine.objectContaining({ name: 'Some One' }));
	});
});

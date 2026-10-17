import { Injectable } from '@angular/core';
import { createClient, PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { CoverageEntry, CoverageInput, Team, TeamInput, TestType } from '../domain/models';
import { SEED_TEST_TYPES } from '../domain/seed';
import { CoverageRepository, CoverageSnapshot, EntryKey, RepositoryError } from './coverage.repository';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase.config';

/** Postgres code for a unique constraint violation. */
const UNIQUE_VIOLATION = '23505';

/** Canonical order of the test types (the table has no order column). Unknown keys go last. */
const TEST_TYPE_ORDER = SEED_TEST_TYPES.map((t) => t.key);
const typeRank = (key: string): number => {
	const index = TEST_TYPE_ORDER.indexOf(key);
	return index === -1 ? TEST_TYPE_ORDER.length : index;
};
const byTypeOrder = (a: string, b: string): number => typeRank(a) - typeRank(b) || a.localeCompare(b);

interface TeamRow {
	id: string;
	name: string;
	applications: {
		id: string;
		name: string;
		application_test_types: { test_type_key: string }[];
	}[];
}

interface EntryRow {
	application_id: string;
	test_type_key: string;
	year: number;
	month: number;
	percent: number;
	note: string;
	updated_at: string;
	coverage_history: { changed_at: string; previous_percent: number; previous_note: string }[];
}

/** Stores the data in the Supabase project (tables in supabase/schema.sql). */
@Injectable()
export class SupabaseCoverageRepository extends CoverageRepository {
	// No login yet, so no session to keep or refresh.
	private readonly client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});

	async load(): Promise<CoverageSnapshot> {
		const [types, teams, entries] = await Promise.all([
			this.client.from('test_types').select('key, active'),
			this.client.from('teams').select('id, name, applications(id, name, application_test_types(test_type_key))'),
			this.client
				.from('coverage_entries')
				.select(
					'application_id, test_type_key, year, month, percent, note, updated_at, ' +
						'coverage_history(changed_at, previous_percent, previous_note)'
				)
		]);
		for (const result of [types, teams, entries]) {
			if (result.error) {
				throw new RepositoryError('Error_Load');
			}
		}

		const mappedTeams: Team[] = (teams.data as unknown as TeamRow[])
			.map((t) => ({
				id: t.id,
				name: t.name,
				applications: t.applications
					.map((a) => ({
						id: a.id,
						name: a.name,
						testTypeKeys: a.application_test_types.map((x) => x.test_type_key).sort(byTypeOrder)
					}))
					.sort((a, b) => a.name.localeCompare(b.name))
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		// An entry knows only its application; the team comes from where that application lives.
		const teamOfApplication = new Map(mappedTeams.flatMap((t) => t.applications.map((a) => [a.id, t.id] as const)));
		const mappedEntries: CoverageEntry[] = (entries.data as unknown as EntryRow[])
			.filter((e) => teamOfApplication.has(e.application_id))
			.map((e) => ({
				teamId: teamOfApplication.get(e.application_id),
				applicationId: e.application_id,
				testTypeKey: e.test_type_key,
				year: e.year,
				month: e.month,
				percent: Number(e.percent),
				note: e.note,
				updatedAt: e.updated_at,
				history: e.coverage_history
					.map((h) => ({
						changedAt: h.changed_at,
						previousPercent: Number(h.previous_percent),
						previousNote: h.previous_note
					}))
					.sort((a, b) => a.changedAt.localeCompare(b.changedAt))
			}));

		const testTypes: TestType[] = (types.data as TestType[])
			.map((t) => ({ key: t.key, active: t.active }))
			.sort((a, b) => byTypeOrder(a.key, b.key));
		return { testTypes, teams: mappedTeams, entries: mappedEntries };
	}

	/** Several requests in sequence: if one fails halfway, reloading shows what was actually saved. */
	async saveTeam(input: TeamInput, existing: Team | undefined): Promise<string> {
		const name = input.name.trim();
		let teamId = existing?.id;
		if (teamId) {
			this.check(await this.client.from('teams').update({ name }).eq('id', teamId));
		} else {
			const { data, error } = await this.client.from('teams').insert({ name }).select('id').single();
			this.check({ error });
			teamId = data.id as string;
		}

		const keptIds = input.applications.filter((a) => a.id).map((a) => a.id);
		const removedIds = (existing?.applications ?? []).map((a) => a.id).filter((id) => !keptIds.includes(id));
		if (removedIds.length > 0) {
			this.check(await this.client.from('applications').delete().in('id', removedIds));
		}

		for (const item of input.applications) {
			let applicationId = item.id;
			if (applicationId) {
				this.check(
					await this.client.from('applications').update({ name: item.name.trim() }).eq('id', applicationId)
				);
			} else {
				const { data, error } = await this.client
					.from('applications')
					.insert({ team_id: teamId, name: item.name.trim() })
					.select('id')
					.single();
				this.check({ error });
				applicationId = data.id as string;
			}
			this.check(
				await this.client
					.from('application_test_types')
					.delete()
					.eq('application_id', applicationId)
					.not('test_type_key', 'in', `(${item.testTypeKeys.join(',')})`)
			);
			this.check(
				await this.client.from('application_test_types').upsert(
					item.testTypeKeys.map((key) => ({ application_id: applicationId, test_type_key: key })),
					{ onConflict: 'application_id,test_type_key', ignoreDuplicates: true }
				)
			);
		}
		return teamId;
	}

	async removeTeam(teamId: string): Promise<void> {
		this.check(await this.client.from('teams').delete().eq('id', teamId));
	}

	/** One request, so all entries are saved or none. The database trigger records changed values in the history. */
	async saveEntries(inputs: CoverageInput[]): Promise<void> {
		if (inputs.length === 0) {
			return;
		}
		this.check(
			await this.client.from('coverage_entries').upsert(
				inputs.map((input) => ({
					application_id: input.applicationId,
					test_type_key: input.testTypeKey,
					year: input.year,
					month: input.month,
					percent: input.percent,
					note: input.note.trim()
				})),
				{ onConflict: 'application_id,test_type_key,year,month' }
			)
		);
	}

	async removeEntry(key: EntryKey): Promise<void> {
		this.check(
			await this.client
				.from('coverage_entries')
				.delete()
				.eq('application_id', key.applicationId)
				.eq('test_type_key', key.testTypeKey)
				.eq('year', key.year)
				.eq('month', key.month)
		);
	}

	/** Turns a Supabase error into a `RepositoryError` with a message the user can act on. */
	private check(result: { error: PostgrestError | null }): void {
		if (result.error) {
			throw new RepositoryError(result.error.code === UNIQUE_VIOLATION ? 'Error_Duplicate' : 'Error_Save');
		}
	}
}

import { Injectable } from '@angular/core';
import { CoverageEntry, CoverageInput, Team, TeamInput } from '../domain/models';
import { upsertEntry } from '../domain/rules';
import { SEED_TEAMS, SEED_TEST_TYPES } from '../domain/seed';
import { CoverageRepository, CoverageSnapshot, EntryKey } from './coverage.repository';

/** Keeps the data in memory, with the same behavior as the database. Used by the unit tests. */
@Injectable()
export class InMemoryCoverageRepository extends CoverageRepository {
	private teams: Team[] = structuredClone(SEED_TEAMS);
	private entries: CoverageEntry[] = [];
	private sequence = 0;

	async load(): Promise<CoverageSnapshot> {
		return structuredClone({ testTypes: SEED_TEST_TYPES, teams: this.teams, entries: this.entries });
	}

	async saveTeam(input: TeamInput, existing: Team | undefined): Promise<string> {
		const teamId = existing?.id ?? `team-${++this.sequence}`;
		const applications = input.applications.map((a) => ({
			id: a.id ?? `application-${++this.sequence}`,
			name: a.name.trim(),
			testTypeKeys: a.testTypeKeys
		}));
		const team: Team = {
			id: teamId,
			name: input.name.trim(),
			ownerName: (input.ownerName ?? '').trim(),
			applications
		};
		const removedIds = (existing?.applications ?? [])
			.map((a) => a.id)
			.filter((id) => !applications.some((a) => a.id === id));

		this.teams = existing ? this.teams.map((t) => (t.id === teamId ? team : t)) : [...this.teams, team];
		this.entries = this.entries.filter((e) => !(e.teamId === teamId && removedIds.includes(e.applicationId)));
		return teamId;
	}

	async removeTeam(teamId: string): Promise<void> {
		this.teams = this.teams.filter((t) => t.id !== teamId);
		this.entries = this.entries.filter((e) => e.teamId !== teamId);
	}

	async saveEntries(inputs: CoverageInput[]): Promise<void> {
		this.entries = inputs.reduce((entries, input) => upsertEntry(entries, input).entries, this.entries);
	}

	async removeEntry(key: EntryKey): Promise<void> {
		this.entries = this.entries.filter(
			(e) =>
				!(
					e.applicationId === key.applicationId &&
					e.testTypeKey === key.testTypeKey &&
					e.year === key.year &&
					e.month === key.month
				)
		);
	}
}

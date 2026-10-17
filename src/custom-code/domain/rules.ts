import { CoverageEntry, CoverageInput, Team, TeamApplication, TestType } from './models';

// Validation rules. Each returns the i18n key of the error message (shown translated), or null when valid.

/** Case- and whitespace-insensitive form used to compare names. */
const normalize = (value: string): string => value.trim().toLocaleLowerCase();

export const validateTeamName = (name: string, teams: Team[], ignoreTeamId?: string): string | null => {
	if (!name.trim()) {
		return 'Validation_TeamNameRequired';
	}
	const duplicated = teams.some((t) => t.id !== ignoreTeamId && normalize(t.name) === normalize(name));
	return duplicated ? 'Validation_TeamNameDuplicate' : null;
};

/** A team needs at least one application (each one already has at least one test type). */
export const validateTeamApplications = (applications: unknown[]): string | null =>
	applications.length === 0 ? 'Validation_TeamApplicationRequired' : null;

/** `applications` are the other applications of the same team; `ignoreApplicationId` skips the one being edited. */
export const validateApplicationName = (
	name: string,
	applications: TeamApplication[],
	ignoreApplicationId?: string
): string | null => {
	if (!name.trim()) {
		return 'Validation_ApplicationNameRequired';
	}
	const duplicated = applications.some((a) => a.id !== ignoreApplicationId && normalize(a.name) === normalize(name));
	return duplicated ? 'Validation_ApplicationNameDuplicate' : null;
};

/** The other team that already has an application with this name, if any: an application cannot be in two teams. */
export const findApplicationOwner = (name: string, teams: Team[], teamId?: string): Team | undefined =>
	teams.find((t) => t.id !== teamId && t.applications.some((a) => normalize(a.name) === normalize(name)));

/** An application must be covered by at least one test type to be saved. */
export const validateApplicationTestTypes = (testTypeKeys: string[]): string | null =>
	testTypeKeys.length === 0 ? 'Validation_TestTypeRequired' : null;

/** Accepts 0 to 100 with at most two decimal places. */
export const validatePercent = (value: number | null | undefined): string | null => {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return 'Validation_PercentRequired';
	}
	if (value < 0 || value > 100) {
		return 'Validation_PercentRange';
	}
	if (Math.round(value * 100) / 100 !== value) {
		return 'Validation_PercentDecimals';
	}
	return null;
};

/** Coverage can only be recorded for an active test type that is enabled on the application. */
export const validateEntryTestType = (
	application: TeamApplication | undefined,
	testTypeKey: string,
	testTypes: TestType[]
): string | null => {
	if (!application) {
		return 'Validation_SelectApplication';
	}
	if (!testTypeKey) {
		return 'Validation_SelectTestType';
	}
	if (!application.testTypeKeys.includes(testTypeKey)) {
		return 'Validation_TestTypeNotEnabled';
	}
	const testType = testTypes.find((t) => t.key === testTypeKey);
	return testType?.active ? null : 'Validation_TestTypeInactive';
};

/** Finds the entry for the same application, test type and month, if any. */
export const findEntry = (
	entries: CoverageEntry[],
	key: Pick<CoverageInput, 'teamId' | 'applicationId' | 'testTypeKey' | 'year' | 'month'>
): CoverageEntry | undefined =>
	entries.find(
		(e) =>
			e.teamId === key.teamId &&
			e.applicationId === key.applicationId &&
			e.testTypeKey === key.testTypeKey &&
			e.year === key.year &&
			e.month === key.month
	);

export type UpsertOutcome = 'created' | 'updated' | 'unchanged';

/**
 * Keeps a single current value per application, test type and month.
 * Overwriting an entry pushes the previous value (with the change date) into its history.
 * Pure: returns a new list and never mutates the given one.
 */
export const upsertEntry = (
	entries: CoverageEntry[],
	input: CoverageInput,
	now: Date = new Date()
): { entries: CoverageEntry[]; outcome: UpsertOutcome } => {
	const existing = findEntry(entries, input);
	const note = input.note.trim();

	if (!existing) {
		const created: CoverageEntry = { ...input, note, updatedAt: now.toISOString(), history: [] };
		return { entries: [...entries, created], outcome: 'created' };
	}
	// Re-saving the same value is a no-op so it does not pollute the history.
	if (existing.percent === input.percent && existing.note === note) {
		return { entries, outcome: 'unchanged' };
	}
	const updated: CoverageEntry = {
		...existing,
		percent: input.percent,
		note,
		updatedAt: now.toISOString(),
		history: [
			...existing.history,
			{ changedAt: now.toISOString(), previousPercent: existing.percent, previousNote: existing.note }
		]
	};
	return { entries: entries.map((e) => (e === existing ? updated : e)), outcome: 'updated' };
};

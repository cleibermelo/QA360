/** A kind of automated test (unit, integration, ...). Its name and unit are translated by `key`. */
export interface TestType {
	key: string;
	/** Inactive types are hidden from the selects, but existing history stays visible. */
	active: boolean;
}

/** A product or microservice that a team maintains and tracks coverage for. */
export interface TeamApplication {
	id: string;
	name: string;
	/** Keys of the test types this application is covered by. */
	testTypeKeys: string[];
}

export interface Team {
	id: string;
	name: string;
	applications: TeamApplication[];
}

/** A previous value of a coverage entry, kept when the entry is overwritten. */
export interface CoverageHistoryItem {
	changedAt: string;
	previousPercent: number;
	previousNote: string;
}

/** The current coverage value for one application, test type and month. */
export interface CoverageEntry {
	teamId: string;
	applicationId: string;
	testTypeKey: string;
	year: number;
	/** 1 to 12. */
	month: number;
	percent: number;
	note: string;
	updatedAt: string;
	history: CoverageHistoryItem[];
}

/** What the user types in when recording coverage. */
export interface CoverageInput {
	teamId: string;
	applicationId: string;
	testTypeKey: string;
	year: number;
	month: number;
	percent: number;
	note: string;
}

/** Everything the team form edits at once. Without `teamId` a new team is created. */
export interface TeamInput {
	teamId?: string;
	name: string;
	/** Applications with an `id` are existing ones that keep their history; the others are new. */
	applications: { id?: string; name: string; testTypeKeys: string[] }[];
}

/** Formats a period as "MM/YYYY". */
export const formatPeriod = (year: number, month: number): string => `${String(month).padStart(2, '0')}/${year}`;

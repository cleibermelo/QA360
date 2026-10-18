/** What the Dashboard filters hold; kept across the page reload that follows a language change. */
export interface DashboardFilters {
	teamId: string;
	applicationIds: string[];
	typeKey: string;
	from: string;
	to: string;
	valuesOpen: boolean;
}

const STORAGE_KEY = 'qa360.dashboard-filters';

let describeFilters: (() => DashboardFilters) | null = null;

/** Filters saved right before a language reload, read once when the app starts again. */
let pendingFilters: DashboardFilters | null = (() => {
	const raw = sessionStorage.getItem(STORAGE_KEY);
	sessionStorage.removeItem(STORAGE_KEY);
	try {
		return raw ? (JSON.parse(raw) as DashboardFilters) : null;
	} catch {
		return null;
	}
})();

/** The Dashboard registers how to read its filters while it is open; the returned function unregisters it. */
export const registerDashboardFilters = (describe: () => DashboardFilters): (() => void) => {
	describeFilters = describe;
	return () => {
		if (describeFilters === describe) {
			describeFilters = null;
		}
	};
};

/** Called before the page reloads for a language change; does nothing when the Dashboard is not open. */
export const saveDashboardFiltersForReload = (): void => {
	if (describeFilters) {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(describeFilters()));
	}
};

/** The filters to bring back after a language reload, or null. They are handed out only once. */
export const takePendingDashboardFilters = (): DashboardFilters | null => {
	const filters = pendingFilters;
	pendingFilters = null;
	return filters;
};

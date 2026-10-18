import { inject, Injectable, signal } from '@angular/core';
import { CoverageStore } from '../../data/coverage.store';
import {
	DashboardFilters,
	registerDashboardFilters,
	takePendingDashboardFilters
} from '../../shared/dashboard-filters-memory';

/**
 * The Dashboard filters, kept outside the page so they survive going to another menu and coming back.
 * The team lives in the store; the rest is held here. They are also kept across the reload of a language change.
 */
@Injectable({ providedIn: 'root' })
export class DashboardFiltersState {
	readonly applicationIds = signal<string[]>([]);
	readonly typeKey = signal('');
	/** Month range (`YYYY-MM`); the chart is only built once both ends are filled. */
	readonly from = signal('');
	readonly to = signal('');
	/** The table with the plotted values starts collapsed. */
	readonly valuesOpen = signal(false);

	private readonly store = inject(CoverageStore);

	constructor() {
		registerDashboardFilters(() => this.snapshot());
		const pending = takePendingDashboardFilters();
		if (pending) {
			void this.store.loaded.then(() => this.restore(pending));
		}
	}

	/** Back to the empty state: no team, applications, test type or period, and the values table closed. */
	reset(): void {
		this.store.selectedTeamId.set('');
		this.applicationIds.set([]);
		this.typeKey.set('');
		this.from.set('');
		this.to.set('');
		this.valuesOpen.set(false);
	}

	private snapshot(): DashboardFilters {
		return {
			teamId: this.store.selectedTeamId(),
			applicationIds: this.applicationIds(),
			typeKey: this.typeKey(),
			from: this.from(),
			to: this.to(),
			valuesOpen: this.valuesOpen()
		};
	}

	private restore(filters: DashboardFilters): void {
		this.store.selectTeam(filters.teamId);
		this.applicationIds.set(filters.applicationIds);
		this.typeKey.set(filters.typeKey);
		this.from.set(filters.from);
		this.to.set(filters.to);
		this.valuesOpen.set(filters.valuesOpen);
	}
}

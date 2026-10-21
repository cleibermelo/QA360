import { Injectable, signal } from '@angular/core';

/**
 * The SonarCloud filters, kept outside the page so they survive going to another menu and coming back.
 * A page reload (or the Reset button) clears them.
 */
@Injectable({ providedIn: 'root' })
export class SonarcloudFiltersState {
	readonly projectKeys = signal<string[]>([]);
	// null follows the data of the selected projects; a string (even an empty one) is what the user typed.
	readonly pickedFrom = signal<string | null>(null);
	readonly pickedTo = signal<string | null>(null);
	/** Whether the latest-measurement table is open; it starts open. */
	readonly tableOpen = signal(true);

	/** Back to the empty state: no projects, the period follows the data again and the table is open. */
	reset(): void {
		this.projectKeys.set([]);
		this.pickedFrom.set(null);
		this.pickedTo.set(null);
		this.tableOpen.set(true);
	}
}

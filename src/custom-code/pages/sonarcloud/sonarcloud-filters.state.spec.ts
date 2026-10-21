import { TestBed } from '@angular/core/testing';
import { SonarcloudFiltersState } from './sonarcloud-filters.state';

describe('SonarcloudFiltersState', () => {
	it('keeps the filters between page instances and goes back to following the data on reset', () => {
		const state = TestBed.inject(SonarcloudFiltersState);
		state.projectKeys.set(['a', 'b']);
		state.pickedFrom.set('2026-01');
		state.tableOpen.set(false);

		expect(TestBed.inject(SonarcloudFiltersState).projectKeys()).toEqual(['a', 'b']);
		expect(TestBed.inject(SonarcloudFiltersState).tableOpen()).toBeFalse();

		state.reset();
		expect(state.projectKeys()).toEqual([]);
		expect(state.tableOpen()).toBeTrue();
		expect(state.pickedFrom()).toBeNull();
		expect(state.pickedTo()).toBeNull();
	});
});

import { TestBed } from '@angular/core/testing';
import { SonarcloudFiltersState } from './sonarcloud-filters.state';

describe('SonarcloudFiltersState', () => {
	it('keeps the filters between page instances and goes back to following the data on reset', () => {
		const state = TestBed.inject(SonarcloudFiltersState);
		state.projectKeys.set(['a', 'b']);
		state.pickedFrom.set('2026-01');
		state.pickedMonth.set('');

		expect(TestBed.inject(SonarcloudFiltersState).projectKeys()).toEqual(['a', 'b']);

		state.reset();
		expect(state.projectKeys()).toEqual([]);
		expect(state.pickedFrom()).toBeNull();
		expect(state.pickedTo()).toBeNull();
		expect(state.pickedMonth()).toBeNull();
	});
});

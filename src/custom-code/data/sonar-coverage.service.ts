import { inject, Injectable } from '@angular/core';
import { SUPABASE_CLIENT } from '../auth/supabase.client';
import { MonthlyCoverage } from '../domain/sonar-coverage';

export interface SonarProject {
	key: string;
	name: string;
}

interface CoverageRow {
	month: string;
	coverage: number | string | null;
	measured_on: string;
}

const toMonthly = (row: CoverageRow): MonthlyCoverage => ({
	month: row.month,
	coverage: Number(row.coverage),
	measuredOn: row.measured_on
});

/** Reads the coverage that the sync job stored in `sonar_coverage_monthly` (the app never writes it). */
@Injectable({ providedIn: 'root' })
export class SonarCoverageService {
	private readonly client = inject(SUPABASE_CLIENT);

	/** Projects that have at least one stored month, by name. */
	async listProjects(): Promise<SonarProject[]> {
		const { data, error } = await this.client
			.from('sonar_projects')
			.select('project_key, project_name')
			.order('project_name');
		if (error) {
			throw new Error(error.message);
		}
		return (data ?? []).map((p) => ({ key: p.project_key, name: p.project_name ?? p.project_key }));
	}

	/** The stored value of exactly this month (`YYYY-MM-01`), or null; other months are never used instead. */
	async getMonth(projectKey: string, month: string): Promise<MonthlyCoverage | null> {
		const { data, error } = await this.client
			.from('sonar_coverage_monthly')
			.select('month, coverage, measured_on')
			.eq('project_key', projectKey)
			.eq('month', month)
			.maybeSingle();
		if (error) {
			throw new Error(error.message);
		}
		return data ? toMonthly(data as CoverageRow) : null;
	}

	/** All stored months of the project, oldest first. */
	async getHistory(projectKey: string): Promise<MonthlyCoverage[]> {
		const { data, error } = await this.client
			.from('sonar_coverage_monthly')
			.select('month, coverage, measured_on')
			.eq('project_key', projectKey)
			.order('month');
		if (error) {
			throw new Error(error.message);
		}
		return (data as CoverageRow[]).map(toMonthly);
	}
}

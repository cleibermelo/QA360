// Collects the unit test coverage of the SonarCloud projects and stores the last value of each month in Supabase.
//
// Run:  node --experimental-strip-types scripts/sonar-sync/sync.mjs [--dry-run] [--only=key1,key2]
// Env:  SONAR_TOKEN, SONAR_ORG, SONAR_PROJECT_FILTER (optional), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Without the two SUPABASE_* variables (or with --dry-run) nothing is written: the rows are only counted and listed.

import { lastValuePerMonth } from '../../src/custom-code/domain/sonar-coverage.ts';
import { createSonarClient, SonarError } from './sonar-client.mjs';
import { createSupabaseWriter } from './supabase-writer.mjs';

const fail = (message) => {
	console.error(`ERRO: ${message}`);
	process.exit(1);
};

const args = process.argv.slice(2);
const only = args
	.find((a) => a.startsWith('--only='))
	?.slice('--only='.length)
	.split(',')
	.map((k) => k.trim())
	.filter(Boolean);

const token = process.env['SONAR_TOKEN'];
const organization = process.env['SONAR_ORG'];
const filter = (process.env['SONAR_PROJECT_FILTER'] ?? '').trim();
const supabaseUrl = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!token) {
	fail('defina SONAR_TOKEN.');
}
if (!organization) {
	fail('defina SONAR_ORG.');
}
if (Boolean(supabaseUrl) !== Boolean(serviceRoleKey)) {
	fail('defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY juntos (ou nenhum, para um teste sem gravação).');
}
const dryRun = args.includes('--dry-run') || !supabaseUrl;

const sonar = createSonarClient({ token });
const writer = dryRun ? undefined : createSupabaseWriter({ url: supabaseUrl, serviceRoleKey });

const stats = { processed: 0, skipped: 0, warnings: 0, errors: 0, rows: 0 };

try {
	let projects = await sonar.listProjects({ organization, filter });
	if (only?.length) {
		projects = projects.filter((p) => only.includes(p.key));
	}
	console.log(
		`${projects.length} projeto(s) na organização ${organization}${filter ? ` (filtro "${filter}")` : ''}.` +
			(dryRun ? ' Modo de teste: nada será gravado.' : '')
	);

	for (const project of projects) {
		try {
			const monthly = lastValuePerMonth(await sonar.getCoverageHistory(project.key));
			if (monthly.length === 0) {
				stats.skipped++;
				console.log(`PULADO  ${project.key}: sem análise de cobertura.`);
				continue;
			}
			const updatedAt = new Date().toISOString();
			const rows = monthly.map((m) => ({
				project_key: project.key,
				project_name: project.name,
				month: m.month,
				coverage: m.coverage,
				measured_on: m.measuredOn,
				updated_at: updatedAt
			}));
			await writer?.upsert(rows);
			stats.processed++;
			stats.rows += rows.length;
			const last = monthly[monthly.length - 1];
			console.log(
				`OK      ${project.key}: ${rows.length} mês(es); último ${last.month.slice(0, 7)} = ${last.coverage}% (${last.measuredOn}).`
			);
		} catch (error) {
			// A rejected token affects every project, so it stops the run; other errors only count against this project.
			if (error instanceof SonarError && error.status === 401) {
				throw error;
			}
			// Projects can be listed yet refuse to share their history (private, no "Browse" permission): not a failure of the job.
			if (error instanceof SonarError && (error.status === 403 || error.status === 404)) {
				stats.warnings++;
				console.warn(`AVISO   ${project.key}: ${error.message}`);
				continue;
			}
			stats.errors++;
			console.error(`ERRO    ${project.key}: ${error.message}`);
		}
	}
} catch (error) {
	stats.errors++;
	console.error(`ERRO: ${error.message}`);
}

console.log(
	`Resumo: ${stats.processed} processado(s), ${stats.skipped} pulado(s), ${stats.warnings} aviso(s), ${stats.errors} erro(s), ` +
		`${stats.rows} linha(s) ${dryRun ? 'calculada(s)' : 'gravada(s)'}.`
);
process.exit(stats.errors > 0 ? 1 : 0);

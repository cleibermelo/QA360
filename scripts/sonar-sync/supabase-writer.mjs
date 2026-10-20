// Writes rows to Supabase through PostgREST with the service role key (bypasses RLS). Never use this key in the app.

const TABLE = 'sonar_coverage_monthly';
const BATCH_SIZE = 500;

/**
 * @param {{ url: string, serviceRoleKey: string, fetchImpl?: typeof fetch }} options
 */
export const createSupabaseWriter = ({ url, serviceRoleKey, fetchImpl = fetch }) => {
	const headers = {
		apikey: serviceRoleKey,
		'Content-Type': 'application/json',
		// Merge on the primary key: later runs update the current month instead of duplicating it.
		Prefer: 'resolution=merge-duplicates,return=minimal'
	};
	// Legacy service_role keys are JWTs and also go in Authorization; the newer secret keys must only be sent as apikey.
	if (serviceRoleKey.startsWith('eyJ')) {
		headers.Authorization = `Bearer ${serviceRoleKey}`;
	}
	const endpoint = `${url.replace(/\/+$/, '')}/rest/v1/${TABLE}?on_conflict=project_key,month`;

	return {
		/** @param {{ project_key: string, project_name: string, month: string, coverage: number, measured_on: string, updated_at: string }[]} rows */
		async upsert(rows) {
			for (let i = 0; i < rows.length; i += BATCH_SIZE) {
				const response = await fetchImpl(endpoint, {
					method: 'POST',
					headers,
					body: JSON.stringify(rows.slice(i, i + BATCH_SIZE))
				});
				if (!response.ok) {
					const detail = (await response.text()).slice(0, 300);
					throw new Error(`Falha ao gravar no Supabase (HTTP ${response.status}): ${detail}`);
				}
			}
		}
	};
};

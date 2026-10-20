// Minimal SonarCloud Web API client (Node 22, global fetch). The token only travels in the Authorization header.

const BASE_URL = 'https://sonarcloud.io/api';
const RETRIES = 2;

export class SonarError extends Error {
	/** @param {string} message @param {number} status HTTP status, 0 when the request itself failed. */
	constructor(message, status) {
		super(message);
		this.name = 'SonarError';
		this.status = status;
	}
}

const explain = (status, what) => {
	switch (status) {
		case 401:
			return `Token do SonarCloud inválido ou expirado (401) ao ${what}. Gere um novo token e atualize SONAR_TOKEN.`;
		case 403:
			return `Sem permissão no SonarCloud (403) ao ${what}. Confirme se o token tem acesso à organização/projeto.`;
		case 404:
			return `Não encontrado no SonarCloud (404) ao ${what}. Confira a chave da organização ou do projeto.`;
		default:
			return `Falha no SonarCloud (HTTP ${status}) ao ${what}.`;
	}
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {{ token: string, fetchImpl?: typeof fetch, retryDelayMs?: number }} options
 */
export const createSonarClient = ({ token, fetchImpl = fetch, retryDelayMs = 1000 }) => {
	// Basic auth with the token as user name and an empty password.
	const authorization = `Basic ${Buffer.from(`${token}:`).toString('base64')}`;

	const get = async (path, params, what) => {
		const url = new URL(`${BASE_URL}${path}`);
		for (const [name, value] of Object.entries(params)) {
			url.searchParams.set(name, String(value));
		}
		for (let attempt = 0; ; attempt++) {
			let response;
			try {
				response = await fetchImpl(url, {
					headers: { Authorization: authorization, Accept: 'application/json' }
				});
			} catch (error) {
				if (attempt < RETRIES) {
					await sleep(retryDelayMs * (attempt + 1));
					continue;
				}
				throw new SonarError(`Sem resposta do SonarCloud ao ${what}: ${error.message}`, 0);
			}
			if (response.ok) {
				return response.json();
			}
			if ((response.status === 429 || response.status >= 500) && attempt < RETRIES) {
				await sleep(retryDelayMs * (attempt + 1));
				continue;
			}
			throw new SonarError(explain(response.status, what), response.status);
		}
	};

	return {
		/** All projects of the organization whose name or key matches `filter` (empty means all). */
		async listProjects({ organization, filter }) {
			const projects = [];
			for (let page = 1; ; page++) {
				const params = { organization, ps: 500, p: page };
				if (filter) {
					params.q = filter;
				}
				const data = await get('/projects/search', params, 'listar os projetos');
				const components = data.components ?? [];
				projects.push(...components.map((c) => ({ key: c.key, name: c.name })));
				if (components.length === 0 || projects.length >= (data.paging?.total ?? 0)) {
					return projects;
				}
			}
		},

		/** Coverage history of one project: `[{ date, value }]`, empty when it was never analysed. */
		async getCoverageHistory(projectKey) {
			const history = [];
			for (let page = 1; ; page++) {
				const data = await get(
					'/measures/search_history',
					{ component: projectKey, metrics: 'coverage', ps: 1000, p: page },
					`ler o histórico de ${projectKey}`
				);
				const points = data.measures?.find((m) => m.metric === 'coverage')?.history ?? [];
				history.push(...points);
				if (points.length === 0 || history.length >= (data.paging?.total ?? 0)) {
					return history;
				}
			}
		}
	};
};

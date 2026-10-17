import { DatagridDataSourceStandardGetAllService, IDatagridFieldFilter, IDatagridFieldSearch } from '@polygon/qbuilder';

/** Searches only start after this many characters are typed. */
export const MIN_SEARCH_LENGTH = 2;

/** Base of the in-memory data sources: the grid search is ignored until at least two characters are typed. */
export abstract class MinSearchDataSource extends DatagridDataSourceStandardGetAllService {
	protected override mapSearchFields(search: IDatagridFieldSearch | undefined): IDatagridFieldFilter[] {
		const tooShort = (search?.value ?? '').trim().length < MIN_SEARCH_LENGTH;
		return tooShort ? [] : super.mapSearchFields(search);
	}
}

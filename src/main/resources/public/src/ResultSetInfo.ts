import * as J from "./JavaIntf";
import { NodeInfo } from "./JavaIntf";

export class ResultSetInfo {
    public results: NodeInfo[];
    public description: string;
    public prop: string;
    public timeRangeType: string;
    public node: NodeInfo;
    public page: number = 0;
    public endReached: boolean = false;
    public fuzzy: boolean;
    public caseSensitive: boolean;
    public searchText: string;

    // This will bet the root of the search regardless of whether it's a timeline or an actual search.
    public searchRoot: string;

    public searchType: string;
    public recursive: boolean;
    public sortField: string;
    public sortDir: string;
    public requirePriority: boolean;
    public requireAttachment: boolean;
    public requireDate: boolean;

    /* holds array of all parent items all the way up the tree (as far as user is authorized) */
    breadcrumbs: J.BreadcrumbInfo[];
}

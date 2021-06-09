import * as J from "./JavaIntf";

/* This class is way too 'multi-purpose'. Needs some polymorphism instead (todo-0) */
export class ResultSetInfo {
    public results: J.NodeInfo[];
    public description: string;
    public prop: string;
    public timeRangeType: string;
    public node: J.NodeInfo;
    public page: number = 0;
    public endReached: boolean = false;
    public fuzzy: boolean;
    public caseSensitive: boolean;
    public searchText: string;
    public userSearchType: string;

    public shareNodesType: string;
    public shareTarget: string;
    public accessOption: string;

    public showingFollowersOfUser: string;
    public showingFollowingOfUser: string;
}

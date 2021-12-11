import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { TabDataIntf } from "../intf/TabDataIntf";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class SearchResultSetView extends ResultSetView {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        let state: AppState = store.getState();

        let page = this.data.rsInfo.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.rsInfo.page + delta;
        }

        S.srch.search(this.data.rsInfo.node,
            this.data.rsInfo.prop,
            this.data.rsInfo.searchText,
            state,
            this.data.rsInfo.searchType,
            this.data.rsInfo.description,
            this.data.rsInfo.fuzzy,
            this.data.rsInfo.caseSensitive,
            page,
            this.data.rsInfo.recursive,
            this.data.rsInfo.sortField,
            this.data.rsInfo.sortDir,
            false,
            null);
    }
}

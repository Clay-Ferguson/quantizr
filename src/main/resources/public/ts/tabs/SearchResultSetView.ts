import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchResultSetView extends ResultSetView {

    constructor(state: AppState, data: TabDataIntf) {
        super(state, data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        let state: AppState = store.getState();

        S.srch.search(this.data.rsInfo.node,
            this.data.rsInfo.prop,
            this.data.rsInfo.searchText,
            state,
            this.data.rsInfo.userSearchType,
            this.data.rsInfo.description,
            this.data.rsInfo.fuzzy,
            this.data.rsInfo.caseSensitive,
            delta === 0 ? 0 : this.data.rsInfo.page + delta,

            // need to set this rsInfo value in various places (todo-0)
            this.data.rsInfo.recursive,
            this.data.rsInfo.sortField,
            this.data.rsInfo.sortDir,
            null);
    }
}

import { Comp } from "../comp/base/Comp";
import { TabIntf } from "../intf/TabIntf";
import { ResultSetInfo } from "../ResultSetInfo";
import { S } from "../Singletons";
import { ResultSetView } from "./ResultSetView";

export class SearchResultSetView<T extends ResultSetInfo> extends ResultSetView<T> {

    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
    }

    pageChange(delta: number): void {
        let page = this.data.props.page;
        if (delta !== null) {
            page = delta === 0 ? 0 : this.data.props.page + delta;
        }

        S.srch.search(this.data.props.node,
            this.data.props.prop,
            this.data.props.searchText,
            this.data.props.searchType,
            this.data.props.description,
            this.data.props.searchRoot,
            this.data.props.fuzzy,
            this.data.props.caseSensitive,
            page,
            this.data.props.recursive,
            this.data.props.sortField,
            this.data.props.sortDir,
            false,
            null);
    }

    extraPagingComps = (): Comp[] => {
        return null;
    }
}

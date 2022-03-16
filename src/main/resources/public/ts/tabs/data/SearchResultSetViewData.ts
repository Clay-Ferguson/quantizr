import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { ResultSetInfo } from "../../ResultSetInfo";
import { S } from "../../Singletons";
import { SearchResultSetView } from "../SearchResultSetView";

export class SearchResultSetViewData implements TabIntf {
    name = "Search";
    id = C.TAB_SEARCH;
    rsInfo = new ResultSetInfo();
    scrollPos = 0;
    props = {};
    openGraphComps = [];

    isVisible = () => S.tabUtil.resultSetHasData(C.TAB_SEARCH);
    constructView = (data: TabIntf) => new SearchResultSetView(data)
    getTabSubOptions = (state: AppState): Div => { return null; };
}

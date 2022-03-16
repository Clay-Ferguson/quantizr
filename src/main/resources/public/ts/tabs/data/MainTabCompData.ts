import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { MainTabComp } from "../MainTabComp";

export class MainTabCompData implements TabIntf {
    name = "Tree";
    id = C.TAB_MAIN;
    rsInfo = null;
    scrollPos = 0;
    props = {};
    openGraphComps = [];

    isVisible = () => true;
    constructView = (data: TabIntf) => new MainTabComp(data);

    getTabSubOptions = (state: AppState): Div => {
        return !state.isAnonUser
            ? new Div(null, { className: "tabSubOptions" }, [
                new Div("My Root", { className: "tabSubOptionsItem", onClick: () => S.nav.navHome(state) }),
                new Div("My Home", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode(":" + state.userName + ":home") }),
                new Div("My Posts", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode("~" + J.NodeType.POSTS) })
            ]) : null;
    };
}

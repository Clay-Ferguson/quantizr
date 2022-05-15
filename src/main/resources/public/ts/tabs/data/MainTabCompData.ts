import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { MainTabComp } from "../MainTabComp";

export class MainTabCompData implements TabIntf {
    name = "Quanta";
    id = C.TAB_MAIN;
    rsInfo = null;
    scrollPos = 0;
    props = {};
    openGraphComps = [];

    isVisible = (state: AppState) => true;
    constructView = (data: TabIntf) => new MainTabComp(data);

    getTabSubOptions = (state: AppState): Div => {
        return new Div(null, { className: "tabSubOptions" }, [
            !state.isAnonUser ? new Div("My Root", { className: "tabSubOptionsItem", onClick: () => S.nav.navHome(state) }) : null,
            !state.isAnonUser ? new Div("My Home", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode(":" + state.userName + ":home") }) : null,
            !state.isAnonUser ? new Div("My Posts", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode("~" + J.NodeType.POSTS) }) : null,

            // Put these directly here on main page for non-logged in users, becasue we definitely cannot expect these users to click thru to
            // the help menu to find these at least until they've signed up, but once signed up having these here becomes an annoyance.
            state.isAnonUser ? new Div("About Quanta", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode(":home") }) : null,
            state.isAnonUser ? new Div("Explore Features", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode(":features") }) : null
        ]);
    };
}

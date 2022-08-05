import { AppState } from "../../AppState";
import { CompIntf } from "../../comp/base/CompIntf";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { MainTabComp } from "../MainTabComp";

export class MainTab implements TabIntf<any> {
    name = "Quanta";
    tooltip = "Quanta Database Content Tree";
    id = C.TAB_MAIN;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];

    static inst: MainTab = null;
    constructor() {
        MainTab.inst = this;
    }

    isVisible = (state: AppState) => true;
    constructView = (data: TabIntf) => new MainTabComp(data);

    findNode = (state: AppState, nodeId: string): J.NodeInfo => {
        if (!state.node) return null;
        if (state.node.id === nodeId) return state.node;
        return state.node.children?.find(n => n.id === nodeId);
    }

    nodeDeleted = (state: AppState, nodeId: string): void => {
        if (!state.node) return;
        state.node.children = state.node.children?.filter(n => nodeId !== n.id);
    }

    replaceNode = (state: AppState, newNode: J.NodeInfo): void => {
        if (!state.node || !state.node.children) return;

        state.node.children = state.node.children.map(n => {
            return n.id === newNode.id ? newNode : n;
        });
    }

    getTabSubOptions = (state: AppState): Div => {
        return new Div(null, { className: "tabSubOptions" }, [
            !state.isAnonUser ? new AppNavLink("My Account", () => S.nav.navHome(state)) : null,
            !state.isAnonUser ? new AppNavLink("My Home", () => S.nav.openContentNode(":" + state.userName + ":home")) : null,
            !state.isAnonUser ? new AppNavLink("My Posts", () => S.nav.openContentNode("~" + J.NodeType.POSTS)) : null,
            ...this.customAnonRHSLinks(state)
        ]);
    };

    // Put these directly here on main page for non-logged in users, becasue we definitely cannot expect these users to click hru to
    // the help menu to find these at least until they've signed up, but once signed up having these here becomes an annoyance.
    customAnonRHSLinks = (state: AppState): CompIntf[] => {
        const items: CompIntf[] = [];

        // if not anon user return empty items
        if (!state.isAnonUser) return items;

        if (state.config?.rhsAnonLinks) {
            for (const menuItem of state.config.rhsAnonLinks) {
                if (menuItem.name === "separator") {
                    // items.push(new MenuItemSeparator());
                }
                else {
                    const link: string = menuItem.link;
                    let func: Function = null;

                    if (link) {
                        // allows ability to select a tab
                        if (link.startsWith("tab:")) {
                            const tab = link.substring(4);

                            /* special case for feed tab */
                            if (tab === C.TAB_FEED) {
                                func = S.nav.messagesFediverse;
                            }
                            else {
                                func = () => S.tabUtil.selectTab(tab);
                            }
                        }
                        // covers http and https
                        else if (link.startsWith("http")) {
                            func = () => window.open(link);
                        }
                        // named nodes like ":myName"
                        else {
                            func = () => S.nav.openContentNode(link);
                        }
                    }

                    items.push(new AppNavLink(menuItem.name, func));
                }
            }
        }
        return items;
    }
}

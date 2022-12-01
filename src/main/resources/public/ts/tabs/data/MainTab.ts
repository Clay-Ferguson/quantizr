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

declare const g_brandingAppName: string;

export class MainTab implements TabIntf<any> {
    name = g_brandingAppName;
    tooltip = g_brandingAppName + " Content Tree";
    id = C.TAB_MAIN;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: MainTab = null;
    constructor() {
        MainTab.inst = this;
    }

    isVisible = (ast: AppState) => true;
    constructView = (data: TabIntf) => new MainTabComp(data);

    findNode = (ast: AppState, nodeId: string): J.NodeInfo => {
        return this.findNodeRecursive(ast.node, nodeId);
    }

    // finds a node matching node with 'id' on this node or any of it's chilren
    findNodeRecursive = (node: J.NodeInfo, id: string): J.NodeInfo => {
        if (!node) return null;
        if (node.id === id) return node;
        if (node.parent?.id === id) return node.parent;
        if (node.boostedNode?.id === id) return node.boostedNode;

        if (node.children) {
            for (const n of node.children) {
                const found = this.findNodeRecursive(n, id);
                if (found) return found;
            }
        }
    }

    nodeDeleted = (ast: AppState, nodeId: string): void => {
        if (!ast.node) return;
        ast.node.children = ast.node.children?.filter(n => nodeId !== n.id);
    }

    replaceNode = (ast: AppState, newNode: J.NodeInfo): void => {
        if (!ast.node || !ast.node.children) return;

        ast.node.children = ast.node.children.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }

    getTabSubOptions = (ast: AppState): Div => {
        return new Div(null, { className: "tabSubOptions" }, [
            !ast.isAnonUser ? new AppNavLink("My Account", () => S.nav.navToMyAccntRoot(ast)) : null,
            !ast.isAnonUser ? new AppNavLink("My Home", () => S.nav.openContentNode(":" + ast.userName + ":home")) : null,
            !ast.isAnonUser ? new AppNavLink("My Posts", () => S.nav.openContentNode("~" + J.NodeType.POSTS)) : null,
            ...this.customAnonRHSLinks(ast),
            ...this.buildCustomLinks(ast, ast.config.rhsLinks)
        ]);
    };

    // Put these directly here on main page for non-logged in users, becasue we definitely cannot expect these users to click hru to
    // the help menu to find these at least until they've signed up, but once signed up having these here becomes an annoyance.
    customAnonRHSLinks = (ast: AppState): CompIntf[] => {
        // if not anon user return empty items
        if (!ast.isAnonUser) return [];

        return this.buildCustomLinks(ast, ast.config.rhsAnonLinks);
    }

    buildCustomLinks = (ast: AppState, configArray: any): CompIntf[] => {
        const items: CompIntf[] = [];

        if (configArray) {
            for (const menuItem of configArray) {
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

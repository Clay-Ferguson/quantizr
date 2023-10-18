import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { Comp } from "../../comp/base/Comp";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { MainTabComp } from "../MainTabComp";

export class MainTab implements TabIntf<any> {
    name = "Folders";
    tooltip = "Content Tree";
    id = C.TAB_MAIN;
    scrollPos = 0;
    props = {};
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: MainTab = null;
    constructor() {
        MainTab.inst = this;
    }

    isVisible = () => true;
    constructView = (data: TabIntf) => new MainTabComp(data);

    findNode = (nodeId: string, ast: AppState = null): J.NodeInfo => {
        ast = ast || getAs();
        return this.findNodeRecursive(ast.node, nodeId, 0);
    }

    // finds a node matching node with 'id' on this node or any of it's children
    findNodeRecursive = (node: J.NodeInfo, id: string, level: number): J.NodeInfo => {
        if (!node) return null;
        if (node.id === id) return node;
        if (node.boostedNode?.id === id) return node.boostedNode;

        if (node.children) {
            for (const n of node.children) {
                const found = this.findNodeRecursive(n, id, level + 1);
                if (found) return found;
            }
        }
        return null;
    }

    nodeDeleted = (ust: AppState, nodeId: string): void => {
        if (!ust.node) return;
        ust.node.children = ust.node.children?.filter(n => nodeId !== n.id);
    }

    replaceNode = (ust: AppState, newNode: J.NodeInfo): void => {
        S.edit.replaceNodeRecursive(ust.node, newNode);
    }

    processNode = (ust: AppState, func: (node: J.NodeInfo) => void): void => {
        ust.node.children?.forEach(n => func(n));
    }

    getTabSubOptions = (): Div => {
        const ast = getAs();
        return new Div(null, { className: "tabSubOptions" }, [
            !ast.isAnonUser ? new AppNavLink("My Account", S.nav.navToMyAccntRoot, "ui-my-account") : null,
            !ast.isAnonUser ? new AppNavLink("My Home", () => S.nav.openContentNode(":" + ast.userName + ":home", false)) : null,
            !ast.isAnonUser ? new AppNavLink("My Posts", () => S.nav.openContentNode("~" + J.NodeType.POSTS, false)) : null,
            ...this.customAnonRHSLinks(),
            ...S.render.buildCustomLinks(S.quanta.cfg.rhsLinks)
        ]);
    };

    // Put these directly here on main page for non-logged in users, because we definitely cannot expect these users to click hru to
    // the help menu to find these at least until they've signed up, but once signed up having these here becomes an annoyance.
    customAnonRHSLinks = (): Comp[] => {
        // if not anon user return empty items
        if (!getAs().isAnonUser) return [];

        return S.render.buildCustomLinks(S.quanta.cfg.rhsAnonLinks);
    }
}

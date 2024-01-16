import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { NodeInfo } from "../../JavaIntf";
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

    findNode = (nodeId: string, ast: AppState = null): NodeInfo => {
        ast = ast || getAs();
        return this.findNodeRecursive(ast.node, nodeId, 0);
    }

    // finds a node matching node with 'id' on this node or any of it's children
    findNodeRecursive = (node: NodeInfo, id: string, level: number): NodeInfo => {
        if (!node) return null;
        if (node.id === id) return node;

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

    replaceNode = (ust: AppState, newNode: NodeInfo): void => {
        S.edit.replaceNodeRecursive(ust.node, newNode);
    }

    processNode = (ust: AppState, func: (node: NodeInfo) => void): void => {
        ust.node.children?.forEach(n => func(n));
    }

    getTabSubOptions = (): Div => {
        const ast = getAs();
        return new Div(null, { className: "tabSubOptions" }, [
            !ast.isAnonUser ? new AppNavLink("My Account", S.nav.navToMyAccntRoot, "ui-my-account") : null,
            !ast.isAnonUser ? new AppNavLink("My Posts", () => S.nav.openContentNode("~" + J.NodeType.POSTS, false)) : null,
            ...S.render.buildCustomLinks(S.quanta.cfg.rhsLinks)
        ]);
    };
}

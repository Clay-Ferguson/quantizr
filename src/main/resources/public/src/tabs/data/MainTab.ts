import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import * as J from "../../JavaIntf";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { MainTabComp } from "../MainTabComp";

export class MainTab extends TabBase<any> {
    name = "Folders";
    tooltip = "Content Tree";
    id = C.TAB_MAIN;

    static inst: MainTab = null;
    constructor() {
        super();
        MainTab.inst = this;
    }

    isVisible() {
        return true;
    }
    constructView(data: TabBase) {
        return new MainTabComp(data);
    }

    findNode(nodeId: string, ast: AppState = null): NodeInfo {
        ast = ast || getAs();
        return this.findNodeRecursive(ast.node, (node: NodeInfo) => node.id == nodeId, 0);
    }

    findNodeByPath(path: string, ast: AppState = null): NodeInfo {
        ast = ast || getAs();
        return this.findNodeRecursive(ast.node, (node: NodeInfo) => node.path == path, 0);
    }

    // finds a node matching node with 'id' on this node or any of it's children
    findNodeRecursive(node: NodeInfo, finder: (node: NodeInfo) => boolean, level: number): NodeInfo {
        if (!node) return null;
        if (finder(node)) return node;

        if (node.children) {
            for (const n of node.children) {
                const found = this.findNodeRecursive(n, finder, level + 1);
                if (found) return found;
            }
        }
        return null;
    }

    nodeDeleted(ust: AppState, nodeId: string): void {
        if (!ust.node) return;
        ust.node.children = ust.node.children?.filter(n => nodeId !== n.id);
    }

    replaceNode(ust: AppState, newNode: NodeInfo): void {
        S.edit.replaceNodeRecursive(ust.node, newNode);
    }

    processNode(ust: AppState, func: (node: NodeInfo) => void): void {
        ust.node.children?.forEach(n => func(n));
    }

    getTabSubOptions(): Div {
        const ast = getAs();
        return new Div(null, { className: "tabSubOptions" }, [
            !ast.isAnonUser ? new AppNavLink("My Account", S.nav.navToMyAccntRoot, "ui-my-account") : null,
            !ast.isAnonUser ? new AppNavLink("My Posts", () => S.nav.openContentNode("~" + J.NodeType.POSTS, false)) : null,
            !ast.isAnonUser ? new AppNavLink("My Notes", () => S.nav.openContentNode("~" + J.NodeType.NOTES, false)) : null,
            ...S.render.buildCustomLinks(S.quanta.cfg.rhsLinks)
        ]);
    }
}

import { getAs } from "../../AppContext";
import { Comp } from "../../comp/base/Comp";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { IconButton } from "../../comp/core/IconButton";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import * as J from "../../JavaIntf";
import { PrincipalName } from "../../JavaIntf";
import { S } from "../../Singletons";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { NodeCompContent } from "./NodeCompContent";
import { NodeCompRowHeader } from "./NodeCompRowHeader";

export class NodeCompMainNode extends Div {

    constructor(public tabData: TabBase<any>) {
        super(null, {
            id: C.TAB_MAIN + getAs().node.id
            // WARNING: Leave this tabIndex here. it's required for focsing/scrolling
            // tabIndex: "-1"
        });
    }

    override preRender(): boolean | null {
        const ast = getAs();
        if (ast.cutCopyOp === "cut" && ast.nodesToMove && ast.nodesToMove.find(id => id === ast.node.id)) {
            this.children = [new Div("You've cut this node. Navigate to another folder to paste it.", { className: "pageNodeCutMessage" })];
            return true;
        }

        if (!ast.node) {
            this.children = null;
            return false;
        }

        const focusNode = S.nodeUtil.getHighlightedNode();
        const selected: boolean = (focusNode && focusNode.id === ast.node.id);
        this.attribs.className = (selected ? "activeRowMain" : "inactiveRowMain") + " ui-tree-node-top";

        if (S.render.enableRowFading && S.render.fadeInId === ast.node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            this.attribs.className += " fadeInRowBkgClz";
            S.quanta.fadeStartTime = new Date().getTime();
        }

        this.attribs[C.NODE_ID_ATTR] = ast.node.id;
        this.attribs.onClick = S.nav._clickTreeNode;
        let header: Comp = null;
        let jumpButton: Comp = null;
        const type = S.plugin.getType(ast.node.type);

        let allowHeader: boolean = false;
        // special case, if node is owned by admin and we're not admin, never show header
        if (!C.ALLOW_ADMIN_NODE_HEADERS && ast.node.owner === PrincipalName.ADMIN && ast.userName !== PrincipalName.ADMIN) {
            // leave allowHeader false
        }
        else {
            allowHeader = S.util.showMetaData(ast, ast.node) && (type == null || type?.getAllowRowHeader())
        }

        if (allowHeader) {
            const showJumpButton = this.tabData.id !== C.TAB_MAIN;
            header = new NodeCompRowHeader(ast.node, true, true, this.tabData, showJumpButton, this.tabData.id, 1, 1, false);
        }
        else {
            const targetId = S.props.getPropStr(J.NodeProp.TARGET_ID, ast.node);
            if (targetId) {
                jumpButton = new IconButton("fa-arrow-right", null, {
                    onClick: () => S.view.jumpToId(targetId),
                    title: "Jump to the Node"
                }, "btn-secondary float-end");
            }
        }

        // if editMode is on, an this isn't the page root node
        if (ast.userPrefs.editMode) {
            S.render.setNodeDropHandler(this.attribs, ast.node);
        }

        this.children = [
            S.render.renderLinkLabel(ast.node.id),
            header,
            new NodeCompButtonBar(ast.node, false, 0, false, null, null, this.tabData),
            new Clearfix(),
            jumpButton,
            new NodeCompContent(ast.node, this.tabData, false, true, this.tabData.id, null, true, null),
            S.render.renderLinks(ast.node, this.tabData)
        ];

        return true;
    }
}

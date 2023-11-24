import { getAs } from "../../AppContext";
import { Comp } from "../../comp/base/Comp";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { IconButton } from "../../comp/core/IconButton";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { NodeCompButtonBar } from "./NodeCompButtonBar";
import { NodeCompContent } from "./NodeCompContent";
import { NodeCompRow } from "./NodeCompRow";
import { NodeCompRowHeader } from "./NodeCompRowHeader";

export class NodeCompMainNode extends Div {

    constructor(public tabData: TabIntf<any>) {
        super(null, {
            id: C.TAB_MAIN + getAs().node.id
            // WARNING: Leave this tabIndex here. it's required for focsing/scrolling
            // tabIndex: "-1"
        });

        const ast = getAs();
        const type = S.plugin.getType(J.NodeType.NONE);

        /* If we're in edit mode allow dragging. Note nodes with subOrdinals can't be dragged */
        if ((!type || type.subOrdinal() === -1) && ast.userPrefs.editMode && !ast.editNode) {
            S.domUtil.setNodeDragHandler(this.attribs, ast.node.id)
        }
    }

    override preRender = (): boolean => {
        const ast = getAs();
        const node = ast.node;

        if (ast.nodesToMove && ast.nodesToMove.find(id => id === node.id)) {
            this.setChildren([new Div("You've cut this node. Navigate to another folder to paste it.", { className: "pageNodeCutMessage" })]);
            return true;
        }

        if (!node) {
            this.setChildren(null);
            return false;
        }

        const focusNode = S.nodeUtil.getHighlightedNode();
        const selected: boolean = (focusNode && focusNode.id === node.id);
        this.attribs.className = (selected ? "activeRowMain" : "inactiveRowMain") + " ui-tree-node-top";

        if (S.render.enableRowFading && S.render.fadeInId === node.id && S.render.allowFadeInId) {
            S.render.fadeInId = null;
            S.render.allowFadeInId = false;
            this.attribs.className += " fadeInRowBkgClz";
            S.quanta.fadeStartTime = new Date().getTime();
        }

        this.attribs[C.NODE_ID_ATTR] = node.id;
        this.attribs.onClick = S.nav.clickTreeNode;

        let header: Comp = null;
        let jumpButton: Comp = null;
        const type = S.plugin.getType(node.type);

        let allowHeader: boolean = false;
        // special case, if node is owned by admin and we're not admin, never show header
        if (!C.ALLOW_ADMIN_NODE_HEADERS && node.owner === J.PrincipalName.ADMIN && ast.userName !== J.PrincipalName.ADMIN) {
            // leave allowHeader false
        }
        else {
            allowHeader = S.util.showMetaData(ast, node) && (type == null || type?.getAllowRowHeader())
        }

        if (allowHeader && !node.boostedNode) {
            const allowDelete = this.tabData.id !== C.TAB_DOCUMENT;
            const showJumpButton = this.tabData.id !== C.TAB_MAIN;
            header = new NodeCompRowHeader(null, node, true, true, this.tabData, showJumpButton, true, false, allowDelete, this.tabData.id);
        }
        else {
            const targetId = S.props.getPropStr(J.NodeProp.TARGET_ID, node);
            if (targetId) {
                jumpButton = new IconButton("fa-arrow-right", null, {
                    onClick: () => S.view.jumpToId(targetId),
                    title: "Jump to the Node"
                }, "btn-secondary float-end");
            }
        }

        let boostComp: NodeCompRow = null;
        if (node.boostedNode) {
            // console.log("BOOST TARGET: " + S.util.prettyPrint(n.boostedNode));
            const type = S.plugin.getType(node.boostedNode.type);
            boostComp = new NodeCompRow(node.boostedNode, this.tabData, type, 0, 0, 0, 0, false, false, true, false, true, null, true);
        }

        // if editMode is on, an this isn't the page root node
        if (ast.userPrefs.editMode) {
            S.render.setNodeDropHandler(this.attribs, node);
        }

        const buttonBar = new NodeCompButtonBar(node, false, 0, false, null, null);

        this.setChildren([
            S.render.renderBoostHeader(node, true),
            S.render.renderLinkLabel(node.id),
            header,
            buttonBar,
            new Clearfix(),
            jumpButton,
            new NodeCompContent(node, this.tabData, false, true, this.tabData.id, null, true, false, null),
            boostComp,
            S.render.renderLinks(node)
        ]);

        return true;
    }
}

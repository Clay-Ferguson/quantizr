import { getAs } from "../../AppContext";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { Icon } from "../../comp/core/Icon";
import { Img } from "../../comp/core/Img";
import { Span } from "../../comp/core/Span";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { NodeActionType } from "../../intf/TypeIntf";
import * as J from "../../JavaIntf";
import { NodeInfo, NodeType, PrincipalName } from "../../JavaIntf";
import { S } from "../../Singletons";
import { Comp } from "../base/Comp";
import { Button } from "../core/Button";
import { SpanHtml } from "../core/SpanHtml";
import { NodeCompContent } from "./NodeCompContent";

export class NodeCompRowHeader extends Comp {
    constructor(private node: NodeInfo, private allowAvatars: boolean, private isMainTree: boolean,
        public tabData: TabBase<any>, private jumpButton: boolean,
        private prefix: string, private idx: number, indentLevel: number, isTableCell: boolean) {
        super();

        const ast = getAs();
        this.attribs.className = (!isTableCell && tabData.id === C.TAB_MAIN && ast.userPrefs.editMode && S.util.showMetaData(ast, this.node)) ? //
            (indentLevel <= 1 && this.idx == 1 ? "rowHeaderEditFirst" : "rowHeaderEdit") : "rowHeader";
    }

    override preRender(): boolean | null {
        const ast = getAs();
        const allowWideViewIcons = !ast.mobileMode || S.quanta.isLandscapeOrientation();
        let displayName = this.node.displayName || this.node.owner;
        const isMine = S.props.isMine(this.node);
        const children = [];
        let avatarImg: Img = null;
        const type = S.plugin.getType(this.node.type);

        // we always enable showInfo even on Tree Tab, so that we can have anonymous users comming
        // to a shared tree link and they can see whose node it is rather than seeing just content
        // on the page that's confusing who it came from or what it is.
        const showInfo = S.util.showMetaData(ast, this.node) || this.tabData.id === C.TAB_FEED || this.tabData.id === C.TAB_THREAD || this.tabData.id === C.TAB_REPLIES;

        if (showInfo && this.allowAvatars && this.node.owner !== PrincipalName.ADMIN) {
            avatarImg = S.render.makeHeaderAvatar(this.node);
            if (avatarImg) {
                children.push(avatarImg);
            }
        }

        const priorityVal = S.props.getPropStr(J.NodeProp.PRIORITY, this.node);
        const priority = (priorityVal && priorityVal !== "0") ? "P" + priorityVal : "";

        // now that we have this stuff visible by default on all nodes, we don't want users to need to
        // see 'admin' on all admin nodes. too noisy
        if (showInfo && this.node.owner && this.node.owner !== "?" && this.node.owner !== PrincipalName.ADMIN) {
            if (this.node.transferFromId) {
                displayName = "PENDING XFER -> " + displayName;
            }

            children.push(new SpanHtml(displayName, {
                className: (this.node.transferFromId ? "transferPending" : (isMine ? "createdByMe" : "createdByOther")),
                title: "Show Profile:\n\n" + this.node.owner,
                [C.USER_ID_ATTR]: this.node.ownerId,
                onClick: S.nav._clickToOpenUserProfile
            }));
        }

        const sigIcon: Icon = S.render.getSignatureIcon(this.node);
        if (sigIcon) {
            children.push(sigIcon);
        }

        if (S.props.isEncrypted(this.node)) {
            children.push(new Icon({
                className: "fa fa-lock fa-lg lockIcon mediumMarginRight",
                title: "Node is Encrypted."
            }));
        }
        const editInsertAllowed = S.props.isWritableByMe(this.node);

        if (!ast.isAdminUser && showInfo && editInsertAllowed) {
            const iconProps = {
                title: "Reply to this Post",
                className: "fa fa-reply fa-lg rowHeaderIcon",
                [C.NODE_ID_ATTR]: this.node.id,
                onClick: S.edit._replyToNode
            }
            children.push(new Icon(iconProps));
        }

        if (showInfo) {
            let youLiked: boolean = false;
            let likeDisplay: string = null;
            if (this.node.likes) {
                youLiked = !!this.node.likes.find(u => u === ast.userName);
                likeDisplay = "Liked by " + this.node.likes.length;
                if (youLiked) {
                    likeDisplay += " (including You)";
                }
            }

            if (!ast.isAnonUser && allowWideViewIcons) {
                if (ast.mobileMode) {
                    // for now let's not have tts on mobile.
                }
                else {
                    if (S.speech.ttsSupported()) {
                        children.push(new Icon({
                            className: "fa fa-volume-high fa-lg rowHeaderIcon",
                            title: "Speech-to-Text (Read Aloud)",
                            onMouseOver: () => { S.quanta.selectedForTts = window.getSelection().toString(); },
                            onMouseOut: () => { S.quanta.selectedForTts = null; },
                            [C.DOM_ID_ATTR]: this._getContentDomId(),
                            onClick: S.nav._ttsClick
                        }));
                    }
                }
            }
        }

        if (this.jumpButton) {
            // if not on main tab or feed tab show a jump to node icon
            if (this.tabData.id !== C.TAB_MAIN) {
                children.push(new Icon({
                    title: "Jump To Node",
                    className: "fa fa-arrow-right fa-lg rowHeaderIcon",
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.nav._clickSearchNode
                }));
            }
        }

        if (showInfo && priority) {
            children.push(new Span(priority, {
                className: "mediumMarginRight priorityTag" + priorityVal
            }));
        }

        const floatUpperRightDiv: Div = new Div(null, {
            className: "float-end floatRightHeaderDiv"
        });

        if (showInfo && ast.isAdminUser) {
            floatUpperRightDiv.addChild(new Span(`[${this.node.ordinal}]`, { className: "marginRight" }));
        }

        if (showInfo && this.node.timeAgo) {
            floatUpperRightDiv.addChild(new Span(this.node.timeAgo, {
                className: "lastModifiedTime",
                title: "Last Modified: " + S.util.formatDateTime(new Date(this.node.lastModified))
            }));
        }

        // for node type of NONE, don't show the type icon
        if (type && type.getTypeName() !== NodeType.NONE) {
            const iconClass = type.getIconClass();
            if (showInfo && iconClass) {
                floatUpperRightDiv.addChild(new Icon({
                    className: iconClass + (type.schemaOrg ? " microMarginRight" : " marginRight"),
                    title: "Node Type: " + type.getName()
                }));

                if (type.schemaOrg) {
                    floatUpperRightDiv.addChild(new Span(type.getName(), { className: "marginRight" }));
                }
            }
        }

        if (showInfo) {
            if (this.node.name) {
                floatUpperRightDiv.addChild(new Span(this.node.name, {
                    className: "nodeNameDisp",
                    title: "Node name (Click to copy link to clipboard)",
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.nav._copyNodeNameToClipboard
                }));
            }
        }

        const unpublished = S.props.getPropStr(J.NodeProp.UNPUBLISHED, this.node);
        const unpublishedIcon = unpublished ? new Icon({
            className: "fa fa-eye-slash fa-lg sharingIcon marginRight",
            title: "Node is Unpublished\n\nWill not appear in feed"
        }) : null;

        if (showInfo) {
            // If node is shared to public we just show the globe icon and not the rest of the shares that may be present.
            if (S.props.isPublic(this.node)) {
                const appendNode = S.props.isPublicWritable(this.node) ? "Anyone can reply" : "No Replies Allowed";
                floatUpperRightDiv.addChildren([
                    new Icon({
                        className: "fa fa-globe fa-lg sharingIcon marginRight",
                        title: "Node is Public\n(" + appendNode + ")"
                    }),
                    unpublishedIcon
                ]);
            }
            // Show all the share names
            else if (S.props.isShared(this.node)) {
                const shareComps = S.nodeUtil.getSharingNames(this.node, null);
                floatUpperRightDiv.addChildren([
                    new Span(null, {
                        className: "rowHeaderSharingNames"
                    }, [
                        new Icon({
                            className: "fa fa-envelope fa-lg sharingIcon"
                        }),
                        ...shareComps
                    ]),
                    unpublishedIcon
                ]);
            }
        }

        let editingAllowed = S.edit.isEditAllowed(this.node);
        let deleteAllowed = false;
        let editableNode = true;

        if (ast.isAdminUser) {
            editingAllowed = true;
            editableNode = true;
            deleteAllowed = true;
        }
        else if (type) {
            if (editingAllowed) {
                editingAllowed = type.allowAction(NodeActionType.editNode, this.node);
                editableNode = type.allowAction(NodeActionType.editNode, this.node);
                deleteAllowed = type.allowAction(NodeActionType.delete, this.node);
            }
        }

        let jumpButton: Icon = null;
        let insertAllowed = true;

        // if this is our own account node, we can always leave insertAllowed=true
        if (ast.userProfile?.userNodeId !== this.node.id) {
            if (type) {
                insertAllowed = ast.isAdminUser || type.allowAction(NodeActionType.insert, this.node);
            }
        }

        /* Note: if this is on the main tree then we don't show the edit button here because it'll
        be showing up in a different place. We show here only for timeline, or search results views
        */
        if (ast.userPrefs.editMode) {

            let editButton = null;
            if (this.tabData.id !== C.TAB_MAIN && editingAllowed && editableNode) {
                editButton = new Button(null, S.edit._runEditNodeByClick, {
                    title: "Edit Node",
                    [C.NODE_ID_ATTR]: this.node.id
                }, "btn-secondary ui-edit-node", "fa-edit");
            }

            if (this.tabData.id == C.TAB_DOCUMENT && insertAllowed && editInsertAllowed) {
                children.push(new Button(null, S.edit._newSubNode, {
                    [C.NODE_ID_ATTR]: this.node.id,
                    title: "Create new SubNode"
                }, "btn-secondary ui-new-node-plus", "fa-plus"));

                if (editButton) {
                    children.push(editButton);
                }

                // don't show this insert inline button if we are at the root of the page, because
                // we wouldn't even be able to see the node after inserting since the document view
                // only shows that node and it's children.
                if (this.tabData.props.node.id !== this.node.id) {
                    children.push(new Button(null, () => {
                        S.edit.insertNode(this.node.id, 0, ast);
                    }, {
                        title: "Insert new node"
                    }, "btn-secondary  ui-new-node-plus plusButtonFloatRight", "fa-plus"));
                }
            }
            else {
                if (editButton) {
                    children.push(editButton);
                }
            }

            if (this.tabData.id !== C.TAB_MAIN && deleteAllowed && this.node.id !== ast.userProfile?.userNodeId) {
                const askDelDiv = this.node.id == ast.nodeClickedToDel ? S.render.makeDeleteQuestionDiv() : null;
                if (askDelDiv) {
                    floatUpperRightDiv.addChild(askDelDiv);
                }
                else {
                    floatUpperRightDiv.addChild(new Icon({
                        className: "fa fa-trash fa-lg buttonBarIcon",
                        title: "Delete node(s)",
                        [C.NODE_ID_ATTR]: this.node.id,
                        onClick: this.tabData.id == C.TAB_MAIN ? S.edit._deleteSelNodes : S.edit._deleteOneNode
                    }));
                }
            }
        }

        /* If we're not on a search result display (or timeline) and there's a TARGET_ID on the node
        then we need to show the jump button point to it.
        */
        if (this.isMainTree) {
            const targetId = S.props.getPropStr(J.NodeProp.TARGET_ID, this.node);
            if (targetId) {
                jumpButton = new Icon({
                    className: "fa fa-arrow-right fa-lg buttonBarIcon",
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.nav._jumpToTargetIdClick,
                    title: "Jump to Tree"
                });
            }
        }

        if (jumpButton) {
            floatUpperRightDiv.addChildren([jumpButton]);
        }

        // for mobile, we don't show this float right component unless in wide-screen orientation.
        if ((!ast.mobileMode || S.quanta.isLandscapeOrientation()) && floatUpperRightDiv.hasChildren()) {
            children.push(floatUpperRightDiv);
            children.push(new Clearfix());
        }

        this.children = children;
        return true;
    }

    _getContentDomId = () => {
        return NodeCompContent.PRE_PREFIX + this.prefix + this.node.id;
    }
}

import { getAs } from "../../AppContext";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { Icon } from "../../comp/core/Icon";
import { Img } from "../../comp/core/Img";
import { Span } from "../../comp/core/Span";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { NodeActionType } from "../../intf/TypeIntf";
import * as J from "../../JavaIntf";
import { NodeInfo, NodeType, PrincipalName } from "../../JavaIntf";
import { S } from "../../Singletons";
import { Comp } from "../base/Comp";
import { Anchor } from "../core/Anchor";
import { Button } from "../core/Button";
import { DropdownMenu } from "../core/DropdownMenu";
import { Li } from "../core/Li";
import { SpanHtml } from "../core/SpanHtml";
import { NodeCompContent } from "./NodeCompContent";

export class NodeCompRowHeader extends Div {

    constructor(private node: NodeInfo, private allowAvatars: boolean, private isMainTree: boolean,
        public tabData: TabIntf<any>, private jumpButton: boolean, private showThreadButton: boolean,
        private allowDelete: boolean, private prefix: string, private idx: number, indentLevel: number) {
        super(null);

        const ast = getAs();
        this.attribs.className = (tabData.id === C.TAB_MAIN && ast.userPrefs.editMode && S.util.showMetaData(ast, this.node)) ? //
            (indentLevel <= 1 && this.idx == 1 ? "rowHeaderEditFirst" : "rowHeaderEdit") : "row-header";
    }

    override preRender = (): boolean => {
        const ast = getAs();
        const ddItems: Comp[] = [];

        let displayName = null;
        const allowWideViewIcons = !ast.mobileMode || S.quanta.isLandscapeOrientation();
        if (!displayName) {
            displayName = this.node.owner;
        }

        if (displayName) {
            const atIdx = displayName.indexOf("@");
            if (atIdx !== -1) {
                displayName = displayName.substring(0, atIdx);
            }
        }

        const isMine = S.props.isMine(this.node);
        const children = [];
        let avatarImg: Img = null;
        const type = S.plugin.getType(this.node.type);

        // we always enable showInfo even on Tree Tab, so that we can have anonymous users comming to a shared tree link
        // and they can see whose node it is rather than seeing just content on the page that's confusing who it came from or what it is.
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
                onClick: S.nav.clickToOpenUserProfile
            }));
        }

        const signed = S.props.getPropStr(J.NodeProp.CRYPTO_SIG, this.node);
        if (signed) {
            children.push(new Icon({
                title: "Crypto Signature Verified",
                className: "fa fa-certificate fa-lg signatureIcon mediumMarginRight"
            }));
        }

        if (S.props.isEncrypted(this.node)) {
            children.push(new Icon({
                className: "fa fa-lock fa-lg lockIcon mediumMarginRight",
                title: "Node is Encrypted."
            }));
        }

        const editInsertAllowed = S.props.isWritableByMe(this.node);

        if (!ast.isAdminUser && showInfo && editInsertAllowed) {
            if (ast.mobileMode) {
                const iconProps = {
                    title: "Reply to this Post",
                    className: "dropdown-item",
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.edit.replyToNode
                }

                ddItems.push(new Li(null, { className: "clickable" }, [
                    new Span("Reply", iconProps)
                ]));
            }
            else {
                const iconProps = {
                    title: "Reply to this Post",
                    className: "fa fa-reply fa-lg rowHeaderIcon",
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.edit.replyToNode
                }

                children.push(new Icon(iconProps));
            }
        }

        if (showInfo) {
            const hasNonPublicShares = S.props.hasNonPublicShares(this.node);

            let youLiked: boolean = false;
            let likeDisplay: string = null;
            if (this.node.likes) {
                youLiked = !!this.node.likes.find(u => u === ast.userName);
                likeDisplay = "Liked by " + this.node.likes.length;
                if (youLiked) {
                    likeDisplay += " (including You)";
                }
            }

            if (!ast.isAdminUser && !ast.isAnonUser) {
                if (ast.mobileMode) {
                    const iconProps = {
                        title: likeDisplay ? likeDisplay : "Like this Node",
                        className: "dropdown-item",
                        [C.NODE_ID_ATTR]: this.node.id,
                        onClick: S.edit.likeNodeClick
                    }

                    ddItems.push(new Li(null, { className: "clickable" }, [
                        new Span("Like " + (this.node.likes?.length > 0 ? this.node.likes.length.toString() : ""), iconProps)
                    ]));
                }
                else {
                    children.push(new Icon({
                        title: likeDisplay ? likeDisplay : "Like this Node",
                        className: "fa fa-star fa-lg rowHeaderIcon " + (youLiked ? "likedByMeIcon" : ""),
                        [C.NODE_ID_ATTR]: this.node.id,
                        onClick: S.edit.likeNodeClick
                    }, this.node.likes?.length > 0 ? this.node.likes.length.toString() : ""));
                }
            }

            /* only allow this for logged in users, because it might try to access over ActivityPub potentially
            and we need to have a user identity for all the HTTP sigs for that. */
            if (!ast.isAnonUser && (hasNonPublicShares || this.node.likes?.length > 0)) {
                ddItems.push(new Li(null, { className: "clickable" }, [
                    new Span("People", {
                        className: "dropdown-item",
                        [C.NODE_ID_ATTR]: this.node.id,
                        onClick: S.nav.showUsersList
                    })
                ]));
            }

            if (showInfo && allowWideViewIcons) {
                ddItems.push(new Li(null, { className: "clickable" }, [
                    new Span("Links", {
                        className: "dropdown-item",
                        title: "Show URLs for this node",
                        [C.NODE_ID_ATTR]: this.node.id,
                        onClick: S.nav.showNodeUrl
                    })
                ]));
            }

            // Allow bookmarking any kind of node other than bookmark nodes.
            if (showInfo && !ast.isAnonUser && this.node.type !== J.NodeType.BOOKMARK && this.node.type !== J.NodeType.BOOKMARK_LIST) {
                ddItems.push(new Li(null, { className: "clickable" }, [
                    new Span("Bookmark", {
                        className: "dropdown-item",
                        [C.NODE_ID_ATTR]: this.node.id,
                        [C.DOM_ID_ATTR]: this.getContentDomId(),
                        onClick: S.edit.addBookmarkClick
                    })
                ]));
            }

            // Because the POSTS node will be at a depth like this: "/r/usr/L/b/q", we require
            // the path to be at least deeper than that to show the history button.
            // L = Local Users, then: [UserNode]/[PostsNode]/[ActualNode]
            // Also if we have 'inReplyTo' that will also enable the button.
            const inReplyTo = S.props.getPropStr(J.NodeProp.INREPLYTO, this.node);
            const slashCount = S.util.countChars(this.node.path, "/");
            const adminNode = this.node.owner === PrincipalName.ADMIN;

            if (!adminNode && showInfo && this.showThreadButton && (slashCount > 4 || !!inReplyTo)) {
                if (ast.mobileMode) {
                    const iconProps = {
                        title: likeDisplay ? likeDisplay : "Show Thread",
                        className: "dropdown-item",
                        [C.NODE_ID_ATTR]: this.node.id,
                        onClick: S.nav.showThread
                    }

                    ddItems.push(new Li(null, { className: "clickable" }, [
                        new Span("Show Thread", iconProps)
                    ]));
                }
                else {
                    children.push(new Icon({
                        className: "fa fa-th-list fa-lg rowHeaderIcon",
                        title: "Show Thread History",
                        [C.NODE_ID_ATTR]: this.node.id,
                        onClick: S.nav.showThread
                    }));
                }
            }

            if (!ast.isAnonUser && allowWideViewIcons) {
                if (ast.mobileMode) {
                    // for now let's not have tts on mobile.
                }
                else {
                    children.push(new Icon({
                        className: "fa fa-volume-up fa-lg rowHeaderIcon",
                        title: "Speech-to-Text (Read Aloud)",
                        onMouseOver: () => { S.quanta.selectedForTts = window.getSelection().toString(); },
                        onMouseOut: () => { S.quanta.selectedForTts = null; },
                        [C.DOM_ID_ATTR]: this.getContentDomId(),
                        onClick: S.nav.ttsClick
                    }));
                }
            }
        }

        if (this.jumpButton) {
            // if not on main tab or feed tab show a jump to node icon
            if (this.tabData.id !== C.TAB_MAIN && this.tabData.id !== C.TAB_FEED) {
                children.push(new Icon({
                    title: "Jump To Node",
                    className: "fa fa-arrow-right fa-lg rowHeaderIcon",
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.nav.clickSearchNode
                }));
            }
            // for all other tabs bury the Jump to Node in the dropdown menu
            else {
                ddItems.push(new Li(null, { className: "clickable" }, [
                    new Span("Jump to Node", {
                        className: "dropdown-item",
                        [C.NODE_ID_ATTR]: this.node.id,
                        onClick: S.nav.clickSearchNode
                    })
                ]));
            }
        }

        if (ast.node) {
            ddItems.push(new Li(null, { className: "clickable" }, [
                new Span("Search", {
                    className: "dropdown-item",
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.nav.searchByNodeIdClick
                })
            ]));

            ddItems.push(new Li(null, { className: "clickable" }, [
                new Span("Timeline", {
                    className: "dropdown-item",
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.nav.runTimelineByClick
                })
            ]));

            ddItems.push(new Li(null, { className: "clickable" }, [
                new Span("Document", {
                    className: "dropdown-item",
                    [C.NODE_ID_ATTR]: this.node.id,
                    onClick: S.nav.openDocViewByClick
                })
            ]));
        }

        this.addOriginalLinks(ddItems);

        if (ddItems.length > 0) {
            children.push(new DropdownMenu(ddItems));
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
                    onClick: S.nav.copyNodeNameToClipboard
                }));
            }

            if (S.props.isMine(this.node)) {
                const folderName = S.props.getPropStr(J.NodeProp.FOLDER_NAME, this.node);
                if (folderName) {
                    floatUpperRightDiv.addChild(new Span(folderName, {
                        className: "nodeFolderNameDisp",
                        title: "Folder for Markdown Export"
                    }));
                }
                let fileName = S.props.getPropStr(J.NodeProp.FILE_NAME, this.node);
                if (fileName) {
                    fileName = fileName.replaceAll("/index.md", "/*");
                    floatUpperRightDiv.addChild(new Span(fileName, {
                        className: "nodeFileNameDisp",
                        title: "File for Markdown Export"
                    }));
                }
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

        if (!this.allowDelete) {
            deleteAllowed = false;
        }

        let editButton: Icon = null;
        let jumpButton: Icon = null;
        let pasteButton: Button = null;

        /* Note: if this is on the main tree then we don't show the edit button here because it'll be
        showing up in a different place. We show here only for timeline, or search results views */
        if (!this.isMainTree && ast.userPrefs.editMode) {
            if (editingAllowed && editableNode) {
                editButton = new Icon({
                    className: "fa fa-edit fa-lg buttonBarIcon ui-edit-node",
                    onClick: S.edit.runEditNodeByClick,
                    title: "Edit Node",
                    [C.NODE_ID_ATTR]: this.node.id
                });
            }

            if (deleteAllowed && this.node.id !== ast.userProfile?.userNodeId) {
                const askDelDiv = this.node.id == ast.nodeClickedToDel ? S.render.makeDeleteQuestionDiv() : null;
                if (askDelDiv) {
                    floatUpperRightDiv.addChild(askDelDiv);
                }
                else {
                    floatUpperRightDiv.addChild(new Icon({
                        className: "fa fa-trash fa-lg buttonBarIcon",
                        title: "Delete node(s)",
                        [C.NODE_ID_ATTR]: this.node.id,
                        onClick: this.tabData.id == C.TAB_MAIN ? S.edit.deleteSelNodes : S.edit.deleteOneNode
                    }));
                }
            }
        }

        const userCanPaste = S.props.isMine(this.node) || ast.isAdminUser || this.node.id === ast.userProfile?.userNodeId;
        if (!!ast.nodesToMove && userCanPaste) {
            pasteButton = new Button("Paste Inside",
                S.edit.pasteSelNodesInside, { [C.NODE_ID_ATTR]: this.node.id }, "btn-secondary pasteButton")
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
                    onClick: S.nav.jumpToTargetIdClick,
                    title: "Jump to Tree"
                });
            }
        }

        if (editButton || jumpButton) {
            floatUpperRightDiv.addChildren([pasteButton, editButton, jumpButton]);
        }

        // for mobile, we don't show this float right component unless in wide-screen orientation.
        if ((!ast.mobileMode || S.quanta.isLandscapeOrientation()) && floatUpperRightDiv.hasChildren()) {
            children.push(floatUpperRightDiv);
            children.push(new Clearfix());
        }

        this.setChildren(children);
        return true;
    }

    addOriginalLinks = (ddItems: Comp[]) => {
        if (this.node.owner.indexOf("@") !== -1) {
            const inReplyTo = S.props.getPropStr(J.NodeProp.INREPLYTO, this.node);
            if (inReplyTo) {
                // if this is a URL and not our own host then show the Remote Parent link
                if (inReplyTo.indexOf(":") !== -1 && inReplyTo.indexOf(location.protocol + "//" + location.hostname) === -1) {
                    ddItems.push(new Li(null, { className: "clickable" }, [
                        new Anchor(inReplyTo, "Original Post Parent", {
                            className: "dropdown-item",
                            target: "_blank",
                            title: "Go to post's parent on it's home Fediverse instance"
                        })
                    ]));
                }
            }
        }
    }

    getTextContent = (): string => {
        const id = this.getContentDomId();
        const elm = document.getElementById(id);
        return elm ? elm.textContent : null;
    }

    getContentDomId = () => {
        return NodeCompContent.PRE_PREFIX + this.prefix + this.node.id;
    }
}

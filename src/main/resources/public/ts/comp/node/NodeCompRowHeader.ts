import { dispatch, useAppState } from "../../AppContext";
import { ButtonBar } from "../../comp/core/ButtonBar";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { Icon } from "../../comp/core/Icon";
import { IconButton } from "../../comp/core/IconButton";
import { Img } from "../../comp/core/Img";
import { Span } from "../../comp/core/Span";
import { UserProfileDlg } from "../../dlg/UserProfileDlg";
import { TabIntf } from "../../intf/TabIntf";
import { NodeActionType } from "../../intf/TypeIntf";
import * as J from "../../JavaIntf";
import { NodeType } from "../../JavaIntf";
import { S } from "../../Singletons";
import { Button } from "../core/Button";
import { Constants as C } from "../../Constants";

export class NodeCompRowHeader extends Div {

    constructor(private node: J.NodeInfo, private allowAvatars: boolean, private isMainTree: boolean,
        public tabData: TabIntf<any>, private jumpButton: boolean, private showThreadButton: boolean,
        private isBoost: boolean, private allowDelete: boolean) {
        super(null);

        const ast = useAppState();
        this.attribs.className = (tabData.id === C.TAB_MAIN && ast.userPrefs.editMode && ast.userPrefs.showMetaData) ? "row-header-edit" : "row-header";
    }

    preRender(): void {
        const ast = useAppState();
        const showDetails: boolean = ast.showAllRowDetails.has(this.node.id) || ast.isAdminUser;
        const children = [];
        let avatarImg: Img = null;

        const isMine = S.props.isMine(this.node, ast);
        const showInfo = ast.userPrefs.showMetaData || this.tabData.id === C.TAB_FEED || this.tabData.id === C.TAB_THREAD;

        if (showInfo && this.allowAvatars && this.node.owner !== J.PrincipalName.ADMIN) {
            avatarImg = S.render.makeHeaderAvatar(this.node, ast);
            if (avatarImg) {
                children.push(avatarImg);
            }
        }

        const priorityVal = S.props.getPropStr(J.NodeProp.PRIORITY, this.node);
        const priority = (priorityVal && priorityVal !== "0") ? "P" + priorityVal : "";

        // now that we have this stuff visible by default on all nodes, we don't want users to need to
        // see 'admin' on all admin nodes. too noisy
        if (showInfo && this.node.owner && this.node.owner !== "?" && this.node.owner !== J.PrincipalName.ADMIN) {
            let displayName = this.node.displayName || ("@" + this.node.owner);

            displayName = S.util.insertActPubTags(displayName, this.node);

            // If user had nothin but ":tags:" in their display name, then display there userName
            displayName = displayName || this.node.owner;

            if (this.node.transferFromId) {
                displayName = "PENDING XFER -> " + displayName;
            }

            children.push(new Span(displayName, {
                className: (this.node.transferFromId ? "transfer-pending" : (isMine ? "created-by-me" : "created-by-other")),
                title: "Show Profile:\n\n" + this.node.owner,
                onClick: () => {
                    new UserProfileDlg(this.node.ownerId).open();
                }
            }, null, true));
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

        /* for admin user show id, ordinal, and type right on the row. For diagnostics only. */
        // if (ast.isAdminUser) {
        //     children.push(new Span("[" + this.node.ordinal + "]", { className: "marginRight" }));
        // }

        const editInsertAllowed = S.props.isWritableByMe(this.node);
        const actPubId = S.props.getPropStr(J.NodeProp.ACT_PUB_ID, this.node);

        // always show a reply if activity pub, or else not public non-repliable (all person to person shares ARE replyable)
        // Also we don't allow admin user to do any replies
        if (!ast.isAdminUser && showInfo && (editInsertAllowed || actPubId)) {
            children.push(new Icon({
                title: "Reply to this Post",
                className: "fa fa-reply fa-lg mediumMarginRight",
                onClick: () => {
                    if (ast.isAnonUser) {
                        S.util.showMessage("Login to create content and reply to nodes.", "Login!");
                    }
                    else {
                        S.edit.addNode(this.node.id, NodeType.COMMENT, true, null, null, this.node.id, null, null, true, ast);
                    }
                }
            }));
        }

        if (showInfo) {
            if (!ast.isAdminUser) {
                children.push(new Icon({
                    title: "Boost this Node",
                    className: "fa fa-retweet fa-lg mediumMarginRight",
                    onClick: () => {
                        if (ast.isAnonUser) {
                            S.util.showMessage("Login to boost nodes.", "Login!");
                        }
                        else {
                            S.edit.addNode(null, null, false, null, null, null, null, this.node.id, false, ast)
                        }
                    }
                }));
            }

            const hasNonPublicShares = S.props.hasNonPublicShares(this.node);
            const hasMentions = S.props.hasMentions(this.node);

            let youLiked: boolean = false;
            let likeDisplay: string = null;
            if (this.node.likes) {
                youLiked = !!this.node.likes.find(u => u === ast.userName);
                likeDisplay = "Liked by " + this.node.likes.length;
                if (youLiked) {
                    likeDisplay += " (including You)";
                }
            }

            children.push(new Icon({
                title: likeDisplay ? likeDisplay : "Like this Node",
                className: "fa fa-star fa-lg mediumMarginRight " + (youLiked ? "likedByMeIcon" : ""),
                onClick: () => {
                    if (ast.isAdminUser) {
                        S.util.showMessage("Admin user can't do Likes.", "Admin");
                        return;
                    }

                    if (ast.isAnonUser) {
                        S.util.showMessage("Login to like and create content.", "Login!");
                    }
                    else {
                        S.edit.likeNode(this.node, !youLiked, ast);
                    }
                }
            }, this.node.likes?.length > 0 ? this.node.likes.length.toString() : ""));

            /* only allow this for logged in users, because it might try to access over ActivityPub potentially
            and we need to have a user identity for all the HTTP sigs for that. */
            if (showDetails && !ast.isAnonUser && (hasNonPublicShares || hasMentions || this.node.likes?.length > 0)) {
                children.push(new Icon({
                    title: "People associated with this Node",
                    className: "fa fa-users fa-lg mediumMarginRight",
                    onClick: () => S.user.showUsersList(this.node)
                }));
            }

            if (showInfo && showDetails) {
                children.push(new Icon({
                    className: "fa fa-link fa-lg mediumMarginRight",
                    title: "Show URLs for this node",
                    onClick: () => S.render.showNodeUrl(this.node, ast)
                }));
            }

            // Allow bookmarking any kind of node other than bookmark nodes.
            if (showInfo && showDetails && !ast.isAnonUser && this.node.type !== J.NodeType.BOOKMARK && this.node.type !== J.NodeType.BOOKMARK_LIST) {
                children.push(new Icon({
                    className: "fa fa-bookmark fa-lg mediumMarginRight",
                    title: "Bookmark this Node",
                    onClick: () => S.edit.addBookmark(this.node, ast)
                }));
            }

            if (showInfo && showDetails && this.showThreadButton) {
                children.push(new Icon({
                    className: "fa fa-th-list fa-lg mediumMarginRight",
                    title: "Show Full Thread History",
                    onClick: () => S.srch.showThread(this.node)
                }));
            }
        }

        if (showInfo && priority) {
            children.push(new Span(priority, {
                className: "mediumMarginRight priorityTag" + priorityVal
            }));
        }

        if (!showDetails) {
            children.push(new Icon({
                title: "More node actions",
                className: "fa fa-ellipsis-h fa-lg mediumMarginRight",
                onClick: () => {
                    dispatch("SetHeaderDetailsState", s => {
                        s.showAllRowDetails.add(this.node.id);
                    });
                }
            }));
        }

        const floatUpperRightDiv: Div = new Div(null, {
            className: "float-end floatRightHeaderDiv"
        });

        if (showInfo && this.node.timeAgo) {
            floatUpperRightDiv.addChild(new Span(this.node.timeAgo, {
                title: "Last Modified: " + S.util.formatDateTime(new Date(this.node.lastModified))
            }));
        }

        const type = S.plugin.getType(this.node.type);
        if (type) {
            const iconClass = type.getIconClass();
            if (showInfo && showDetails && iconClass) {
                floatUpperRightDiv.addChild(new Icon({
                    className: iconClass + " marginLeft marginRight",
                    title: "Node Type: " + type.getName()
                }));
            }
        }

        if (showInfo && this.node.name) {
            const byNameUrl = window.location.origin + S.nodeUtil.getPathPartForNamedNode(this.node);
            floatUpperRightDiv.addChild(new Span(this.node.name, {
                className: "nodeNameDisp",
                title: "Node name (Click to copy link to clipboard)",
                onClick: () => {
                    S.util.copyToClipboard(byNameUrl);
                    S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                }
            }));
        }

        const unpublished = S.props.getPropStr(J.NodeProp.UNPUBLISHED, this.node);
        const unpublishedIcon = unpublished ? new Icon({
            className: "fa fa-eye-slash fa-lg sharingIcon marginLeft",
            title: "Node is Unpublished\n\nWill not appear in feed"
        }) : null;

        if (showInfo) {
            // If node is shared to public we just show the globe icon and not the rest of the shares that may be present.
            if (S.props.isPublic(this.node)) {
                const appendNode = S.props.isPublicWritable(this.node) ? "Anyone can reply" : "No Replies Allowed";
                floatUpperRightDiv.addChildren([
                    new Icon({
                        className: "fa fa-globe fa-lg sharingIcon marginLeft",
                        title: "Node is Public\n(" + appendNode + ")"
                    }),
                    unpublishedIcon
                ]);
            }
            // Show all the share names
            else if (S.props.isShared(this.node)) {
                const shareComps = S.nodeUtil.getSharingNames(ast, this.node, null);
                floatUpperRightDiv.addChildren([
                    new Span(null, {
                        className: "rowHeaderSharingNames"
                    }, [
                        new Icon({
                            className: "fa fa-envelope fa-lg"
                        }),
                        ...shareComps
                    ]),
                    unpublishedIcon
                ]);
            }
        }

        let editingAllowed = S.edit.isEditAllowed(this.node, ast);
        let deleteAllowed = false;
        let editableNode = true;

        if (ast.isAdminUser) {
            editingAllowed = true;
            editableNode = true;
            deleteAllowed = true;
        }
        else if (type) {
            if (editingAllowed) {
                editingAllowed = type.allowAction(NodeActionType.editNode, this.node, ast);
                editableNode = type.allowAction(NodeActionType.editNode, this.node, ast);
                deleteAllowed = type.allowAction(NodeActionType.delete, this.node, ast);
            }
        }

        if (!this.allowDelete) {
            deleteAllowed = false;
        }

        let editButton: IconButton = null;
        let jumpButton: IconButton = null;
        let pasteButton: Button = null;

        /* Note: if this is on the main tree then we don't show the edit button here because it'll be
        showing up in a different place. We show here only for timeline, or search results views */
        if (!this.isBoost && !this.isMainTree && ast.userPrefs.editMode) {
            if (editingAllowed && editableNode) {
                editButton = new IconButton("fa-edit", null, {
                    className: "marginLeft",
                    onClick: S.edit.runEditNodeByClick,
                    title: "Edit Node",
                    nid: this.node.id
                });
            }

            if (deleteAllowed && this.node.id !== ast.userProfile?.userNodeId) {
                floatUpperRightDiv.addChild(new Icon({
                    className: "fa fa-trash fa-lg buttonBarIcon",
                    title: "Delete node(s)",
                    nid: this.node.id,
                    onClick: S.edit.deleteSelNodes
                }));
            }
        }

        const userCanPaste = S.props.isMine(this.node, ast) || ast.isAdminUser || this.node.id === ast.userProfile?.userNodeId;
        if (!!ast.nodesToMove && userCanPaste) {
            pasteButton = new Button("Paste Inside",
                S.edit.pasteSelNodesInside, { nid: this.node.id }, "btn-secondary pasteButton")
        }

        let jumpButtonAdded = false;
        /* If we're not on a search result display (or timeline) and there's a TARGET_ID on the node
        then we need to show the jump button point to it.

        NOTE: todo-1: This logic will be the key to how we can make
        bookmarks work (a future feature). If bookmarks simply have the TARGET_ID then that basically
        can make them functional as bookmarks, because TARGET_ID is essentially all it
        takes to be a functional bookmark to the id.
        */
        if (this.isMainTree) {
            const targetId = S.props.getPropStr(J.NodeProp.TARGET_ID, this.node);
            if (targetId) {
                jumpButtonAdded = true;
                jumpButton = new IconButton("fa-arrow-right", null, {
                    className: "marginLeft",
                    onClick: () => S.view.jumpToId(targetId),
                    title: "Jump to the Node"
                });
            }
        }

        /* Only need this Jump button if admin. Would work fine for ordinary users, but isn't really needed. */
        if (showDetails && this.jumpButton && !jumpButtonAdded) {
            jumpButton = new IconButton("fa-arrow-right", null, {
                className: "marginLeft",
                onClick: () => S.srch.clickSearchNode(this.node.id, ast),
                title: "Jump to Tree"
            });
        }

        if (editButton || jumpButton) {
            floatUpperRightDiv.addChild(new ButtonBar([pasteButton, editButton, jumpButton], null, "marginLeft"));
        }

        if (floatUpperRightDiv.hasChildren()) {
            children.push(floatUpperRightDiv);
            children.push(new Clearfix());
        }

        this.setChildren(children);
    }
}

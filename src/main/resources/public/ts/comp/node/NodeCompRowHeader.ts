import { useAppState } from "../../AppRedux";
import { ButtonBar } from "../../comp/core/ButtonBar";
import { Clearfix } from "../../comp/core/Clearfix";
import { Div } from "../../comp/core/Div";
import { Icon } from "../../comp/core/Icon";
import { IconButton } from "../../comp/core/IconButton";
import { Img } from "../../comp/core/Img";
import { Span } from "../../comp/core/Span";
import { UserProfileDlg } from "../../dlg/UserProfileDlg";
import { NodeActionType } from "../../enums/NodeActionType";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { Comp } from "../base/Comp";

// todo-1: need to switch to the more efficient way of using nid attribute
// on elements (search for "nid:" in code), to avoid creating new functions
// every time this component renders (and same for entire app!)

export class NodeCompRowHeader extends Div {

    constructor(private node: J.NodeInfo, private allowAvatars: boolean, private isMainTree: boolean, private isFeed: boolean, private jumpButton: boolean, private showThreadButton: boolean,
        private isBoost: boolean) {
        super(null, {
            className: "header-text"
        });
    }

    preRender(): void {
        let state = useAppState();
        let children = [];
        let avatarImg: Img = null;

        if (this.allowAvatars && this.node.owner !== J.PrincipalName.ADMIN) {
            avatarImg = S.render.makeAvatarImage(this.node, state);
            if (avatarImg) {
                children.push(avatarImg);
            }
        }

        let priorityVal = S.props.getPropStr(J.NodeProp.PRIORITY, this.node);
        let priority = (priorityVal && priorityVal !== "0") ? "P" + priorityVal : "";

        // now that we have this stuff visible by default on all nodes, we don't want users to need to
        // see 'admin' on all admin nodes. too noisy
        if (this.node.owner && this.node.owner !== "?" && this.node.owner !== "admin") {
            let displayName = this.node.displayName || ("@" + this.node.owner);

            displayName = S.util.insertActPubTags(displayName, this.node);

            // If user had nothin but ":tags:" in their display name, then display there userName
            if (!displayName) {
                displayName = this.node.owner;
            }

            children.push(new Span(displayName, {
                className: (this.node.owner === state.userName) ? "created-by-me" : "created-by-other",
                title: "Show Profile",
                onClick: () => {
                    new UserProfileDlg(this.node.ownerId, state).open();
                }
            }, null, true));
        }

        let typeHandler = S.plugin.getTypeHandler(this.node.type);
        if (typeHandler) {
            let iconClass = typeHandler.getIconClass();
            if (iconClass) {
                children.push(new Icon({
                    className: iconClass + " rowTypeIcon",
                    title: "Node Type: " + typeHandler.getName(),
                    onMouseOver: () => { S.quanta.draggableId = this.node.id; },
                    onMouseOut: () => { S.quanta.draggableId = null; }
                }));
            }
        }

        /* for admin user shwo id, ordinal, and type right on the row. We have a bug where
        the logicalOrdinal is showing as -1 here, but it's just because it's not being set on the server. */
        if (state.isAdminUser) {
            // looks like root node of pages don't have this ordinal set (it's -1 so for now we just hide it in that case)
            let ordinal = this.node.logicalOrdinal === -1 ? "" : this.node.logicalOrdinal;
            children.push(new Span(ordinal + " [" + this.node.ordinal + "] " + this.node.type, { className: "marginRight" }));
        }

        children.push(new Icon({
            className: "fa fa-link fa-lg marginRight",
            title: "Show URLs for this node",
            onClick: () => S.render.showNodeUrl(this.node, state)
        }));

        // Allow bookmarking any kind of node other than bookmark nodes.
        if (!state.isAnonUser && this.node.type !== J.NodeType.BOOKMARK && this.node.type !== J.NodeType.BOOKMARK_LIST) {
            children.push(new Icon({
                className: "fa fa-bookmark fa-lg marginRight",
                title: "Bookmark this Node",
                onClick: () => S.edit.addBookmark(this.node, state)
            }));
        }

        if (this.showThreadButton) {
            children.push(new Icon({
                className: "fa fa-th-list fa-lg marginRight",
                title: "Show Full Thread History",
                onClick: () => S.srch.showThread(this.node, state)
            }));
        }

        let publicReadOnly = S.props.isPublicReadOnly(this.node);
        let actPubId = S.props.getPropStr(J.NodeProp.ACT_PUB_ID, this.node);

        // always show a reply if activity pub, or else not public non-repliable (all person to person shares ARE replyable)
        if (!this.isBoost && (!publicReadOnly || actPubId)) {
            children.push(new Icon({
                title: "Reply to this Post",
                className: "fa fa-reply fa-lg marginRight",
                onClick: () => {
                    if (state.isAnonUser) {
                        S.util.showMessage("Login to create content and reply to nodes.", "Login!");
                    }
                    else {
                        S.edit.addNode(this.node.id, true, null, null, this.node.id, null, null, true, state);
                    }
                }
            }));
        }

        // todo-0: AFTER better testing we can bring back boost feature
        // Taking this away (7/8/22) after discovering it never was rendering correctly on FOREIGN servers. 
        // if (!this.isBoost) {
        //     children.push(new Icon({
        //         title: "Boost this Node",
        //         className: "fa fa-retweet fa-lg marginRight",
        //         onClick: () => {
        //             if (state.isAnonUser) {
        //                 S.util.showMessage("Login to create content and reply to nodes.", "Login!");
        //             }
        //             else {
        //                 S.edit.addNode(null, false, null, null, null, null, node.id, false, state)
        //             }
        //         }
        //     }));
        // }

        let youLiked: boolean = false;
        let likeNames = null;
        if (this.node.likes) {
            youLiked = !!this.node.likes.find(u => u === state.userName);
            likeNames = "Liked by:";
            if (youLiked) {
                likeNames += "\nYou";
            }
            this.node.likes.forEach(u => {
                if (u !== state.userName) {
                    likeNames += "\n" + u;
                }
            });
        }

        children.push(new Icon({
            // title: youLiked ? "You Liked this Node!" : "Like this Node",
            title: likeNames ? likeNames : "Like this Node",
            className: "fa fa-star fa-lg " + (youLiked ? "activeLikeIcon" : ""),
            onClick: () => {
                if (state.isAnonUser) {
                    S.util.showMessage("Login to like and create content.", "Login!");
                }
                else {
                    S.edit.likeNode(this.node, !youLiked, state);
                }
            }
        }, this.node.likes?.length > 0 ? this.node.likes.length.toString() : ""));

        if (priority) {
            children.push(new Span(priority, {
                className: "priorityTag" + priorityVal
            }));
        }

        let floatUpperRightDiv: Div = new Div(null, {
            className: "float-end floatRightHeaderDiv"
        });

        if (this.node.lastModified) {
            let reply = S.props.getPropStr(J.NodeProp.REPLY, this.node);
            if (reply) {
                floatUpperRightDiv.addChild(new Span("Reply", { className: "reply-indicator", title: "This Post is a reply to it's parent Post" }));
            }
            floatUpperRightDiv.addChild(new Span(S.util.formatDate(new Date(this.node.lastModified))));
        }

        if (this.node.name) {
            let byNameUrl = window.location.origin + S.nodeUtil.getPathPartForNamedNode(this.node);
            floatUpperRightDiv.addChild(new Span(this.node.name, {
                className: "nodeNameDisp",
                title: "Node name (Click to copy link to clipboard)",
                onClick: () => {
                    S.util.copyToClipboard(byNameUrl);
                    S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                }
            }));
        }

        // If node is shared to public we just show the globe icon and not the rest of the shares that may be present.
        if (S.props.isPublic(this.node)) {
            let appendNode = S.props.isPublicWritable(this.node) ? "Anyone can reply" : "No Replies Allowed";
            floatUpperRightDiv.addChild(new Icon({
                className: "fa fa-globe fa-lg sharingGlobeIcon",
                title: "Node is Public\n(" + appendNode + ")"
            }));
        }
        // Show all the share names
        else if (S.props.isShared(this.node)) {
            let shareComps: Comp[] = S.nodeUtil.getSharingNames(state, this.node, null);
            floatUpperRightDiv.addChild(
                new Span(null, {
                    className: "rowHeaderSharingNames"
                }, [
                    new Icon({
                        className: "fa fa-envelope fa-lg"
                    }),
                    ...shareComps
                ]));
        }

        let editingAllowed = S.edit.isEditAllowed(this.node, state);
        let deleteAllowed = false;
        let editableNode = true;

        if (state.isAdminUser) {
            editingAllowed = true;
            editableNode = true;
            deleteAllowed = true;
        }
        else if (typeHandler) {
            if (editingAllowed) {
                editingAllowed = typeHandler.allowAction(NodeActionType.editNode, this.node, state);
                editableNode = typeHandler.allowAction(NodeActionType.editNode, this.node, state);
                deleteAllowed = typeHandler.allowAction(NodeActionType.delete, this.node, state);
            }
        }

        let editButton: IconButton = null;
        let jumpButton: IconButton = null;

        /* Note: if this is on the main tree then we don't show the edit button here because it'll be
        showing up in a different place. We show here only for timeline, or search results views */
        if (!this.isBoost && !this.isMainTree && state.userPreferences.editMode) {
            if (editingAllowed && editableNode) {
                editButton = new IconButton("fa-edit", null, {
                    className: "marginLeft",
                    onClick: S.edit.runEditNodeByClick,
                    title: "Edit Node",
                    nid: this.node.id
                });
            }

            if (deleteAllowed && this.node.id !== state.homeNodeId) {
                floatUpperRightDiv.addChild(new Icon({
                    className: "fa fa-trash fa-lg buttonBarIcon",
                    title: "Delete node(s)",
                    nid: this.node.id,
                    onClick: S.edit.deleteSelNodes
                }));
            }
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

        if (this.jumpButton && !jumpButtonAdded) {
            jumpButton = new IconButton("fa-arrow-right", null, {
                className: "marginLeft",
                onClick: () => S.srch.clickSearchNode(this.node.id, state),
                title: "Jump to Tree"
            });
        }

        if (editButton || jumpButton) {
            floatUpperRightDiv.addChild(new ButtonBar([editButton, jumpButton], null, "marginLeft"));
        }

        if (floatUpperRightDiv.hasChildren()) {
            children.push(floatUpperRightDiv);
            children.push(new Clearfix());
        }

        this.setChildren(children);
    }
}

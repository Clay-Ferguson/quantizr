import { dispatch, getAs } from "./AppContext";
import { AppState } from "./AppState";
import { Comp } from "./comp/base/Comp";
import { Icon } from "./comp/core/Icon";
import { Span } from "./comp/core/Span";
import { Constants as C } from "./Constants";
import { EditNodeDlg, LS as EditNodeDlgState } from "./dlg/EditNodeDlg";
import * as J from "./JavaIntf";
import { Attachment, NodeInfo, PrincipalName } from "./JavaIntf";
import { S } from "./Singletons";
import { MainTab } from "./tabs/data/MainTab";

export class NodeUtil {

    applyNodeChanges(changes: J.NodeChanges): void {
        if (changes == null) return;

        // recursively apply to entire tree
        this.applyNodeChangesInner(getAs().node, changes);
    }

    // returns true if we found the target parent node, and processed it
    applyNodeChangesInner(node: NodeInfo, changes: J.NodeChanges): boolean {
        if (!changes || !node) return;
        if (node?.children) {
            for (const n of node.children) {
                if (node.id === changes.parentNodeId) {
                    if (n.ordinal >= changes.ordinalShifMin) {
                        n.ordinal += changes.ordinalShiftRange;
                    }
                }
                // if this node IS the parent, we don't need to recurse into it, because we pre
                // processing it now in this current loop.
                else if (this.applyNodeChangesInner(n, changes)) {
                    return true;
                }
            }
        }
        return node.id === changes.parentNodeId;
    }

    getSelNodeIdsArray(): string[] {
        const sels: string[] = [];
        getAs().selectedNodes.forEach(id => sels.push(id));
        return sels;
    }

    getDisplayName(node: NodeInfo): string {
        return node.owner;
    }

    _clearSelNodes = () => {
        dispatch("ClearSelections", s => s.selectedNodes.clear());
    }

    getHighlightedNode(): NodeInfo {
        const ast = getAs();
        if (!ast.node) return null;
        const id: string = S.quanta.parentIdToFocusNodeMap.get(ast.node.id);
        if (id) {
            return MainTab.inst?.findNode(id);
        }
        return null;
    }

    /* Returns true if successful */
    highlightRowById(ast: AppState, id: string, scroll: boolean): void {
        let node = MainTab.inst?.findNode(id, ast);

        if (node) {
            this.highlightNode(node, scroll, ast);
        } else {
            // This code path should really never happen, but we're looking out for future cases
            // where the 'ast' passed into here might not yet have a findable node 'in findNode'
            // below and we try again on a delay.
            setTimeout(() => {
                ast = getAs();
                node = MainTab.inst?.findNode(id, ast);

                /* If node not known, resort to taking the best, previous node we had */
                if (!node) {
                    node = this.getHighlightedNode();
                }

                if (node) {
                    this.highlightNode(node, scroll, ast);
                }
                else {
                    // if we can't find that node, best behvior is at least to scroll to top. NOTE:
                    // This scrollToTop created a bug where on the first CLICK onto a node after
                    // scrolling down as anonymous user caused the page to scroll to top, loosing
                    // scroll position. So I'm commenting this out for now. I don't think we need
                    // it.
                    // if (scroll) {
                    //     S.view.scrollToTop();
                    // }
                }
            }, 750);
        }
    }

    highlightNode(node: NodeInfo, scroll: boolean, ust: AppState) {
        ust = ust || getAs();
        if (!node || !ust.node) {
            return;
        }

        // this highlightNodeId is only really used to ensure state change happens, but really
        // everything always keys off parentIdToFocusNodeMap actually reading the value.
        dispatch("highlightNode", s => s.highlightNodeId = node.id);
        S.quanta.parentIdToFocusNodeMap.set(ust.node.id, node.id);

        if (scroll) {
            S.view.scrollToNode(node);
        }
    }

    /* Find node by looking everywhere we possibly can on local storage for it */
    findNode(nodeId: string): NodeInfo {
        const ast = getAs();
        for (const data of ast.tabData) {
            const node = data.findNode(nodeId);
            if (node) return node;
        }
        return null;
    }

    /* Returns the node if it's currently displaying on the page. */
    displayingOnTree(nodeId: string): NodeInfo {
        const ast = getAs();
        if (!ast.node) return null;
        if (ast.node.id === nodeId) return ast.node;
        if (!ast.node.children) return null;
        return this.nodeOrChilderenMatch(ast.node, nodeId);
    }

    /**
     * Recursively search for a node by id in the given node and it's children.
     */
    nodeOrChilderenMatch(node: NodeInfo, nodeId: string): NodeInfo {
        if (!node) return null;
        if (node.id === nodeId) return node;
        if (!node.children) return null;
        for (const child of node.children) {
            const ret = this.nodeOrChilderenMatch(child, nodeId);
            if (ret) return ret;
        }
        return null;
    }

    getNodeByName(node: NodeInfo, name: string, ust: AppState): NodeInfo {
        if (!node) return null;
        if (node.name === name) return node;

        if (node.children) {
            return ust.node.children.find(node => node?.name === name);
        }
        return null;
    }

    getPathPartForNamedNode(node: NodeInfo): string {
        if (!node || !node.name) return null;

        if (node.owner === PrincipalName.ADMIN) {
            return "/n/" + node.name;
        }
        else {
            return "/u/" + node.owner + "/" + node.name;
        }
    }

    getShortContent(node: NodeInfo): string {
        let content = node.content;
        if (!content) {
            if (node.name) {
                return "Name:" + node.name;
            }
            else {
                return "ID:" + node.id;
            }
        }

        content = S.util.removeHtmlTags(content);
        content = content.trim();

        // if this is a node starting with hashtags or usernames then chop them all
        while (content.startsWith("@") || content.startsWith("#")) {
            let spaceIdx = content.indexOf(" ");
            if (spaceIdx === -1) {
                spaceIdx = content.indexOf("\n");
            }
            if (spaceIdx > 0) {
                content = content.substring(spaceIdx + 1);
            }
            else break;
        }
        content = content.trim();

        const idx = content.indexOf("\n");
        if (idx !== -1) {
            content = content.substring(0, idx);
        }

        if (content.length > 140) content = content.substring(0, 140) + "...";

        if (S.props.isEncrypted(node)) {
            content = "[Encrypted]";
        }
        return content.trim();
    }

    async removePublicShare(node: NodeInfo, editorDlg: Comp) {
        await S.rpcUtil.rpc<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            nodeId: node.id,
            principalNodeId: PrincipalName.PUBLIC,
            privilege: "*"
        });
        this.removePrivilegeResponse(node, editorDlg);
    }

    async removePrivilegeResponse(node: NodeInfo, editorDlg: Comp) {
        const res = await S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: node.id
        });

        if (editorDlg) {
            const ast = getAs();
            ast.editNode.ac = res.aclEntries;
            S.edit.updateNode(ast.editNode);
        }
    }

    getSharingNames(node: NodeInfo, editorDlg: Comp): Comp[] {
        if (!node?.ac) return null;

        const ret: Comp[] = [];
        if (S.props.isPublic(node)) {
            ret.push(
                new Span(null, {
                    title: "Shared to Public (Everyone)\n\nClick to remove Public Sharing",
                    className: "sharingNamePublic marginLeftIfNotFirst",
                    onClick: () => this.removePublicShare(node, editorDlg)
                }, [
                    new Icon({
                        className: "fa fa-globe fa-lg sharingIcon mr-1",
                        title: "Node is Public"
                    }),
                    new Span("Public" + this.getPublicPrivilegsSuffix(PrincipalName.PUBLIC, node))
                ])
            );
        }

        let showMore = "";
        let moreCount: number = 0;
        let numShares = 0;
        for (const ac of node.ac) {
            const suffix = this.getPublicPrivilegsSuffix(ac.principalName, node);
            // todo-2: will come back to this. I think this happens when there's a share to a user whose
            // account no longer exists?
            // if (!ac.principalName) {
            //     console.log("missing principalName on acl: " + S.util.prettyPrint(node));
            // }

            // Skip public here we processed that above.
            if (ac.principalName && ac.principalName !== PrincipalName.PUBLIC) {
                let props = null;
                let title = "";
                if (ac.displayName) {
                    title = ac.displayName;
                }
                title += (title ? "\n\n" : "") + S.util.getFriendlyPrincipalName(ac);

                // If we have a local node for this user we will have the principleNodeId here and show a link
                // to open the user.
                if (ac.principalNodeId) {
                    props = {
                        [C.USER_ID_ATTR]: ac.principalNodeId,
                        onClick: S.nav._clickToOpenUserProfile,
                        className: "sharingName cursor-pointer",
                        title
                    }
                }
                else {
                    props = {
                        className: "sharingName",
                        title
                    }
                }

                if (numShares > 5) {
                    moreCount++;
                    showMore += S.util.getFriendlyPrincipalName(ac);
                    if (ac.displayName) {
                        showMore += " (" + ac.displayName + ")"
                    }
                    showMore += suffix;
                    showMore += "\n";
                }
                else {
                    const nameInSpan = S.util.getFriendlyPrincipalName(ac);
                    ret.push(new Span(nameInSpan + suffix, props));
                }
                numShares++;
            }
        }

        if (showMore) {
            ret.push(new Span(`${moreCount} more...`, { className: "sharingName", title: "Also shared to...\n" + showMore }));
        }
        return ret;
    }

    getPublicPrivilegsSuffix(principalName: string, node: NodeInfo): string {
        if (!node || !node.ac) return "";
        let val = "";
        for (const ac of node.ac) {
            if (ac.principalName === principalName) {
                // Note: I'm leaving this loop, but really all this will generate in 'val' is either nothing
                // at all or "(+R)" (for now)
                for (const p of ac.privileges) {
                    if (val) {
                        val += ",";
                    }

                    // +R = replies
                    if (p.privilegeName.indexOf(J.PrivilegeType.WRITE) !== -1) {
                        val += " +R";
                    }
                }
                break;
            }
        }
        return val;
    }

    processInboundNodes(nodes: NodeInfo[]) {
        if (!nodes) return;
        for (const node of nodes) {
            this.processInboundNode(node);
        }
    }

    processInboundNode(node: NodeInfo) {
        if (!node) return;
        const tags: string[] = S.props.getPropObj(J.NodeProp.OPEN_GRAPH, node);
        if (tags) {
            for (const t of tags) {
                const og: any = JSON.parse(t);
                if (!S.quanta.openGraphData.has(og.url)) {
                    S.quanta.openGraphData.set(og.url, og);
                }
            }
        }

        if (node.children) {
            this.processInboundNodes(node.children);
        }
    }

    isCutAttachment(att: Attachment, nodeId: string): boolean {
        const ast = getAs();
        return ast.cutAttachmentsFromId === nodeId && ast.cutAttachments && ast.cutAttachments.has((att as any).key);
    }

    _clearCut = (): void => {
        dispatch("undoCutAttachments", s => {
            s.cutAttachmentsFromId = null;
            s.cutAttachments = null;
        });
    }

    async paste(dlg: EditNodeDlg) {
        const ast = getAs();
        const res = await S.rpcUtil.rpc<J.PasteAttachmentsRequest, J.PasteAttachmentsResponse>("pasteAttachments", {
            sourceNodeId: ast.cutAttachmentsFromId,
            targetNodeId: ast.editNode.id,
            keys: Array.from(ast.cutAttachments)
        });

        ast.editNode.attachments = res.targetNode.attachments;
        dlg.binaryDirty = true;
        dlg.mergeState<EditNodeDlgState>({
            rerenderAfterClose: true
        });
        this._clearCut();
    }
}

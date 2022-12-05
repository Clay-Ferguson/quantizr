import { dispatch, getAppState } from "./AppContext";
import { AppState } from "./AppState";
import { Comp } from "./comp/base/Comp";
import { Icon } from "./comp/core/Icon";
import { Span } from "./comp/core/Span";
import { Constants as C } from "./Constants";
import { LoadNodeFromIpfsDlg } from "./dlg/LoadNodeFromIpfsDlg";
import { UserProfileDlg } from "./dlg/UserProfileDlg";
import * as J from "./JavaIntf";
import { S } from "./Singletons";
import { MainTab } from "./tabs/data/MainTab";

export class NodeUtil {
    getSelNodeIdsArray = (ast: AppState): string[] => {
        const sels: string[] = [];
        ast.selectedNodes.forEach(id => sels.push(id));
        return sels;
    }

    /* return an object with properties for each NodeInfo where the key is the id */
    getSelNodesAsMapById = (ast: AppState): Object => {
        const ret: Object = {};
        const selArray = this.getSelNodesArray(ast);
        if (!selArray || selArray.length === 0) {
            const node = this.getHighlightedNode(ast);
            if (node) {
                ret[node.id] = node;
                return ret;
            }
        }

        for (const sel of selArray) {
            ret[sel.id] = sel;
        }
        return ret;
    }

    /* Gets selected nodes as NodeInfo.java objects array */
    getSelNodesArray = (ast: AppState): J.NodeInfo[] => {
        const selArray: J.NodeInfo[] = [];
        ast.selectedNodes.forEach(id => {
            const node = MainTab.inst?.findNode(ast, id);
            if (node) {
                selArray.push(node);
            }
        });
        return selArray;
    }

    clearSelNodes = (ast: AppState = null) => {
        ast = getAppState(ast);
        dispatch("ClearSelections", s => {
            s.selectedNodes.clear();
            return s;
        });
    }

    selectAllNodes = (nodeIds: string[]) => {
        // DO NOT DELETE (feature work in progress)
        // //todo-2: large numbers of selected nodes isn't going to scale well in this design
        // // but i am not letting perfection be the enemy of good here (yet)
        // this.selectedNodes.clear();
        // nodeIds.forEach( (nodeId, index) => {
        //     this.selectedNodes.add(nodeId);
        // });
    }

    getHighlightedNode = (ast: AppState = null): J.NodeInfo => {
        ast = getAppState(ast);
        if (!ast.node) return null;
        const id: string = S.quanta.parentIdToFocusNodeMap.get(ast.node.id);
        if (id) {
            return MainTab.inst?.findNode(ast, id);
        }
        return null;
    }

    /* Returns true if successful */
    highlightRowById = (id: string, scroll: boolean, ast: AppState): boolean => {
        let node = MainTab.inst?.findNode(ast, id);
        let ret = true;

        /* If node not known, resort to taking the best, previous node we had */
        if (!node) {
            node = this.getHighlightedNode(ast);
        }

        if (node) {
            this.highlightNode(node, scroll, ast);
        } else {
            // if we can't find that node, best behvior is at least to scroll to top.
            if (scroll) {
                S.view.scrollToTop();
            }
            ret = false;
        }
        return ret;
    }

    highlightNode = (node: J.NodeInfo, scroll: boolean, ast: AppState) => {
        if (!node || !ast.node) {
            return;
        }

        if (!ast.isAnonUser) {
            S.util.updateHistory(ast.node, node, ast);
        }

        // this highlightNodeId is only really used to ensure state change happens, but really everything always
        // keys off parentIdToFocusNodeMap actually reading the value.
        ast.highlightNodeId = node.id;

        S.quanta.parentIdToFocusNodeMap.set(ast.node.id, node.id);

        if (scroll) {
            S.view.scrollToNode(ast, node);
        }
    }

    /* Find node by looking everywhere we possibly can on local storage for it */
    findNode = (ast: AppState, nodeId: string): J.NodeInfo => {
        for (const data of ast.tabData) {
            const node = data.findNode(ast, nodeId);
            if (node) return node;
        }
        return null;
    }

    clearLastNodeIds = () => {
        S.localDB.setVal(C.LOCALDB_LAST_PARENT_NODEID, null);
        S.localDB.setVal(C.LOCALDB_LAST_CHILD_NODEID, null);
    }

    /* WARNING: This is NOT the highlighted node. This is whatever node has the CHECKBOX selection */
    getSingleSelectedNode = (ast: AppState): J.NodeInfo => {
        let ret = null;
        // note: Set doesn't have a 'findFirst' so we can just use forEach instead
        ast.selectedNodes.forEach(id => {
            ret = MainTab.inst?.findNode(ast, id);
        });
        return ret;
    }

    /* Returns true if this node is able to have an effect on the tree, such that if it changed
    we would need to re-render the tree. For root top level call node==state.node */
    nodeIdIsVisible = (node: J.NodeInfo, nodeId: string, parentPath: string, ast: AppState): boolean => {
        if (!nodeId || !node) return false;
        if (node.id === nodeId || node.path === parentPath) return true;

        let ret = false;
        if (node.children) {
            // for now we do ONE level, and this would fail for
            node.children.forEach(n => {
                if (this.nodeIdIsVisible(n, nodeId, parentPath, ast)) {
                    ret = true;
                }
            });
        }
        return ret;
    }

    /* Returns the node if it's currently displaying on the page. For now we don't have ability */
    displayingOnTree = (ast: AppState, nodeId: string): J.NodeInfo => {
        if (!ast.node) return null;
        if (ast.node.id === nodeId) return ast.node;
        if (!ast.node.children) return null;
        return ast.node.children.find(node => node?.id === nodeId);
    }

    getNodeByName = (node: J.NodeInfo, name: string, ast: AppState): J.NodeInfo => {
        if (!node) return null;
        if (node.name === name) return node;

        if (node.children) {
            return ast.node.children.find(node => node?.name === name);
        }
        return null;
    }

    getPathPartForNamedNode = (node: J.NodeInfo): string => {
        if (!node || !node.name) return null;

        if (node.owner === J.PrincipalName.ADMIN) {
            return "/n/" + node.name;
        }
        else {
            return "/u/" + node.owner + "/" + node.name;
        }
    }

    getPathPartForNamedNodeAttachment = (node: J.NodeInfo): string => {
        if (!node || !node.name) return null;

        if (node.owner === J.PrincipalName.ADMIN) {
            return "/f/" + node.name;
        }
        else {
            return "/f/" + node.owner + "/" + node.name;
        }
    }

    getShortContent = (node: J.NodeInfo): string => {
        let content = node.content;
        if (!content) {
            if (node.name) {
                content = "Node Name: " + node.name;
            }
            else {
                return content;
            }
        }

        content = content.trim();

        const idx = content.indexOf("\n");
        if (idx !== -1) {
            content = content.substring(0, idx);
        }

        if (content.length > 140) content = content.substring(0, 140) + "...";
        while (content.startsWith("#")) {
            content = content.substring(1);
        }
        return content.trim();
    }

    // returns true if all children are same owner as parent
    allChildrenAreSameOwner = (node: J.NodeInfo): boolean => {
        if (!node || !node.children) return true;

        for (const child of node.children) {
            if (node.ownerId !== child.ownerId) {
                return false;
            }
        }
        return true;
    }

    publishNodeToIpfs = async (node: J.NodeInfo) => {
        const res = await S.rpcUtil.rpc<J.PublishNodeToIpfsRequest, J.PublishNodeToIpfsResponse>("publishNodeToIpfs", {
            nodeId: node.id
        });
        S.util.showMessage(res.message, "Server Reply", true);
    }

    loadNodeFromIpfs = (node: J.NodeInfo): any => {
        new LoadNodeFromIpfsDlg().open();
    }

    removePublicShare = async (node: J.NodeInfo, editorDlg: Comp) => {
        await S.rpcUtil.rpc<J.RemovePrivilegeRequest, J.RemovePrivilegeResponse>("removePrivilege", {
            nodeId: node.id,
            principalNodeId: J.PrincipalName.PUBLIC,
            privilege: "*"
        });
        this.removePrivilegeResponse(node, editorDlg);
    }

    removePrivilegeResponse = async (node: J.NodeInfo, editorDlg: Comp) => {
        const res = await S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: node.id
        });

        if (editorDlg) {
            const ast = getAppState();
            ast.editNode.ac = res.aclEntries;
            S.edit.updateNode(ast.editNode);
        }
    }

    getSharingNames = (ast: AppState, node: J.NodeInfo, editorDlg: Comp): Comp[] => {
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
                        className: "fa fa-globe fa-lg sharingIcon microMarginRight",
                        title: "Node is Public"
                    }),
                    new Span("Public" + this.getPublicPrivilegsSuffix(J.PrincipalName.PUBLIC, node))
                ])
            );
        }

        let showMore = "";
        let numShares = 0;
        for (const ac of node.ac) {
            const suffix = this.getPublicPrivilegsSuffix(ac.principalName, node);
            // todo-1: will come back to this. I think this happens when there's a share to a user whose
            // account no longer exists?
            // if (!ac.principalName) {
            //     console.log("missing principalName on acl: " + S.util.prettyPrint(node));
            // }

            // Skip public here we processed that above.
            if (ac.principalName && ac.principalName !== J.PrincipalName.PUBLIC) {
                let props = null;

                // If we have a local node for this user we will have the principleNodeId here and show a link
                // to open the user.
                if (ac.principalNodeId) {
                    props = {
                        onClick: (event: any) => {
                            event.stopPropagation();
                            event.preventDefault();
                            new UserProfileDlg(ac.principalNodeId).open();
                        },
                        className: "sharingName clickable",
                        title: "Shared to " + (ac.displayName || ac.principalName || "")
                    }
                }
                // todo-1: Else this is a foreign user, so is there a way to set a link
                // here to a foreign account, or should we basically run the equivalent
                // of a user search here, probably best done with a modifiction to the
                // UserPreferences server call and dialog
                else {
                    props = {
                        title: "Shared to " + (ac.displayName || ac.principalName || ""),
                        className: "sharingName"
                    }
                }

                if (numShares > 5) {
                    showMore += "@" + ac.principalName;
                    if (ac.displayName) {
                        showMore += " (" + ac.displayName + ")"
                    }
                    showMore += suffix;
                    showMore += "\n";
                }
                else {
                    let nameInSpan = ac.principalName;

                    // If nameInSpan contains '@' (a foreign user) then chop off the server name to make the
                    // display shorter
                    const atIdx = nameInSpan.indexOf("@");
                    if (atIdx !== -1) {
                        nameInSpan = nameInSpan.substring(0, atIdx);
                    }

                    ret.push(new Span("@" + nameInSpan + suffix, props));
                }
                numShares++;
            }
        }

        if (showMore) {
            ret.push(new Span("more...", { className: "sharingName", title: "Also shared to...\n" + showMore }));
        }

        if (numShares > 0 && editorDlg) {
            // this 'as any' is a temp hack (to avoid circular ref) todo-1
            ret.push(new Span("Add to Content", { className: "marginLeft clickable", onClick: () => (editorDlg as any).addSharingToContentText() }));
        }

        return ret;
    }

    // todo-1: this method is way more complicated than it needs to be.
    getPublicPrivilegsSuffix = (principalName: string, node: J.NodeInfo): string => {
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
                    // val += p.privilegeName;
                }
                break;
            }
        }
        return val;
    }
}

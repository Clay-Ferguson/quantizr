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
    getSelNodeIdsArray = (state: AppState): string[] => {
        const sels: string[] = [];
        state.selectedNodes.forEach(id => {
            sels.push(id);
            return true;
        });
        return sels;
    }

    /* return an object with properties for each NodeInfo where the key is the id */
    getSelNodesAsMapById = (state: AppState): Object => {
        const ret: Object = {};
        const selArray = this.getSelNodesArray(state);
        if (!selArray || selArray.length === 0) {
            const node = this.getHighlightedNode(state);
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
    getSelNodesArray = (state: AppState): J.NodeInfo[] => {
        const selArray: J.NodeInfo[] = [];
        state.selectedNodes.forEach(id => {
            const node = MainTab.inst?.findNode(state, id);
            if (node) {
                selArray.push(node);
            }
            return true;
        });
        return selArray;
    }

    clearSelNodes = (state: AppState = null) => {
        state = getAppState(state);
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

    // note: this code is not currently in use
    updateNodeInfo = (node: J.NodeInfo) => {
        S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: node.id,
            includeAcl: false,
            includeOwners: true
        });
    }

    getHighlightedNode = (state: AppState = null): J.NodeInfo => {
        state = getAppState(state);
        if (!state.node) return null;
        const id: string = S.quanta.parentIdToFocusNodeMap.get(state.node.id);
        if (id) {
            return MainTab.inst?.findNode(state, id);
        }
        return null;
    }

    /* Returns true if successful */
    highlightRowById = (id: string, scroll: boolean, state: AppState): boolean => {
        // Log.log("highlightRowById: " + id);
        let node = MainTab.inst?.findNode(state, id);
        let ret = true;

        /* If node not known, resort to taking the best, previous node we had */
        if (!node) {
            node = this.getHighlightedNode(state);
            // console.log("state.idToNodeMap missing: " + id);
        }

        if (node) {
            this.highlightNode(node, scroll, state);
        } else {
            // if we can't find that node, best behvior is at least to scroll to top.
            if (scroll) {
                S.view.scrollToTop();
            }
            ret = false;
            // Log.log("highlightRowById failed to find id: " + id);
        }
        return ret;
    }

    highlightNode = (node: J.NodeInfo, scroll: boolean, state: AppState) => {
        // console.log("highlightNode: " + node.id);
        if (!node || !state.node) {
            return;
        }

        if (!state.isAnonUser) {
            S.util.updateHistory(state.node, node, state);
        }

        // this highlightNodeId is only really used to ensure state change happens, but really everything always
        // keys off parentIdToFocusNodeMap actually reading the value.
        state.highlightNodeId = node.id;

        S.quanta.parentIdToFocusNodeMap.set(state.node.id, node.id);

        if (scroll) {
            S.view.scrollToNode(state, node);
        }
    }

    /* Find node by looking everywhere we possibly can on local storage for it */
    findNode = (state: AppState, nodeId: string): J.NodeInfo => {
        for (const data of state.tabData) {
            const node = data.findNode(state, nodeId);
            if (node) return node;
        }
        return null;
    }

    clearLastNodeIds = () => {
        S.localDB.setVal(C.LOCALDB_LAST_PARENT_NODEID, null);
        S.localDB.setVal(C.LOCALDB_LAST_CHILD_NODEID, null);
    }

    /* WARNING: This is NOT the highlighted node. This is whatever node has the CHECKBOX selection */
    getSingleSelectedNode = (state: AppState): J.NodeInfo => {
        let ret = null;
        // todo-1: this was lazy coding. I really just need the FIRST one of the set, and no need to iterate all.
        state.selectedNodes.forEach(id => {
            ret = MainTab.inst?.findNode(state, id);
        });
        return ret;
    }

    /* Returns true if this node is able to have an effect on the tree, such that if it changed
    we would need to re-render the tree. For root top level call node==state.node */
    nodeIdIsVisible = (node: J.NodeInfo, nodeId: string, parentPath: string, state: AppState): boolean => {
        if (!nodeId || !node) return false;
        if (node.id === nodeId || node.path === parentPath) return true;

        let ret = false;
        if (node.children) {
            // for now we do ONE level, and this would fail for
            node.children.forEach((n: any) => {
                if (this.nodeIdIsVisible(n, nodeId, parentPath, state)) {
                    ret = true;
                }
            }, this);
        }
        return ret;
    }

    /* Returns the node if it's currently displaying on the page. For now we don't have ability */
    displayingOnTree = (state: AppState, nodeId: string): J.NodeInfo => {
        if (!state.node) return null;
        if (state.node.id === nodeId) return state.node;
        if (!state.node.children) return null;
        return state.node.children.find(node => node.id === nodeId);
    }

    getNodeByName = (node: J.NodeInfo, name: string, state: AppState): J.NodeInfo => {
        if (!node) return null;
        if (node.name === name) return node;

        if (node.children) {
            return state.node.children.find(node => node.name === name);
        }
        return null;
    }

    getPathPartForNamedNode = (node: J.NodeInfo): string => {
        if (!node || !node.name) return null;

        if (node.owner === "admin") {
            return "/n/" + node.name;
        }
        else {
            return "/u/" + node.owner + "/" + node.name;
        }
    }

    getPathPartForNamedNodeAttachment = (node: J.NodeInfo): string => {
        if (!node || !node.name) return null;

        if (node.owner === "admin") {
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

        content = S.util.replaceAll(content, "{{imgUpperRight}}", "");
        content = S.util.replaceAll(content, "{{imgUpperLeft}}", "");
        content = S.util.replaceAll(content, "{{imgUpperCenter}}", "");
        content = S.util.replaceAll(content, "{{img}}", "");
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
            principalNodeId: "public",
            privilege: "*"
        });
        this.removePrivilegeResponse(node, editorDlg);
    }

    removePrivilegeResponse = async (node: J.NodeInfo, editorDlg: Comp) => {
        const res = await S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: node.id,
            includeAcl: true,
            includeOwners: true
        });

        if (editorDlg) {
            const appState = getAppState();
            appState.editNode.ac = res.aclEntries;
            S.edit.updateNode(appState.editNode);
        }
    }

    getSharingNames = (state: AppState, node: J.NodeInfo, editorDlg: Comp): Comp[] => {
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
                    new Span("Public" + this.getPublicPrivilegesDisplay(node))
                ])
            );
        }

        let showMore = "";
        let numShares = 0;
        for (const ac of node.ac) {
            if (!ac.principalName) {
                console.log("missing principalName on acl: " + S.util.prettyPrint(ac));
            }

            // Skip public here we processed that above.
            if (ac.principalName && ac.principalName !== "public") {
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
                    showMore += "\n";
                }
                else {
                    ret.push(new Span("@" + ac.principalName, props));
                }
                numShares++;
            }
        }

        if (showMore) {
            ret.push(new Span("more...", { className: "sharingName", title: "Also shared to...\n" + showMore }));
        }

        return ret;
    }

    getPublicPrivilegesDisplay = (node: J.NodeInfo): string => {
        if (!node || !node.ac) return "";
        let val = "";
        for (const ac of node.ac) {
            if (ac.principalName === "public") {
                // console.log("AC: " + S.util.prettyPrint(ac));
                // Note: I'm leaving this loop, but really all this will generate in 'val' is either nothing
                // at all or "(+Replies)" (for now)
                for (const p of ac.privileges) {
                    if (val) {
                        val += ",";
                    }

                    if (p.privilegeName.indexOf(J.PrivilegeType.WRITE) !== -1) {
                        val += "+Replies";
                    }
                    // val += p.privilegeName;
                }
                break;
            }
        }
        return val;
    }
}

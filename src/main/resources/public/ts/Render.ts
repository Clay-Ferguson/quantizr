import * as J from "./JavaIntf";
import { Comp } from "./widget/base/Comp";
import { Button } from "./widget/Button";
import { ButtonBar } from "./widget/ButtonBar";
import { Img } from "./widget/Img";
import { Constants as C } from "./Constants";
import { RenderIntf } from "./intf/RenderIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import * as marked from 'marked';
import * as highlightjs from 'highlightjs';
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import { NavBarIconButton } from "./widget/NavBarIconButton";
import { NodeCompVerticalRowLayout } from "./comps/NodeCompVerticalRowLayout";
import { NodeCompTableRowLayout } from "./comps/NodeCompTableRowLayout";
import { AppState } from "./AppState";
import { dispatch } from "./AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

declare var MathJax;

export class Render implements RenderIntf {

    private debug: boolean = false;
    private markedRenderer = null;

    /* Since js is singlethreaded we can have lastOwner get updated from any other function and use it to keep track
    during the rendering, what the last owner was so we can keep from displaying the same avatars unnecessarily */
    public lastOwner: string;

    injectSubstitutions = (val: string): string => {
        val = S.util.replaceAll(val, "{{locationOrigin}}", window.location.origin);

        if (val.indexOf("{{paypal-button}}") != -1) {
            val = S.util.replaceAll(val, "{{paypal-button}}", C.PAY_PAL_BUTTON);
        }
        return val;
    }

    /**
     * See: https://github.com/highlightjs/highlight.js
     */
    initMarkdown = (): void => {
        if (this.markedRenderer) return;
        this.markedRenderer = new marked.Renderer();

        this.markedRenderer.code = (code, language) => {
            // Check whether the given language is valid for highlight.js.
            const validLang = !!(language && highlightjs.getLanguage(language));

            // Highlight only if the language is valid.
            const highlighted = validLang ? highlightjs.highlight(language, code).value : code;

            // Render the highlighted code with `hljs` class.
            return `<pre><code class="hljs ${language}">${highlighted}</code></pre>`;
        };

        marked.setOptions({
            renderer: this.markedRenderer,

            //This appears to be working just fine, but i don't have the CSS styles added into the distro yet
            //so none of the actual highlighting works yet, so i'm just commenting out for now, until i add classes.
            //
            //Note: using the 'markedRenderer.code' set above do we still need this highlight call here? I have no idea. Need to check/test
            highlight: function (code) {
                return highlightjs.highlightAuto(code).value;
            },

            gfm: true,
            tables: true,
            breaks: false,
            pedantic: false,
            sanitize: true,
            smartLists: true,
            smartypants: false
        });
    }

    setNodeDropHandler = (rowDiv: Comp, node: J.NodeInfo, state: AppState): void => {
        if (!node || !rowDiv) return;

        //use cached function here.
        rowDiv.setDropHandler((evt: DragEvent) => {
            let data = evt.dataTransfer.items;

            //todo-1: right now we only actually support one file being dragged. Would be nice to support multiples
            for (let i = 0; i < data.length; i++) {
                let d = data[i];
                console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);

                if (d.kind == 'string' && d.type.match('^text/uri-list')) {
                    d.getAsString((s) => {
                        /* Disallow dropping from our app onto our app */
                        if (s.startsWith(location.protocol + '//' + location.hostname)) {
                            return;
                        }
                        S.attachment.openUploadFromUrlDlg(node, s, state);
                    });
                    return;
                }
                else if (d.kind == 'string' && d.type.match('^text/html')) {

                }
                else if (d.kind == 'file' /* && d.type.match('^image/') */) {
                    let file: File = data[i].getAsFile();

                    // if (file.size > Constants.MAX_UPLOAD_MB * Constants.ONE_MB) {
                    //     S.util.showMessage("That file is too large to upload. Max file size is "+Constants.MAX_UPLOAD_MB+" MB");
                    //     return;
                    // }

                    S.attachment.openUploadFromFileDlg(false, node, file, state);
                    return;
                }
            }
        });
    }

    showNodeUrl = (state: AppState): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode(state);
        if (!node) {
            S.util.showMessage("You must first click on a node.", "Warning");
            return;
        }

        S.meta64.selectTab("mainTab");
        let message: string = "ID-based URL: \n" + window.location.origin + "?id=" + node.id;
        if (node.name) {
            message += "\n\nName-based URL: \n" + window.location.origin + "?n=" + node.name;
        }

        S.util.showMessage(message, "URL", true);
    }

    allowAction = (typeHandler: TypeHandlerIntf, action: string): boolean => {
        return typeHandler == null || typeHandler.allowAction(action);
    }

    renderPageFromData = (res: J.RenderNodeResponse, scrollToTop: boolean, targetNodeId: string, clickTab: boolean = true, state: AppState): void => {
        if (res.noDataResponse) {
            S.util.showMessage(res.noDataResponse, "Note");
            return;
        }
        this.lastOwner = null;

        try {
            dispatch({
                type: "Action_RenderPage", state,
                updateNew: (s: AppState): AppState => {
                    s.node = res.node;
                    s.endReached = res.endReached;
                    s.offsetOfNodeFound = res.offsetOfNodeFound;
                    s.displayedParent = res.displayedParent;

                    S.meta64.updateNodeMap(res.node, 1, s);
                    s.selectedNodes = {};

                    if (s.node) {
                        //now that 'redux' is in control and we call this method less directly/often, I need to check to see if
                        //this method is getting called every time it should.
                        S.localDB.setVal(C.LOCALDB_LAST_PARENT_NODEID, s.node.id);
                        S.localDB.setVal(C.LOCALDB_LAST_CHILD_NODEID, targetNodeId);
                    }

                    if (this.debug && s.node) {
                        console.log("RENDER NODE: " + s.node.id);
                    }

                    if (state.pendingLocationHash) {
                        window.location.hash = state.pendingLocationHash;
                        //Note: the substring(1) trims the "#" character off.
                        S.meta64.highlightRowById(state.pendingLocationHash.substring(1), true, s);
                        state.pendingLocationHash = null;
                    }
                    else if (targetNodeId) {
                        S.meta64.highlightRowById(targetNodeId, true, s);
                    } //
                    else if (scrollToTop || !S.meta64.getHighlightedNode(s)) {
                        S.view.scrollToTop();
                    } //
                    else {
                        S.view.scrollToSelectedNode(s);
                    }

                    return s;
                }
            });

            if (clickTab) {
                S.meta64.selectTab("mainTab");
            }

            this.lastOwner = state.node.owner;
        }
        catch (err) {
            console.error("render failed.");
        }
    }

    renderChildren = (node: J.NodeInfo, level: number, allowNodeMove: boolean): Comp => {
        if (!node || !node.children) return null;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on
         * the client side for various reasons.
         */
        let layout = S.props.getNodePropVal(J.NodeProp.LAYOUT, node);
        if (!layout || layout == "v") {
            return new NodeCompVerticalRowLayout(node, level, allowNodeMove);
        }
        else if (layout.indexOf("c") == 0) {
            return new NodeCompTableRowLayout(node, level, layout, allowNodeMove);
        }
        else {
            //of no layout is valid, fall back on vertical.
            return new NodeCompVerticalRowLayout(node, level, allowNodeMove);
        }
    }

    /* This is the button bar displayed between all nodes to let nodes be inserted at specific locations 
    
    The insert will be below the node unless isFirst is true and then it will be at 0 (topmost)
    */
    createBetweenNodeButtonBar = (node: J.NodeInfo, isFirst: boolean, isLastOnPage: boolean, state: AppState): Comp => {
        let pasteInlineButton: Button = null;

        if (!state.isAnonUser && state.nodesToMove != null && (S.props.isMine(node, state) || node.id == state.homeNodeId)) {

            let func: Function = null;
            if (state.endReached) {
                func = S.meta64.getNodeFunc(S.edit.cached_pasteSelNodes_InlineEnd, "S.edit.pasteSelNodes_InlineEnd", node.id);
            }
            else if (isFirst) {
                func = S.meta64.getNodeFunc(S.edit.cached_pasteSelNodes_InlineAbove, "S.edit.pasteSelNodes_InlineAbove", node.id);
            }
            else {
                func = S.meta64.getNodeFunc(S.edit.cached_pasteSelNodes_Inline, "S.edit.pasteSelNodes_Inline", node.id);
            }

            pasteInlineButton = new Button("Paste Inline", func, {
                className: "highlightBorder"
            });
        }

        let newNodeButton = new NavBarIconButton("fa-plus", null, {
            onClick: e => {
                S.edit.insertNode(node.id, "u", isFirst ? 0 : 1, state);
            },
            title: "Insert new node here"
        }, "btn-sm");
        let buttonBar = new ButtonBar([pasteInlineButton, newNodeButton],
            null, "float-right " + (isFirst ? "marginTop" : ""));
        return buttonBar;
    }

    getAttachmentUrl = (urlPart: string, node: J.NodeInfo): string => {
        let filePart = S.props.getNodePropVal(J.NodeProp.BIN, node);

        if (!filePart) {
            filePart = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, node);
            if (filePart) {
                return C.IPFS_GATEWAY + filePart;
            }
        }

        let ret = S.util.getRpcPath() + urlPart + "/" + filePart + "?nodeId=" + node.id;
        return ret;
    }

    getUrlForNodeAttachment = (node: J.NodeInfo): string => {
        if (node.dataUrl) {
            return node.dataUrl;
        }
        else {
            return this.getAttachmentUrl("bin", node);
        }
    }

    getStreamUrlForNodeAttachment = (node: J.NodeInfo): string => {
        return this.getAttachmentUrl("stream", node);
    }

    getAvatarImgUrl = (node: J.NodeInfo) => {
        if (!node.avatarVer) return null;
        return S.util.getRpcPath() + "bin/avatar" + "?nodeId=" + node.ownerId + "&v=" + node.avatarVer;
    }

    makeAvatarImage = (node: J.NodeInfo, state: AppState) => {
        let src: string = this.getAvatarImgUrl(node);
        if (!src) {
            return null;
        }
        let key = "avatar-" + node.id;

        //Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        let img: Img = new Img(key, {
            src,
            className: "avatarImage",
            title: "Node owned by: "+node.owner,

            // I decided not to let avatars be clickable.
            // onClick: (evt) => {
            //     dispatch({
            //         type: "Action_ClickImage", state,
            //         update: (s: AppState): void => {
            //             if (s.expandedImages[key]) {
            //                 delete s.expandedImages[key];
            //             }
            //             else {
            //                 s.expandedImages[key] = "y";
            //             }
            //         },
            //     });
            // }
        });

        return img;
    }

    allowPropertyToDisplay = (propName: string): boolean => {
        //if (S.meta64.isAdminUser) return true;
        if (propName.startsWith("sn:")) return false;

        let allow = !S.props.simpleModePropertyBlackList[propName];
        console.log("Allow Prop " + propName + " = " + allow);
        return allow;
    }

    /* Returns true of the logged in user and the type of node allow the property to be edited by the user */
    allowPropertyEdit = (node: J.NodeInfo, propName: string, state: AppState): boolean => {
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        if (typeHandler) {
            return typeHandler.allowPropertyEdit(propName, state);
        }
        else {
            return this.allowPropertyToDisplay(propName);
        }
    }

    isReadOnlyProperty = (propName: string): boolean => {
        return S.props.readOnlyPropertyList[propName];
    }
}

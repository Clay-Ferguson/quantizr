import * as highlightjs from "highlightjs";
import * as marked from "marked";
import { dispatch } from "./AppRedux";
import { AppState } from "./AppState";
import { NodeCompTableRowLayout } from "./comps/NodeCompTableRowLayout";
import { NodeCompVerticalRowLayout } from "./comps/NodeCompVerticalRowLayout";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { NodeActionType } from "./enums/NodeActionType";
import { RenderIntf } from "./intf/RenderIntf";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { Anchor } from "./widget/Anchor";
import { Comp } from "./widget/base/Comp";
import { Button } from "./widget/Button";
import { Div } from "./widget/Div";
import { Heading } from "./widget/Heading";
import { IconButton } from "./widget/IconButton";
import { Img } from "./widget/Img";
import { QuickEditField } from "./widget/QuickEditField";
import { Span } from "./widget/Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Render implements RenderIntf {

    private debug: boolean = false;
    private markedRenderer = null;
    fadeInId: string;

    /* Since js is singlethreaded we can have lastOwner get updated from any other function and use it to keep track
    during the rendering, what the last owner was so we can keep from displaying the same avatars unnecessarily */
    public lastOwner: string;

    injectSubstitutions = (val: string): string => {
        val = S.util.replaceAll(val, "{{locationOrigin}}", window.location.origin);

        if (val.indexOf("{{paypal-button}}") !== -1) {
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

    setNodeDropHandler = (attribs: any, node: J.NodeInfo, isFirst: boolean, state: AppState): void => {
        if (!node) return;
        //console.log("Setting drop handler: id="+node.id);

        S.util.setDropHandler(attribs, (evt: DragEvent) => {
            const data = evt.dataTransfer.items;

            //todo-1: right now we only actually support one file being dragged. Would be nice to support multiples
            for (let i = 0; i < data.length; i++) {
                const d = data[i];
                console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);

                if (d.kind === "string") {
                    d.getAsString((s) => {
                        if (d.type.match("^text/uri-list")) {
                            /* Disallow dropping from our app onto our app */
                            if (s.startsWith(location.protocol + "//" + location.hostname)) {
                                return;
                            }
                            S.attachment.openUploadFromUrlDlg(node, s, null, state);
                        }
                        /* this is the case where a user is moving a node by dragging it over another node */
                        else if (s.startsWith(S.nav._UID_ROWID_PREFIX)) {
                            S.edit.moveNodeByDrop(node.id, s.substring(4), isFirst);
                        }
                    });
                    return;
                }
                else if (d.kind === "string" && d.type.match("^text/html")) {
                }
                else if (d.kind === "file" /* && d.type.match('^image/') */) {
                    const file: File = data[i].getAsFile();

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

    /* nodeId is parent node to query for calendar content */
    showCalendar = (nodeId: string, state: AppState): void => {
        if (!nodeId) {
            let node = S.meta64.getHighlightedNode(state);
            if (node) {
                nodeId = node.id;
            }
        }
        if (!nodeId) {
            S.util.showMessage("You must first click on a node.", "Warning");
            return;
        }

        S.util.ajax<J.RenderCalendarRequest, J.RenderCalendarResponse>("renderCalendar", {
            nodeId
        }, (res: J.RenderCalendarResponse) => {
            dispatch({
                type: "Action_ShowCalendar",
                state,
                update: (s: AppState): void => {
                    s.fullScreenCalendarId = nodeId;
                    s.calendarData = S.util.buildCalendarData(res.items);
                }
            });
        });
    }

    showNodeUrl = (node: J.NodeInfo, state: AppState): void => {
        if (!node) {
            node = S.meta64.getHighlightedNode(state);
        }
        if (!node) {
            S.util.showMessage("You must first click on a node.", "Warning");
            return;
        }

        const children = [];

        //todo-1: need copy-to-clipboard links here!

        let url = window.location.origin + "/app?id=" + node.id;
        children.push(new Heading(5, "By ID"));
        children.push(new Anchor(url, url, {
            target: "_blank",
            className: "anchorBigMarginBottom"
        }));

        if (node.name) {
            url = window.location.origin + S.util.getPathPartForNamedNode(node);
            children.push(new Heading(5, "By Name"));
            children.push(new Anchor(url, url, {
                target: "_blank",
                className: "anchorBigMarginBottom"
            }));
        }

        // Disabling this for now since the Quanta server doesn't directly expose it's Gateway to the outside world.
        // let attachmentIpfsLink = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, node);
        // if (attachmentIpfsLink) {
        //     url = S.render.getUrlForNodeAttachment(node, true);
        //     children.push(new Heading(5, "IPFS File Attachment"));
        //     children.push(new Anchor(url, url, {
        //         target: "_blank",
        //         className: "anchorBigMarginBottom"
        //     }));
        // }

        const jsonIpfsLink = S.props.getNodePropVal(J.NodeProp.JSON_HASH, node);
        if (jsonIpfsLink) {
            url = C.IPFS_IO_GATEWAY + jsonIpfsLink;
            children.push(new Heading(5, "IPFS Node JSON"));
            children.push(new Anchor(url, url, {
                target: "_blank",
                className: "anchorBigMarginBottom"
            }));
        }

        const linksDiv = new Div(null, null, children);
        new MessageDlg(null, "URL", null, linksDiv, false, 0, null).open();
    }

    allowAction = (typeHandler: TypeHandlerIntf, action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean => {
        return typeHandler == null || typeHandler.allowAction(action, node, appState);
    }

    renderPageFromData = (res: J.RenderNodeResponse, scrollToTop: boolean, targetNodeId: string, clickTab: boolean = true, allowScroll: boolean = true, state: AppState): void => {
        if (res && res.noDataResponse) {
            S.util.showMessage(res.noDataResponse, "Note");
            return;
        }
        this.lastOwner = null;

        try {
            dispatch({
                type: "Action_RenderPage",
                state,
                updateNew: (s: AppState): AppState => {
                    //VERY IMPORTANT to return a NEW object so we create it here. If you don't return new object rendering can fail.
                    s = { ...s };

                    if (!s.activeTab || clickTab) {
                        s.activeTab = "mainTab";
                    }

                    s.guiReady = true;

                    if (res) {
                        s.node = res.node;
                        s.endReached = res.endReached;
                        s.offsetOfNodeFound = res.offsetOfNodeFound;
                        s.displayedParent = res.displayedParent;
                    }

                    s.idToNodeMap = {};
                    if (res) S.meta64.updateNodeMap(res.node, s);

                    if (targetNodeId) {
                        //If you access /n/myNodeName we get here with targetNodeId being the name (and not the ID)
                        //so we have to call getNodeByName() to get the 'id' that goes with that node name.
                        if (targetNodeId.startsWith(":")) {
                            targetNodeId = targetNodeId.substring(1);
                            const foundNode: J.NodeInfo = S.meta64.getNodeByName(res.node, targetNodeId, s);
                            if (foundNode) {
                                targetNodeId = foundNode.id;
                            }
                        }

                        S.render.fadeInId = targetNodeId;

                        //this is new. not fully vetted.
                        state.pendingLocationHash = null;
                    }

                    s.selectedNodes = {};

                    if (s.node && !state.isAnonUser) {
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
                        if (allowScroll) {
                            S.meta64.highlightRowById(state.pendingLocationHash.substring(1), true, s);
                        }
                        state.pendingLocationHash = null;
                    }
                    else if (allowScroll && targetNodeId) {
                        S.meta64.highlightRowById(targetNodeId, true, s);
                    } //
                    else if (allowScroll && (scrollToTop || !S.meta64.getHighlightedNode(s))) {
                        S.view.scrollToTop();
                    } //
                    else if (allowScroll) {
                        S.view.scrollToSelectedNode(s);
                    }

                    return s;
                }
            });

            if (state.node) {
                this.lastOwner = state.node.owner;
            }
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
        const layout = S.props.getNodePropVal(J.NodeProp.LAYOUT, node);
        if (!layout || layout === "v") {
            return new NodeCompVerticalRowLayout(node, level, allowNodeMove);
        }
        else if (layout.indexOf("c") === 0) {
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

        if (!state.isAnonUser && !!state.nodesToMove && (S.props.isMine(node, state) || node.id === state.homeNodeId)) {

            //console.log("pasteSelButton: node.id=" + node.id + " isFirst=" + isFirst);

            let func: Function = null;
            if (isFirst) {
                func = S.meta64.getNodeFunc(S.edit.cached_pasteSelNodes_InlineAbove, "S.edit.pasteSelNodes_InlineAbove", node.id);
            }
            else {
                func = S.meta64.getNodeFunc(S.edit.cached_pasteSelNodes_Inline, "S.edit.pasteSelNodes_Inline", node.id);
            }

            pasteInlineButton = new Button("Paste Inline", func, {
                className: "highlightBorder"
            });
        }

        const newNodeButton = new IconButton("fa-plus", null, {
            onClick: e => {
                S.edit.insertNode(node.id, "u", isFirst ? 0 : 1, state);
            },
            title: "Insert new node here"
        }, "btn-sm");

        const buttonBar = new Span(null, {
            className: "float-right microMarginTop"
        }, [pasteInlineButton, newNodeButton]);

        return new Div(null, {
            className: "betweenRowsContainer row no-gutters"
        }, [
            new QuickEditField(node, isFirst, state),
            new Span(null, {
                className: "col"
            }, [buttonBar])
        ]);
    }

    getAttachmentUrl = (urlPart: string, node: J.NodeInfo, downloadLink: boolean): string => {
        const ipfsLink = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, node);

        /* If we had a public gateway we could actually trust we could return this, but gateways have a tendency
         to be flaky and often appear to blacklist videos uploated thru Quanta.wiki, and I won't even speculate why */
        // if (ipfsLink) {
        //     return C.IPFS_IO_GATEWAY + ipfsLink;
        // }

        // If there's no IPFS_LINK on the node try the BIN prop instead.
        const bin = ipfsLink || S.props.getNodePropVal(J.NodeProp.BIN, node);
        if (bin) {
            let ret: string = S.util.getRpcPath() + urlPart + "/" + bin + "?nodeId=" + node.id;
            if (downloadLink) {
                ret += "&download=true";
            }
            return ret;
        }

        return null;
    }

    getUrlForNodeAttachment = (node: J.NodeInfo, downloadLink: boolean): string => {
        let ret = null;
        if (node.dataUrl) {
            ret = node.dataUrl;
            //console.log("getUrlForNodeAttachment: id="+node.id+" url="+ret+" from dataUrl");
        }
        else {
            ret = this.getAttachmentUrl("bin", node, downloadLink);
            //console.log("getUrlForNodeAttachment: id=" + node.id + " url=" + ret + " from bin");
        }
        return ret;
    }

    getStreamUrlForNodeAttachment = (node: J.NodeInfo): string => {
        return this.getAttachmentUrl("stream", node, false);
    }

    getAvatarImgUrl = (ownerId: string, avatarVer: string) => {
        if (!avatarVer) return null;
        return S.util.getRpcPath() + "bin/avatar" + "?nodeId=" + ownerId + "&v=" + avatarVer;
    }

    makeAvatarImage = (node: J.NodeInfo, state: AppState) => {
        const src: string = this.getAvatarImgUrl(node.ownerId, node.avatarVer);
        if (!src) {
            return null;
        }
        const key = "avatar-" + node.id;

        //Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        const img: Img = new Img(key, {
            src,
            className: "avatarImage",
            title: "Node owned by: " + node.owner

            // I decided not to let avatars be clickable.
            // onClick: (evt) => {
            //     dispatch({
            //         type: "Action_ClickImage", state,
            //         update: (s: AppState): void => {
            //         },
            //     });
            // }
        });

        return img;
    }

    /* Returns true if the logged in user and the type of node allow the property to be edited by the user */
    allowPropertyEdit = (node: J.NodeInfo, propName: string, state: AppState): boolean => {
        const typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        return typeHandler ? typeHandler.allowPropertyEdit(propName, state) : true;
    }

    isReadOnlyProperty = (propName: string): boolean => {
        return S.props.readOnlyPropertyList.has(propName);
    }
}

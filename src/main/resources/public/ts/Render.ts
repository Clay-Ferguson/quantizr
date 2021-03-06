import * as highlightjs from "highlightjs";
import * as marked from "marked";
import { dispatch } from "./AppRedux";
import { AppState } from "./AppState";
import clientInfo from "./ClientInfo";
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
import { Comp } from "./widget/base/Comp";
import { Div } from "./widget/Div";
import { Heading } from "./widget/Heading";
import { Img } from "./widget/Img";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Render implements RenderIntf {

    private debug: boolean = false;
    private markedRenderer = null;

    // After adding the breadcrumb query it's a real challenge to get this fading to work right, so for now
    // I'm disabling it entirely with this flag.
    enableRowFading: boolean = true;

    fadeInId: string;
    allowFadeInId: boolean = false;

    injectSubstitutions = (node: J.NodeInfo, val: string): string => {
        val = S.util.replaceAll(val, "{{locationOrigin}}", window.location.origin);

        if (val.indexOf("{{paypal-button}}") !== -1) {
            val = S.util.replaceAll(val, "{{paypal-button}}", C.PAY_PAL_BUTTON);
        }

        /* Allow the <img> tag to be supported inside the markdown for any node and let {{imgUrl}}, be able to be used in
         that to reference the url of any attached image.

         This allows the following type of thing to be put inside the markdown at the beginning of the text:,
         whenever you want to make the text flow around an image. This text currently has to be entered
         manually but in the future we'll have a way to generate this more 'automatically' based on editor options.

         <img class="img-upper-left" width="100px" src="{{imgUrl}}">
         <div class="clearfix"/>
         */
        if (val.indexOf("{{imgUrl}}")) {
            let src: string = S.render.getUrlForNodeAttachment(node, false);
            val = val.replace("{{imgUrl}}", src);
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

            // This appears to be working just fine, but i don't have the CSS styles added into the distro yet
            // so none of the actual highlighting works yet, so i'm just commenting out for now, until i add classes.
            //
            // Note: using the 'markedRenderer.code' set above do we still need this highlight call here? I have no idea. Need to check/test
            highlight: function (code) {
                return highlightjs.highlightAuto(code).value;
            },

            gfm: true,
            tables: true,
            breaks: false,
            pedantic: false,
            smartLists: true,
            smartypants: false
        });
    }

    setNodeDropHandler = (attribs: any, node: J.NodeInfo, isFirst: boolean, state: AppState): void => {
        if (!node) return;
        // console.log("Setting drop handler: nodeId=" + node.id + " attribs.id=" + attribs.id);

        S.util.setDropHandler(attribs, (evt: DragEvent) => {
            const data = evt.dataTransfer.items;

            // todo-2: right now we only actually support one file being dragged? Would be nice to support multiples
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
                            S.attachment.openUploadFromUrlDlg(node ? node.id : null, s, null, state);
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

        let byIdUrl = window.location.origin + "/app?id=" + node.id;
        children.push(new Heading(5, "By ID"));
        children.push(new Div(byIdUrl, {
            className: "anchorBigMarginBottom",
            title: "Click -> Copy to clipboard",
            onClick: () => {
                S.util.copyToClipboard(byIdUrl);
                S.util.flashMessage("Copied to Clipboard: " + byIdUrl, "Clipboard", true);
            }
        }));

        if (node.name) {
            let byNameUrl = window.location.origin + S.util.getPathPartForNamedNode(node);
            children.push(new Heading(5, "By Name"));
            children.push(new Div(byNameUrl, {
                className: "anchorBigMarginBottom",
                title: "Click -> Copy to clipboard",
                onClick: () => {
                    S.util.copyToClipboard(byNameUrl);
                    S.util.flashMessage("Copied to Clipboard: " + byNameUrl, "Clipboard", true);
                }
            }));
        }

        let rssFeed = window.location.origin + "/rss?id=" + node.id;
        children.push(new Heading(5, "Node RSS Feed"));
        children.push(new Div(rssFeed, {
            className: "anchorBigMarginBottom",
            title: "Click -> Copy to clipboard",
            onClick: () => {
                S.util.copyToClipboard(rssFeed);
                S.util.flashMessage("Copied to Clipboard: " + rssFeed, "Clipboard", true);
            }
        }));

        let bin = S.props.getNodePropVal(J.NodeProp.BIN, node);
        if (bin) {
            let attByIdUrl = window.location.origin + "/f/id/" + node.id;
            children.push(new Heading(5, "View Attachment By Id"));
            children.push(new Div(attByIdUrl, {
                className: "anchorBigMarginBottom",
                title: "Click -> Copy to clipboard",
                onClick: () => {
                    S.util.copyToClipboard(attByIdUrl);
                    S.util.flashMessage("Copied to Clipboard: " + attByIdUrl, "Clipboard", true);
                }
            }));

            let downloadttByIdUrl = attByIdUrl + "?download=y";
            children.push(new Heading(5, "Download Attachment By Id"));
            children.push(new Div(downloadttByIdUrl, {
                className: "anchorBigMarginBottom",
                title: "Click -> Copy to clipboard",
                onClick: () => {
                    S.util.copyToClipboard(downloadttByIdUrl);
                    S.util.flashMessage("Copied to Clipboard: " + downloadttByIdUrl, "Clipboard", true);
                }
            }));
        }

        if (node.name) {
            if (bin) {
                let attByNameUrl = window.location.origin + S.util.getPathPartForNamedNodeAttachment(node);
                children.push(new Heading(5, "View Attachment By Name"));
                children.push(new Div(attByNameUrl, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard(attByNameUrl);
                        S.util.flashMessage("Copied to Clipboard: " + attByNameUrl, "Clipboard", true);
                    }
                }));

                let downloadAttByNameUrl = attByNameUrl + "?download=y";
                children.push(new Heading(5, "Download Attachment By Name"));
                children.push(new Div(downloadAttByNameUrl, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard(downloadAttByNameUrl);
                        S.util.flashMessage("Copied to Clipboard: " + downloadAttByNameUrl, "Clipboard", true);
                    }
                }));
            }
        }

        const linksDiv = new Div(null, null, children);
        new MessageDlg(null, "URLs for Node " + node.id, null, linksDiv, false, 0, null).open();
    }

    allowAction = (typeHandler: TypeHandlerIntf, action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean => {
        return typeHandler == null || typeHandler.allowAction(action, node, appState);
    }

    renderPageFromData = (res: J.RenderNodeResponse, scrollToTop: boolean, targetNodeId: string, clickTab: boolean = true, allowScroll: boolean = true, state: AppState): void => {
        if (res && res.noDataResponse) {
            S.util.showMessage(res.noDataResponse, "Note");
            return;
        }

        try {
            // console.log("renderPageFromData: " + S.util.prettyPrint(res));
            dispatch({
                type: "Action_RenderPage",
                state,
                updateNew: (s: AppState): AppState => {
                    // VERY IMPORTANT to return a NEW object so we create it here. If you don't return new object rendering can fail.
                    s = { ...s };

                    if (!s.activeTab || clickTab) {
                        s.activeTab = "mainTab";
                    }

                    s.guiReady = true;
                    s.pageMessage = null;

                    /* Note: This try block is solely to enforce the finally block to happen to guarantee setting s.rendering
                    back to false, no matter what */
                    try {
                        if (res) {
                            s.node = res.node;
                            s.endReached = res.endReached;
                            s.breadcrumbs = res.breadcrumbs;
                        }

                        s.idToNodeMap = new Map<string, J.NodeInfo>();
                        if (res) {
                            S.meta64.updateNodeMap(res.node, s);
                        }

                        if (targetNodeId) {
                            // If you access /n/myNodeName we get here with targetNodeId being the name (and not the ID)
                            // so we have to call getNodeByName() to get the 'id' that goes with that node name.
                            if (targetNodeId.startsWith(":")) {
                                targetNodeId = targetNodeId.substring(1);
                                const foundNode: J.NodeInfo = S.meta64.getNodeByName(res.node, targetNodeId, s);
                                if (foundNode) {
                                    targetNodeId = foundNode.id;
                                }
                            }

                            S.render.fadeInId = targetNodeId;
                            s.pendingLocationHash = null;
                        }
                        else {
                            if (!S.render.fadeInId) {
                                S.render.fadeInId = s.node.id;
                            }
                        }

                        s.selectedNodes = {};

                        if (s.node && !s.isAnonUser) {
                            // now that 'redux' is in control and we call this method less directly/often, I need to check to see if
                            // this method is getting called every time it should.
                            S.localDB.setVal(C.LOCALDB_LAST_PARENT_NODEID, s.node.id);
                            S.localDB.setVal(C.LOCALDB_LAST_CHILD_NODEID, targetNodeId);
                        }

                        if (this.debug && s.node) {
                            console.log("RENDER NODE: " + s.node.id);
                        }

                        if (s.activeTab !== "mainTab") {
                            allowScroll = false;
                        }

                        // NOTE: In these blocks we set rendering=true only if we're scrolling so that the user doesn't see
                        // a jump in position during scroll, but a smooth reveal of the post-scroll location/rendering.
                        if (s.pendingLocationHash) {
                            // console.log("highlight: pendingLocationHash");
                            window.location.hash = s.pendingLocationHash;
                            // Note: the substring(1) trims the "#" character off.
                            if (allowScroll) {
                                // console.log("highlight: pendingLocationHash (allowScroll)");
                                S.meta64.highlightRowById(s.pendingLocationHash.substring(1), true, s);
                                s.rendering = true;
                            }
                            s.pendingLocationHash = null;
                        }
                        else if (allowScroll && targetNodeId) {
                            // console.log("highlight: byId");
                            if (!S.meta64.highlightRowById(targetNodeId, true, s)) {
                                // anything to do here? didn't find node.
                            }

                            s.rendering = true;
                        } //
                        else if (allowScroll && (scrollToTop || !S.meta64.getHighlightedNode(s))) {
                            // console.log("highlight: scrollTop");
                            S.view.scrollToTop();
                            s.rendering = true;
                        } //
                        else if (allowScroll) {
                            // console.log("highlight: scrollToSelected");
                            S.view.scrollToSelectedNode(s);
                            s.rendering = true;
                        }
                    }
                    finally {
                        if (s.rendering) {
                            /* This is a tiny timeout yes, but don't remove this timer. We need it or else this won't work. */

                            PubSub.subSingleOnce(C.PUBSUB_postMainWindowScroll, () => {
                                setTimeout(() => {
                                    dispatch({
                                        type: "Action_settingVisible",
                                        state,
                                        update: (s: AppState): void => {
                                            s.rendering = false;
                                            this.allowFadeInId = true;
                                        }
                                    });
                                },
                                    /* This delay has to be long enough to be sure scrolling has taken place already
                                       I'm pretty sure this might work even at 100ms or less on most machines, but I'm leaving room for slower
                                       browsers, because it's critical that this be long enough, but not long enough to be noticeable.
                                    */
                                    300);
                            });
                        }
                        else {
                            this.allowFadeInId = true;
                        }
                    }

                    return s;
                }
            });
        }
        catch (err) {
            console.error("render failed.");
        }
    }

    renderChildren = (node: J.NodeInfo, level: number, allowNodeMove: boolean): Comp => {
        if (!node || !node.children) return null;

        let allowAvatars = true;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on
         * the client side for various reasons.
         */
        const layout = S.props.getNodePropVal(J.NodeProp.LAYOUT, node);

        /* Note: for mobile devices, always use vertical layout. */
        if (clientInfo.isMobile || !layout || layout === "v") {
            return new NodeCompVerticalRowLayout(node, level, allowNodeMove, true);
        }
        else if (layout.indexOf("c") === 0) {
            return new NodeCompTableRowLayout(node, level, layout, allowNodeMove, true);
        }
        else {
            // of no layout is valid, fall back on vertical.
            return new NodeCompVerticalRowLayout(node, level, allowNodeMove, true);
        }
    }

    getAttachmentUrl = (urlPart: string, node: J.NodeInfo, downloadLink: boolean): string => {
        /* If this node attachment points to external URL return that url */
        let imgUrl = S.props.getNodePropVal(J.NodeProp.BIN_URL, node);
        if (imgUrl) {
            return imgUrl;
        }

        const ipfsLink = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, node);
        let bin = S.props.getNodePropVal(J.NodeProp.BIN, node);

        if (bin || ipfsLink) {
            if (ipfsLink) {
                bin = "ipfs";
            }
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
            // console.log("getUrlForNodeAttachment: id="+node.id+" url="+ret+" from dataUrl");
        }
        else {
            ret = this.getAttachmentUrl("bin", node, downloadLink);
            // console.log("getUrlForNodeAttachment: id=" + node.id + " url=" + ret + " from bin");
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

    getProfileHeaderImgUrl = (ownerId: string, avatarVer: string) => {
        if (!avatarVer) return null;
        return S.util.getRpcPath() + "bin/profileHeader" + "?nodeId=" + ownerId + "&v=" + avatarVer;
    }

    makeAvatarImage = (node: J.NodeInfo, state: AppState) => {
        let src: string = node.apAvatar || this.getAvatarImgUrl(node.ownerId, node.avatarVer);
        if (!src) {
            return null;
        }
        const key = "avatar-" + node.id;

        // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        return new Img(key, {
            src,
            className: "avatarImage",
            title: "User: " + node.owner + "\n\nClick for Bio",
            // align: "left", // causes text to flow around

            onClick: (evt: any) => {
                // new ProfileDlg(state, true, node.ownerId, node.owner).open();
                S.meta64.userProfileView.open(true, node.ownerId);
            }
        });
    }

    /* Returns true if the logged in user and the type of node allow the property to be edited by the user */
    allowPropertyEdit = (node: J.NodeInfo, propName: string, state: AppState): boolean => {
        const typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        return typeHandler ? typeHandler.allowPropertyEdit(propName, state) : true;
    }

    isReadOnlyProperty = (propName: string): boolean => {
        return S.props.readOnlyPropertyList.has(propName);
    }

    showGraph = (node: J.NodeInfo, searchText: string, state: AppState): void => {
        if (!node) {
            node = S.meta64.getHighlightedNode(state);
        }

        dispatch({
            type: "Action_ShowGraph",
            state,
            update: (s: AppState): void => {
                s.fullScreenGraphId = node.id;
                s.graphSearchText = searchText;
            }
        });
    }
}

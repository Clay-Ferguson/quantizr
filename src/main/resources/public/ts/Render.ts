import * as highlightjs from "highlightjs";
import * as marked from "marked";
import { toArray } from "react-emoji-render";
import { dispatch } from "./AppRedux";
import { AppState } from "./AppState";
import { NodeCompTableRowLayout } from "./comps/NodeCompTableRowLayout";
import { NodeCompVerticalRowLayout } from "./comps/NodeCompVerticalRowLayout";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { UserProfileDlg } from "./dlg/UserProfileDlg";
import { NodeActionType } from "./enums/NodeActionType";
import { RenderIntf } from "./intf/RenderIntf";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { Singletons } from "./Singletons";
import { Comp } from "./widget/base/Comp";
import { Div } from "./widget/Div";
import { Heading } from "./widget/Heading";
import { HorizontalLayout } from "./widget/HorizontalLayout";
import { Img } from "./widget/Img";
import { Span } from "./widget/Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

function imageErrorFunc(evt: any) {
    console.log("remove broken img");
    evt.target.hidden = true;
    evt.target.onerror = null;
    return true;
}

export class Render implements RenderIntf {
    private debug: boolean = false;
    private markedRenderer = null;

    CHAR_CHECKMARK = "&#10004;";

    // After adding the breadcrumb query it's a real challenge to get this fading to work right, so for now
    // I'm disabling it entirely with this flag.
    enableRowFading: boolean = true;

    fadeInId: string;
    allowFadeInId: boolean = false;

    injectSubstitutions = (node: J.NodeInfo, val: string): string => {
        val = S.util.replaceAll(val, "{{locationOrigin}}", window.location.origin);

        /* These allow us to enter into the markdown things like this:
        [My Link Test]({{url}}?id=:my-test-name)
        [My Other Link Test]({{byName}}my-test-name)
        to be able to have a link to a node of a specific name

        However, this also works and may be the more 'clear' way:
        [Link Test App](/app?id=:my-test-name)
        */
        val = S.util.replaceAll(val, "{{byName}}", window.location.origin + window.location.pathname + "?id=:");
        val = S.util.replaceAll(val, "{{url}}", window.location.origin + window.location.pathname);

        let upperLeftImg = "<img class=\"img-upper-left\" width=\"{{imgSize}}\" src=\"{{imgUrl}}\"><div class=\"clearfix\"/>";
        val = S.util.replaceAll(val, "{{imgUpperLeft}}", upperLeftImg);

        let upperRightImg = "<img class=\"img-upper-right\" width=\"{{imgSize}}\" src=\"{{imgUrl}}\"><div class=\"clearfix\"/>";
        val = S.util.replaceAll(val, "{{imgUpperRight}}", upperRightImg);

        let imgInline = "<img class=\"img-block\" width=\"{{imgSize}}\" src=\"{{imgUrl}}\">";
        val = S.util.replaceAll(val, "{{img}}", imgInline);

        if (val.indexOf("{{paypal-button}}") !== -1) {
            val = S.util.replaceAll(val, "{{paypal-button}}", C.PAY_PAL_BUTTON);
        }

        let imgSize = S.props.getNodePropVal(J.NodeProp.IMG_SIZE, node);
        // actual size prop is saved as "0"
        if (imgSize && imgSize !== "0") {
            val = S.util.replaceAll(val, "{{imgSize}}", imgSize);
        }
        else {
            val = S.util.replaceAll(val, "{{imgSize}}", "");
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
                // console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);

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
    showCalendar = (nodeId: string, allNodes: boolean, state: AppState): void => {
        if (!nodeId) {
            let node = S.quanta.getHighlightedNode(state);
            if (node) {
                nodeId = node.id;
            }
        }
        if (!nodeId) {
            S.util.showMessage("You must first click on a node.", "Warning");
            return;
        }

        S.util.ajax<J.RenderCalendarRequest, J.RenderCalendarResponse>("renderCalendar", {
            allNodes,
            nodeId
        }, (res: J.RenderCalendarResponse) => {
            dispatch("Action_ShowCalendar", (s: AppState): AppState => {
                s.fullScreenCalendarId = nodeId;
                s.fullScreenCalendarAllNodes = allNodes;
                s.calendarData = S.util.buildCalendarData(res.items);
                return s;
            });
        });
    }

    showNodeUrl = (node: J.NodeInfo, state: AppState): void => {
        if (!node) {
            node = S.quanta.getHighlightedNode(state);
        }
        if (!node) {
            S.util.showMessage("You must first click on a node.", "Warning");
            return;
        }

        const children = [];

        /* we need this holder object because we don't have the dialog until it's created */
        const dlgHolder: any = {};

        let byIdUrl = window.location.origin + "/app?id=" + node.id;
        children.push(new Heading(5, "By ID"), //
            new Div(byIdUrl, {
                className: "anchorBigMarginBottom",
                title: "Click -> Copy to clipboard",
                onClick: () => {
                    S.util.copyToClipboard(byIdUrl);
                    S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                    dlgHolder.dlg.close();
                }
            }));

        let markdownIdUrl = "[link](/app?id=" + node.id + ")";
        children.push(new Heading(5, "Markdown Link"), //
            new Div(markdownIdUrl, {
                className: "anchorBigMarginBottom",
                title: "Click -> Copy to clipboard",
                onClick: () => {
                    S.util.copyToClipboard(markdownIdUrl);
                    S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                    dlgHolder.dlg.close();
                }
            }));

        if (node.name) {
            let byNameUrl = window.location.origin + S.util.getPathPartForNamedNode(node);
            children.push(new Heading(5, "By Name"), //
                new Div(byNameUrl, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard(byNameUrl);
                        S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                        dlgHolder.dlg.close();
                    }
                }));
        }

        let rssFeed = window.location.origin + "/rss?id=" + node.id;
        children.push(new Heading(5, "Node RSS Feed"), //
            new Div(rssFeed, {
                className: "anchorBigMarginBottom",
                title: "Click -> Copy to clipboard",
                onClick: () => {
                    S.util.copyToClipboard(rssFeed);
                    S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                    dlgHolder.dlg.close();
                }
            }));

        let bin = S.props.getNodePropVal(J.NodeProp.BIN, node);
        if (bin) {
            let attByIdUrl = window.location.origin + "/f/id/" + node.id;
            children.push(new Heading(5, "View Attachment By Id"), //
                new Div(attByIdUrl, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard(attByIdUrl);
                        S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                        dlgHolder.dlg.close();
                    }
                }));

            let downloadttByIdUrl = attByIdUrl + "?download=y";
            children.push(new Heading(5, "Download Attachment By Id"), //
                new Div(downloadttByIdUrl, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard(downloadttByIdUrl);
                        S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                        dlgHolder.dlg.close();
                    }
                }));
        }

        if (node.name) {
            if (bin) {
                let attByNameUrl = window.location.origin + S.util.getPathPartForNamedNodeAttachment(node);
                children.push(new Heading(5, "View Attachment By Name"), //
                    new Div(attByNameUrl, {
                        className: "anchorBigMarginBottom",
                        title: "Click -> Copy to clipboard",
                        onClick: () => {
                            S.util.copyToClipboard(attByNameUrl);
                            S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                            dlgHolder.dlg.close();
                        }
                    }));

                let downloadAttByNameUrl = attByNameUrl + "?download=y";
                children.push(new Heading(5, "Download Attachment By Name"), //
                    new Div(downloadAttByNameUrl, {
                        className: "anchorBigMarginBottom",
                        title: "Click -> Copy to clipboard",
                        onClick: () => {
                            S.util.copyToClipboard(downloadAttByNameUrl);
                            S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                            dlgHolder.dlg.close();
                        }
                    }));
            }
        }

        let ipfsLink = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, node);
        if (ipfsLink) {
            children.push(new Heading(5, "IPFS CID"), //
                new Div(ipfsLink, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard(ipfsLink);
                        S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                        dlgHolder.dlg.close();
                    }
                }));
        }

        dlgHolder.dlg = new MessageDlg(null, "URLs", null, new Div(null, null, children), false, 0, null);
        dlgHolder.dlg.open();
    }

    allowAction = (typeHandler: TypeHandlerIntf, action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean => {
        return typeHandler == null || typeHandler.allowAction(action, node, appState);
    }

    renderPageFromData = (res: J.RenderNodeResponse, scrollToTop: boolean, targetNodeId: string, clickTab: boolean = true, allowScroll: boolean = true): void => {
        if (res && res.noDataResponse) {
            S.util.showMessage(res.noDataResponse, "Note");
            return;
        }

        try {
            // console.log("renderPageFromData: " + S.util.prettyPrint(res));
            dispatch("Action_RenderPage", (s: AppState): AppState => {
                // if (allowScroll) {
                //     S.quanta.tabScrollTop(C.TAB_MAIN);
                // }
                // console.log("update state in Action_RenderPage");

                if (!s.activeTab || clickTab) {
                    S.quanta.tabChanging(s.activeTab, C.TAB_MAIN, s);
                    s.activeTab = S.quanta.activeTab = C.TAB_MAIN;
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

                        /* Slight hack to make viewing 'posts' or chat rooms nodes turn on metaData */
                        if (s.node.type === J.NodeType.POSTS ||
                            s.node.type === J.NodeType.ROOM) {
                            S.edit.setMetadataOption(true);
                        }
                    }

                    s.idToNodeMap = new Map<string, J.NodeInfo>();
                    if (res) {
                        S.quanta.updateNodeMap(res.node, s);
                    }

                    let targetNode: J.NodeInfo = null;
                    if (targetNodeId) {
                        // If you access /n/myNodeName we get here with targetNodeId being the name (and not the ID)
                        // so we have to call getNodeByName() to get the 'id' that goes with that node name.
                        if (targetNodeId.startsWith(":")) {
                            targetNodeId = targetNodeId.substring(1);
                            targetNode = S.quanta.getNodeByName(res.node, targetNodeId, s);
                            if (targetNode) {
                                targetNodeId = targetNode.id;
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

                    if (s.node && !s.isAnonUser) {
                        // do this async just for performance
                        setTimeout(() => {
                            S.util.updateHistory(s.node, targetNode, s);
                        }, 10);
                    }

                    if (this.debug && s.node) {
                        console.log("RENDER NODE: " + s.node.id);
                    }

                    if (s.activeTab !== C.TAB_MAIN) {
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
                            S.quanta.highlightRowById(s.pendingLocationHash.substring(1), true, s);

                            if (S.quanta.hiddenRenderingEnabled) {
                                s.rendering = true;
                            }
                        }
                        s.pendingLocationHash = null;
                    }
                    else if (allowScroll && targetNodeId) {
                        // console.log("highlight: byId");
                        if (!S.quanta.highlightRowById(targetNodeId, true, s)) {
                            // anything to do here? didn't find node.
                        }

                        if (S.quanta.hiddenRenderingEnabled) {
                            s.rendering = true;
                        }
                    } //
                    else if (allowScroll && (scrollToTop || !S.quanta.getHighlightedNode(s))) {
                        // console.log("highlight: scrollTop");
                        S.view.scrollToTop();
                        if (S.quanta.hiddenRenderingEnabled) {
                            s.rendering = true;
                        }
                    } //
                    else if (allowScroll) {
                        // console.log("highlight: scrollToSelected");
                        S.view.scrollToSelectedNode(s);
                        if (S.quanta.hiddenRenderingEnabled) {
                            s.rendering = true;
                        }
                    }
                }
                finally {
                    if (s.rendering) {
                        /* This is a tiny timeout yes, but don't remove this timer. We need it or else this won't work. */

                        PubSub.subSingleOnce(C.PUBSUB_postMainWindowScroll, () => {
                            setTimeout(() => {
                                dispatch("Action_settingVisible", (s: AppState): AppState => {
                                    s.rendering = false;
                                    this.allowFadeInId = true;
                                    return s;
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

                    // see also: tag #getNodeMetaInfo
                    this.getNodeMetaInfo(res.node);

                    // only focus the TAB if we're not editing, because if editing the edit field will be focused. In other words,
                    // if we're about to initiate editing a TextArea field will be getting focus
                    // so we don't want to set the MAIN tab as the focus and mess that up.
                    // console.log("focus MAIN_TAB during render.");
                    if (!s.editNode) {
                        S.util.focusId(C.TAB_MAIN);
                    }
                }
                return s;
            });
        }
        catch (err) {
            console.error("render failed.");
        }
    }

    /* Get information for each node. Namely for now just the 'hasChildren' state because it takes a actual query
    per node to find that out.

    Note: Users will be able to see the fading in fadeInRowBkgClz class for the length of time it takes
    the getNodeMetaInfo, this is ok and is the current design. The fading now works kind of like a progress indicator
    by keeping user busy watching something.

    This function will perform well even if called repeatedly. Only does the work once as neccessary so we can call this
    safely after every time we get new data from the server, with no unnecessarey performance hit.
    */
    getNodeMetaInfo = (node: J.NodeInfo) => {
        if (node && node.children) {
            // Holds the list of IDs we will query for. Only those with "metainfDone==false", meaning we
            // haven't yet pulled the metadata yet.
            let ids: string[] = [];

            for (let child of node.children) {
                if (!(child as any).metaInfDone) {
                    ids.push(child.id);
                }
            }

            if (ids.length > 0) {
                // console.log("MetaQuery idCount=" + ids.length);
                S.util.ajax<J.GetNodeMetaInfoRequest, J.GetNodeMetaInfoResponse>("getNodeMetaInfo", {
                    ids
                }, (res: J.GetNodeMetaInfoResponse) => {
                    dispatch("Action_updateNodeMetaInfo", (s: AppState): AppState => {
                        if (s.node && s.node.children) {
                            s.node.hasChildren = true;

                            // iterate all children
                            for (let child of s.node.children) {

                                // if this is a child we will have just pulled down
                                if (!(child as any).metaInfDone) {

                                    // find the child in what we just pulled down.
                                    let inf: J.NodeMetaIntf = res.nodeIntf.find(v => v.id === child.id);

                                    // set the hasChildren to the value we just pulled down.
                                    if (inf) {
                                        child.hasChildren = inf.hasChildren;
                                    }
                                    (child as any).metaInfDone = true;
                                }
                            }
                        }
                        return s;
                    });
                }, null, true);
            }
        }
    }

    renderChildren = (node: J.NodeInfo, level: number, allowNodeMove: boolean, state: AppState): Comp => {
        if (!node || !node.children) return null;
        let allowAvatars = true;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on
         * the client side for various reasons.
         */
        const layout = S.props.getNodePropVal(J.NodeProp.LAYOUT, node);

        /* Note: for edit mode, or on mobile devices, always use vertical layout. */
        if (state.userPreferences.editMode || state.mobileMode || !layout || layout === "v") {
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
            onError: imageErrorFunc,
            title: "User: @" + node.owner + "\n\nShow Profile",
            // align: "left", // causes text to flow around

            onClick: (evt: any) => {
                new UserProfileDlg(node.ownerId, state).open();
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
            node = S.quanta.getHighlightedNode(state);
        }

        dispatch("Action_ShowGraph", (s: AppState): AppState => {
            s.fullScreenGraphId = node.id;
            s.graphSearchText = searchText;
            return s;
        });
    }

    parseEmojis = (value: any): any => {
        if (!value) return value;
        const emojisArray = toArray(value);
        if (!emojisArray) return value;
        const newValue = emojisArray.reduce((previous: any, current: any) => {
            if (typeof current === "string") {
                return previous + current;
            }
            if (current && current.props) {
                return previous + current.props.children;
            }
            else {
                return previous;
            }
        }, "");
        return newValue;
    };

    renderUser(nodeId: string, user: string, userBio: string, imgSrc: string, actorUrl: string,
        displayName: string, className: string, iconClass: string, showMessageButton: boolean, onClick: Function): Comp {

        let img: Img = imgSrc
            ? new Img(null, {
                className: iconClass,
                src: imgSrc,
                onClick
            }) : null;

        let attribs: any = {};
        if (className) attribs.className = className;

        return new Div(null, attribs, [
            new HorizontalLayout([
                new Div(null, { className: "friendLhs" }, [
                    img
                ]),
                new Div(null, { className: "friendRhs" }, [

                    // I'm removing this becasue we can click on the image and to these thru the Profile Dialog of the user.
                    // new ButtonBar([
                    //     // todo-1: need to make ALL calls be able to do a newSubNode here without so we don't need
                    //     // the showMessagesButton flag.
                    //     showMessageButton ? new Button("Message", S.edit.newSubNode, {
                    //         title: "Send Private Message",
                    //         nid: nodeId
                    //     }) : null,
                    //     actorUrl ? new Button("Go to User Page", () => {
                    //         window.open(actorUrl, "_blank");
                    //     }) : null
                    // ], null, "float-right"),
                    // new Clearfix(),

                    new Div(displayName, {
                        className: "userName"
                    }),
                    new Div(null, null, [
                        // we use a span because the div stretches across empty space and does a mouse click
                        // when you didn't intend to click the actual name sometimes.
                        new Span("@" + user, {
                            className: (displayName ? "" : "userName ") + "clickable",
                            onClick
                        })
                    ])

                    // The page just looks cleaner with the username only. We can click them to see their bio text.
                    // userBio ? new Html(userBio, {
                    //     className: "userBio"
                    // }) : null
                ])

            ], "displayTable userInfo", null)
        ]);
    }
}

import highlightjs from "highlight.js";
import "highlight.js/styles/github.css";
import marked from "marked";
import { toArray } from "react-emoji-render";
import { dispatch } from "./AppRedux";
import { AppState } from "./AppState";
import { Comp } from "./comp/base/Comp";
import { CollapsiblePanel } from "./comp/core/CollapsiblePanel";
import { Div } from "./comp/core/Div";
import { Heading } from "./comp/core/Heading";
import { HorizontalLayout } from "./comp/core/HorizontalLayout";
import { Img } from "./comp/core/Img";
import { Span } from "./comp/core/Span";
import { NodeCompTableRowLayout } from "./comp/node/NodeCompTableRowLayout";
import { NodeCompVerticalRowLayout } from "./comp/node/NodeCompVerticalRowLayout";
import { Constants as C } from "./Constants";
import { MessageDlg } from "./dlg/MessageDlg";
import { UserProfileDlg } from "./dlg/UserProfileDlg";
import { NodeActionType } from "./enums/NodeActionType";
import { FullScreenType } from "./Interfaces";
import { TabIntf } from "./intf/TabIntf";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import * as J from "./JavaIntf";
import { NodeMetaIntf } from "./JavaIntf";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";
import { MainTabCompData } from "./tabs/data/MainTabCompData";

function imageErrorFunc(evt: any) {
    console.log("remove broken img");
    evt.target.hidden = true;
    evt.target.onerror = null;
    return true;
}

export class Render {
    private debug: boolean = false;
    private markedRenderer: any = null;

    CHAR_CHECKMARK = "&#10004;";

    // After adding the breadcrumb query it's a real challenge to get this fading to work right, so for now
    // I'm disabling it entirely with this flag.
    enableRowFading: boolean = true;

    fadeInId: string;
    allowFadeInId: boolean = false;

    constructor() {
        highlightjs.initHighlightingOnLoad();
    }

    injectSubstitutions = (node: J.NodeInfo, val: string): string => {
        val = S.util.replaceAll(val, "{{locationOrigin}}", window.location.origin);
        val = this.injectCustomButtons(val);

        /* These allow us to enter into the markdown things like this:
        [My Link Test]({{url}}?id=:my-test-name)
        [My Other Link Test]({{byName}}my-test-name)
        to be able to have a link to a node of a specific name

        However, this also works and may be the more 'clear' way:
        [Link Test App](?id=:my-test-name)
        */
        val = S.util.replaceAll(val, "{{byName}}", window.location.origin + window.location.pathname + "?id=:");
        val = S.util.replaceAll(val, "{{url}}", window.location.origin + window.location.pathname);

        if (val.indexOf("{{imgUpperCenter}}") !== -1) {
            val = S.util.replaceAll(val, "{{imgUpperCenter}}", "<img class=\"img-center-top\" width=\"{{imgSize}}\" src=\"{{imgUrl}}\">");
        }

        if (val.indexOf("{{imgUpperLeft}}") !== -1) {
            val = S.util.replaceAll(val, "{{imgUpperLeft}}", "<img class=\"img-upper-left\" width=\"{{imgSize}}\" src=\"{{imgUrl}}\"><div class=\"clearfix\"/>");
        }

        if (val.indexOf("{{imgUpperRight}}") !== -1) {
            val = S.util.replaceAll(val, "{{imgUpperRight}}", "<img class=\"img-upper-right\" width=\"{{imgSize}}\" src=\"{{imgUrl}}\"><div class=\"clearfix\"/>");
        }

        if (val.indexOf("{{img}}") !== -1) {
            val = S.util.replaceAll(val, "{{img}}", "<img class=\"img-block\" width=\"{{imgSize}}\" src=\"{{imgUrl}}\">");
        }

        const imgSize = S.props.getPropStr(J.NodeProp.IMG_SIZE, node);
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
            val = val.replace("{{imgUrl}}", S.attachment.getUrlForNodeAttachment(node, false));
        }
        return val;
    }

    injectCustomButtons = (val: string): string => {
        val = this.injectAdminButton(val, C.ADMIN_COMMAND_FEDIVERSE, "Fediverse Feed");
        val = this.injectAdminButton(val, C.ADMIN_COMMAND_TRENDING, "Trending Hashtags");
        return val;
    }

    injectAdminButton = (val: string, cmd: string, buttonText: string) => {
        // NOTE: Our Singleton class puts a global copy of S on the browser 'window object', so that's why this script works.
        const script = "S.util.adminScriptCommand('" + cmd + "');";
        return val.replace(cmd, `<button class="btn btn-primary marginRight" onClick="${script}">${buttonText}</button>`);
    }

    /**
     * See: https://github.com/highlightjs/highlight.js
     */
    initMarkdown = () => {
        if (this.markedRenderer) return;
        this.markedRenderer = new marked.Renderer();

        // This code is discovered to have been dead, for a long time. Look into it.
        // this.markedRenderer.code = (code, language) => {
        //     // Check whether the given language is valid for highlight.js.
        //     const validLang = !!(language && highlightjs.getLanguage(language));

        //     // Highlight only if the language is valid.
        //     const highlighted = validLang ? highlightjs.highlight(language, code).value : code;

        //     // Render the highlighted code with `hljs` class.
        //     // return `<pre><code class="hljs ${language}">${highlighted}</code></pre>`;
        //     return highlighted;
        // };

        // From Stack Overflow
        // https://github.com/markedjs/marked/issues/882
        this.markedRenderer.link = function (href: string, title: string, text: string) {
            // console.log(`marked.link [${href}][${title}][${text}]`);
            if (href.indexOf("mailto:") === 0) {
                // todo-1: markdown thinks a fediverse username is a 'mailto' becuase the syntax looks like that. Eventually we could
                // make these usernames clickable to do something, like auto-import into the system and short their profile dialog
                return `<span class="userNameInContent">${text}</span>`;
            }

            if (title) {
                return `<a href="${href}" title="${title}" target="_blank">${text}</a>`;
            }
            else {
                return `<a href="${href}" target="_blank">${text}</a>`;
            }
        };

        // https://marked.js.org/using_advanced#highlight
        marked.setOptions({
            renderer: this.markedRenderer,

            highlight: (code, language) => {
                // Check whether the given language is valid for highlight.js.
                const validLang = !!(language && highlightjs.getLanguage(language));

                // Highlight only if the language is valid.
                const highlighted = validLang ? highlightjs.highlight(language, code).value : code;

                // Render the highlighted code with `hljs` class.
                // return `<pre><code class="hljs ${language}">${highlighted}</code></pre>`;
                return highlighted;
            },

            // example from marked website...
            // highlight: function(code, lang) {
            //     const language = highlightjs.getLanguage(lang) ? lang : "plaintext";
            //     return highlightjs.highlight(code, { language }).value;
            // },

            // our original highlight function...
            // highlight: function (code) {
            //     return highlightjs.highlightAuto(code).value;
            // },
            langPrefix: "hljs language-", // highlight.js css expects a top-level 'hljs' class.

            gfm: true,
            breaks: false,
            pedantic: false,
            smartLists: true,
            smartypants: false

            // SANITIZE PARAM IS DEPRECATED (LEAVE THIS NOTE HERE)
            // Search for 'DOMPurify.sanitize' to see how we do it currently.
            // sanitize: true
        });
    }

    setNodeDropHandler = (attribs: any, node: J.NodeInfo, isFirst: boolean, state: AppState) => {
        if (!node) return;
        // console.log("Setting drop handler: nodeId=" + node.id + " attribs.id=" + attribs.id);

        S.util.setDropHandler(attribs, false, (evt: DragEvent) => {
            // todo-2: right now we only actually support one file being dragged? Would be nice to support multiples
            for (const item of evt.dataTransfer.items) {
                // console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);

                if (item.kind === "string") {
                    item.getAsString((s) => {
                        if (item.type.match("^text/uri-list")) {
                            /* Disallow dropping from our app onto our app */
                            if (s.startsWith(location.protocol + "//" + location.hostname)) {
                                return;
                            }
                            S.attachment.openUploadFromUrlDlg(node ? node.id : null, s, null, state);
                        }
                        /* this is the case where a user is moving a node by dragging it over another node */
                        else {
                            S.edit.moveNodeByDrop(node.id, s, isFirst ? "inline-above" : "inline", false);
                        }
                    });
                    return;
                }
                else if (item.kind === "string" && item.type.match("^text/html")) {
                }
                else if (item.kind === "file" /* && d.type.match('^image/') */) {
                    const file: File = item.getAsFile();

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
    showCalendar = async (nodeId: string, state: AppState) => {
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode(state);
            if (node) {
                nodeId = node.id;
            }
        }
        if (!nodeId) {
            S.util.showMessage("You must first click on a node.", "Warning");
            return;
        }

        const res = await S.util.ajax<J.RenderCalendarRequest, J.RenderCalendarResponse>("renderCalendar", {
            nodeId
        });
        dispatch("ShowCalendar", s => {
            s.fullScreenConfig = { type: FullScreenType.CALENDAR, nodeId };
            s.calendarData = S.util.buildCalendarData(res.items);
            return s;
        });
    }

    showNodeUrl = (node: J.NodeInfo, state: AppState) => {
        if (!node) {
            node = S.nodeUtil.getHighlightedNode(state);
        }
        if (!node) {
            S.util.showMessage("You must first click on a node.", "Warning");
            return;
        }

        const children = [];

        /* we need this holder object because we don't have the dialog until it's created */
        const dlgHolder: any = {};

        children.push(new Div("Click a link to put it in your clipboard.", { className: "marginBottom" }));

        const byIdUrl = window.location.origin + "?id=" + node.id;
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

        if (node.name) {
            const byNameUrl = window.location.origin + S.nodeUtil.getPathPartForNamedNode(node);
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

        const rssFeed = window.location.origin + "/rss?id=" + node.id;
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

        const bin = S.props.getPropStr(J.NodeProp.BIN, node);
        if (bin) {
            const attachmentComps: Comp[] = [];
            attachmentComps.push(new Heading(3, "Attachment URLs"));

            const attByIdUrl = window.location.origin + "/f/id/" + node.id;
            attachmentComps.push(new Heading(5, "View By Id"), //
                new Div(attByIdUrl, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard(attByIdUrl);
                        S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                        dlgHolder.dlg.close();
                    }
                }));

            const downloadttByIdUrl = attByIdUrl + "?download=y";
            attachmentComps.push(new Heading(5, "Download By Id"), //
                new Div(downloadttByIdUrl, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard(downloadttByIdUrl);
                        S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                        dlgHolder.dlg.close();
                    }
                }));

            if (node.name) {
                const attByNameUrl = window.location.origin + S.nodeUtil.getPathPartForNamedNodeAttachment(node);
                attachmentComps.push(new Heading(5, "View By Name"), //
                    new Div(attByNameUrl, {
                        className: "anchorBigMarginBottom",
                        title: "Click -> Copy to clipboard",
                        onClick: () => {
                            S.util.copyToClipboard(attByNameUrl);
                            S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                            dlgHolder.dlg.close();
                        }
                    }));

                const downloadAttByNameUrl = attByNameUrl + "?download=y";
                attachmentComps.push(new Heading(5, "Download By Name"), //
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

            children.push(new CollapsiblePanel("Attachment URLs", "Hide", null, attachmentComps, false, (s: boolean) => {
                state.linksToAttachmentsExpanded = s;
            }, state.linksToAttachmentsExpanded, "marginAll", "attachmentLinksPanel", ""));
        }

        const ipfsLink = S.props.getPropStr(J.NodeProp.IPFS_LINK, node);
        if (ipfsLink) {
            children.push(new Heading(5, "IPFS LINK"), //
                new Div("ipfs://" + ipfsLink, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard("ipfs://" + ipfsLink);
                        S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                        dlgHolder.dlg.close();
                    }
                }));
        }

        const ipfsCid = S.props.getPropStr(J.NodeProp.IPFS_CID, node);
        if (ipfsCid) {
            children.push(new Heading(5, "IPFS CID"), //
                new Div("ipfs://" + ipfsCid, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard("ipfs://" + ipfsCid);
                        S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                        dlgHolder.dlg.close();
                    }
                }));
        }

        const ipnsCid = S.props.getPropStr(J.NodeProp.IPNS_CID, node);
        if (ipnsCid) {
            children.push(new Heading(5, "IPNS Name"), //
                new Div("ipns://" + ipnsCid, {
                    className: "anchorBigMarginBottom",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard("ipns://" + ipnsCid);
                        S.util.flashMessage("Copied link to Clipboard", "Clipboard", true);
                        dlgHolder.dlg.close();
                    }
                }));
        }

        dlgHolder.dlg = new MessageDlg(null, "Node URLs", null, new Div(null, null, children), false, 0, null);
        dlgHolder.dlg.open();
    }

    allowAction = (typeHandler: TypeHandlerIntf, action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean => {
        return !typeHandler || typeHandler.allowAction(action, node, appState);
    }

    renderPage = (res: J.RenderNodeResponse, scrollToTop: boolean, targetNodeId: string, clickTab: boolean = true, allowScroll: boolean = true) => {
        if (res && res.noDataResponse) {
            S.util.showMessage(res.noDataResponse, "Note");
            return;
        }

        try {
            if (C.DEBUG_SCROLLING) {
                console.log("renderPage: scrollToTop=" + scrollToTop + " allowScroll=" + allowScroll);
            }
            // console.log("Data:" + S.util.prettyPrint(res));

            dispatch("RenderPage", s => {
                // console.log("update state in Action_RenderPage");

                if (!s.activeTab || clickTab) {
                    S.tabUtil.tabChanging(s.activeTab, C.TAB_MAIN, s);
                    s.activeTab = S.quanta.activeTab = C.TAB_MAIN;
                }

                s.guiReady = true;
                s.pageMessage = null;

                if (MainTabCompData.inst) {
                    MainTabCompData.inst.openGraphComps = [];
                }

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
                        S.nodeUtil.updateNodeMap(res.node, s);
                    }

                    let targetNode: J.NodeInfo = null;
                    if (targetNodeId) {
                        // If you access /n/myNodeName we get here with targetNodeId being the name (and not the ID)
                        // so we have to call getNodeByName() to get the 'id' that goes with that node name.
                        if (targetNodeId.startsWith(":")) {
                            targetNodeId = targetNodeId.substring(1);
                            targetNode = S.nodeUtil.getNodeByName(res.node, targetNodeId, s);
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
                            S.nodeUtil.highlightRowById(s.pendingLocationHash.substring(1), true, s);

                            if (S.quanta.hiddenRenderingEnabled) {
                                s.rendering = true;
                            }
                        }
                        s.pendingLocationHash = null;
                    }
                    else if (allowScroll && targetNodeId) {
                        if (C.DEBUG_SCROLLING) {
                            console.log("highlight: byId");
                        }
                        if (!S.nodeUtil.highlightRowById(targetNodeId, true, s)) {
                            // console.log("highlight: byId...didn't find node: " + targetNodeId);
                        }

                        if (S.quanta.hiddenRenderingEnabled) {
                            s.rendering = true;
                        }
                    } //
                    else if (allowScroll && (scrollToTop || !S.nodeUtil.getHighlightedNode(s))) {
                        if (C.DEBUG_SCROLLING) {
                            console.log("rendering highlight: scrollTop");
                        }
                        S.view.scrollToTop();
                        if (S.quanta.hiddenRenderingEnabled) {
                            s.rendering = true;
                        }
                    } //
                    else if (allowScroll) {
                        if (C.DEBUG_SCROLLING) {
                            console.log("highlight: scrollToSelected");
                        }
                        S.view.scrollToNode(s);
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
                                dispatch("settingVisible", s => {
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
                        S.domUtil.focusId(C.TAB_MAIN);
                    }
                }
                return s;
            });
        }
        catch (err) {
            console.error("render failed: " + S.util.prettyPrint(err));
        }
    }

    /* Get information for each node. Namely for now just the 'hasChildren' state because it takes an actual query
    per node to find that out.

    Note: Users will be able to see the fading in fadeInRowBkgClz class for the length of time it takes
    the getNodeMetaInfo, this is ok and is the current design. The fading now works kind of like a progress indicator
    by keeping user busy watching something.

    This function will perform well even if called repeatedly. Only does the work once as neccessary so we can call this
    safely after every time we get new data from the server, with no significant performance hit.
    */
    getNodeMetaInfo = async (node: J.NodeInfo) => {
        if (node?.children) {
            // Holds the list of IDs we will query for. Only those with "metainfDone==false", meaning we
            // haven't yet pulled the metadata yet.
            const ids: string[] = [];

            this.getIncompleteMetaIds(node, ids);

            if (ids.length > 0) {
                // console.log("MetaQuery idCount=" + ids.length);
                const res = await S.util.ajax<J.GetNodeMetaInfoRequest, J.GetNodeMetaInfoResponse>("getNodeMetaInfo", {
                    ids
                }, true);

                dispatch("updateNodeMetaInfo", s => {
                    if (s.node && s.node.children) {
                        s.node.hasChildren = true;
                        this.updateHasChildren(s.node, res.nodeIntf);
                    }
                    return s;
                });
            }
        }
    }

    getIncompleteMetaIds = (node: J.NodeInfo, ids: string[]) => {
        if (!node?.children) return;

        for (const child of node.children) {
            if (!(child as any).metaInfDone) {
                ids.push(child.id);
            }

            // call recursively to process any sub-children
            this.getIncompleteMetaIds(child, ids);
        }
    }

    updateHasChildren = (node: J.NodeInfo, nodeIntf: NodeMetaIntf[]) => {
        if (!node || !node.children) return;
        node.hasChildren = true;

        for (const child of node.children) {

            // if this is a child we will have just pulled down
            if (!(child as any).metaInfDone) {

                // find the child in what we just pulled down.
                const inf: J.NodeMetaIntf = nodeIntf.find(v => v.id === child.id);

                // set the hasChildren to the value we just pulled down.
                if (inf) {
                    child.hasChildren = inf.hasChildren;
                }
                (child as any).metaInfDone = true;
            }

            // call recursively to process any sub-children
            this.updateHasChildren(child, nodeIntf);
        }
    }

    renderChildren = (node: J.NodeInfo, tabData: TabIntf<any>, level: number, allowNodeMove: boolean, state: AppState): Comp => {
        if (!node || !node.children) return null;
        const allowAvatars = true;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on
         * the client side for various reasons.
         */
        const layout = S.props.getPropStr(J.NodeProp.LAYOUT, node);

        /* Note: for edit mode, or on mobile devices, always use vertical layout. */
        if (state.userPrefs.editMode || state.mobileMode || !layout || layout === "v") {
            return new NodeCompVerticalRowLayout(node, tabData, level, allowNodeMove, true);
        }
        else if (layout.indexOf("c") === 0) {
            return new NodeCompTableRowLayout(node, tabData, level, layout, allowNodeMove, true);
        }
        else {
            // of no layout is valid, fall back on vertical.
            return new NodeCompVerticalRowLayout(node, tabData, level, allowNodeMove, true);
        }
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
        const src: string = node.apAvatar || this.getAvatarImgUrl(node.ownerId, node.avatarVer);
        if (!src) {
            return null;
        }
        const key = "avatar-" + node.id;

        // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        return new Img(key, {
            src,
            className: "avatarImage",
            // I haven't yet proven that this onError wasn't contributing to a page flicker bug but am suspicious
            // and since this is not that important, i'm removing until I have an abundane of time to retest.
            // onError: imageErrorFunc, 
            title: "User: @" + node.owner + "\n\nShow Profile",
            // align: "left", // causes text to flow around

            onClick: () => {
                new UserProfileDlg(node.ownerId).open();
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

    showGraph = (node: J.NodeInfo, searchText: string, state: AppState) => {
        node = node || S.nodeUtil.getHighlightedNode(state);

        dispatch("ShowGraph", s => {
            s.fullScreenConfig = { type: FullScreenType.GRAPH, nodeId: node.id };
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

        const img: Img = imgSrc
            ? new Img(null, {
                className: iconClass,
                src: imgSrc,
                onClick
            }) : null;

        const attribs: any = {};
        if (className) attribs.className = className;

        return new Div(null, attribs, [
            new HorizontalLayout([
                new Div(null, { className: "friendLhs" }, [
                    img
                ]),
                new Div(null, { className: "friendRhs" }, [

                    // I'm removing this becasue we can click on the image and to these thru the Profile Dialog of the user.
                    // new ButtonBar([
                    //     // todo-2: need to make ALL calls be able to do a newSubNode here without so we don't need
                    //     // the showMessagesButton flag.
                    //     showMessageButton ? new Button("Message", S.edit.newSubNode, {
                    //         title: "Send Private Message",
                    //         nid: nodeId
                    //     }) : null,
                    //     actorUrl ? new Button("Go to User Page", () => {
                    //         window.open(actorUrl, "_blank");
                    //     }) : null
                    // ], null, "float-end"),
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

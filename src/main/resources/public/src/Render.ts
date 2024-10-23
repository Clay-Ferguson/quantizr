import { dispatch, getAs, promiseDispatch } from "./AppContext";
import { Constants as C } from "./Constants";
import { FullScreenType } from "./Interfaces";
import * as J from "./JavaIntf";
import { Attachment, NodeInfo } from "./JavaIntf";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";
import { FullScreenGraphViewer } from "./comp/FullScreenGraphViewer";
import { Comp } from "./comp/base/Comp";
import { AppNavLink } from "./comp/core/AppNavLink";
import { Button } from "./comp/core/Button";
import { Clearfix } from "./comp/core/Clearfix";
import { CollapsiblePanel } from "./comp/core/CollapsiblePanel";
import { Div } from "./comp/core/Div";
import { FlexRowLayout } from "./comp/core/FlexRowLayout";
import { Icon } from "./comp/core/Icon";
import { IconButton } from "./comp/core/IconButton";
import { Img } from "./comp/core/Img";
import { Span } from "./comp/core/Span";
import { Tag } from "./comp/core/Tag";
import { NodeCompBinary } from "./comp/node/NodeCompBinary";
import { NodeCompContent } from "./comp/node/NodeCompContent";
import { NodeCompTableRowLayout } from "./comp/node/NodeCompTableRowLayout";
import { NodeCompVerticalRowLayout } from "./comp/node/NodeCompVerticalRowLayout";
import { MessageDlg } from "./dlg/MessageDlg";
import { PasteOrLinkDlg } from "./dlg/PasteOrLinkDlg";
import { TabBase } from "./intf/TabBase";
import { NodeActionType, TypeIntf } from "./intf/TypeIntf";
import { RSSView } from "./tabs/RSSView";
import { MainTab } from "./tabs/data/MainTab";

export class Render {
    private debug: boolean = false;

    // After adding the breadcrumb query it's a real challenge to get this fading to work right, so
    // for now I'm disabling it entirely with this flag.
    enableRowFading: boolean = true;

    fadeInId: string;
    allowFadeInId: boolean = false;

    injectSubstitutions(node: NodeInfo, val: string): string {
        // note: this is only here to get the markdown renderer to have padding in plain text, but
        // also it means we can leave off the language type and get a plaintext as default
        val = val.replaceAll("```txt\n", "```plaintext\n");
        val = val.replaceAll("{{locationOrigin}}", window.location.origin);

        /* These allow us to enter into the markdown things like this:
        [My Link Test]({{url}}?id=:my-test-name)
        [My Other Link Test]({{byName}}my-test-name)
        to be able to have a link to a node of a specific name

        However, this also works and may be the more 'clear' way:
        [Link Test App](?id=:my-test-name)
        */
        val = val.replaceAll("{{byName}}", window.location.origin + window.location.pathname + "?id=:");
        val = val.replaceAll("{{url}}", window.location.origin + window.location.pathname);

        if (node.attachments) {
            const list: Attachment[] = S.props.getOrderedAtts(node);

            for (const a of list) {
                if (a.position !== "ft") continue;

                let imgSize = a ? a.cssSize : null;
                // 'actual size' designation is stored as prop val == "0"
                if (!imgSize || imgSize === "0") {
                    imgSize = "";
                }

                const key = (a as any).key;
                const imgUrl = S.attachment.getUrlForNodeAttachment(node, key, false);
                // DO NOT DELETE: This approach with <img> tag doesn't work based on our current markdown sanitizer, but I want to keep this code.
                // val = val.replaceAll(`{{${a.f}}}`, `\n\n<img class="imgBlock enlargableImg" style="margin-bottom: 12px" width="${imgSize}" src="${imgUrl}" ${C.NODE_ID_ATTR}="${node.id}" data-attkey="${key}">\n\n`);
                val = val.replaceAll(`{{${a.fileName}}}`, `![](${imgUrl})`);
            }
        }

        return val;
    }

    renderLinkLabel(id: string) {
        const ast = getAs();
        let linkText = null;
        if (id === ast.linkSource) {
            linkText = "RDF Subject";
        }
        return linkText ? new Div(linkText, {
            className: "linkLabel",
            title: "Choose 'Link Nodes' after you pick Source & Target"
        }) : null;
    }

    setNodeDropHandler(attribs: any, node: NodeInfo) {
        if (!node) return;

        attribs[C.NODE_ID_ATTR] = node.id;
        S.domUtil.setDropHandler(attribs, (evt: DragEvent) => {
            for (const item of evt.dataTransfer.items) {
                if (item.type.startsWith("image/") && item.kind === "file") {
                    const file: File = item.getAsFile();

                    // if (file.size > Constants.MAX_UPLOAD_MB * Constants.ONE_MB) {
                    //     S.util.showMessage("That file is too large to upload. Max file size is "+Constants.MAX_UPLOAD_MB+" MB");
                    //     return;
                    // }

                    S.attachment.openUploadFromFileDlg(node.id, file);
                    return;
                }
            }

            for (const item of evt.dataTransfer.items) {
                if (item.type.match("^text/uri-list") && item.kind === "string") {
                    item.getAsString(s => {
                        /* Disallow dropping from our app onto our app */
                        if (s.startsWith(location.protocol + "//" + location.hostname)) {
                            return;
                        }
                        S.attachment.openUploadFromUrlDlg(node ? node.id : null, null);
                    });
                    return;
                }
            }

            // todo-2: right now we only actually support one file being dragged? Would be nice to support multiples
            for (const item of evt.dataTransfer.items) {
                // console.log("DROP(a) kind=" + item.kind + " type=" + item.type);
                if (item.type === C.DND_TYPE_NODEID && item.kind === "string") {
                    item.getAsString(s => {
                        if (!s) {
                            return;
                        }

                        // we check both ways if we're doing a self drop.
                        if (S.quanta.draggingId === node.id ||
                            attribs[C.NODE_ID_ATTR] === s) {
                            S.util.showMessage("Can't copy a node to itself.");
                            return;
                        }

                        const dlg = new PasteOrLinkDlg(node.id, s);
                        dlg.open().then(() => {
                            S.quanta.draggingId = null;
                            S.quanta.dragElm = null;
                        });
                    });
                    return;
                }
            }
        });
    }

    /* nodeId is parent node to query for calendar content */
    async showCalendar(nodeId: string) {
        if (!nodeId) {
            const node = S.nodeUtil.getHighlightedNode();
            if (node) {
                nodeId = node.id;
            }
        }
        if (!nodeId) {
            S.util.showMessage("You must first click on a node.", "Warning");
            return;
        }

        const res = await S.rpcUtil.rpc<J.RenderCalendarRequest, J.RenderCalendarResponse>("renderCalendar", {
            nodeId
        });

        dispatch("ShowCalendar", s => {
            s.savedActiveTab = s.activeTab;
            s.fullScreenConfig = { type: FullScreenType.CALENDAR, nodeId };
            s.calendarData = S.util.buildCalendarData(res.items);
        });
    }

    showNodeUrl(node: NodeInfo) {
        if (!node) {
            node = S.nodeUtil.getHighlightedNode();
        }
        if (!node) {
            S.util.showMessage("You must first click on a node.", "Warning");
            return;
        }

        const children = [];

        /* we need this holder object because we don't have the dialog until it's created */
        const dlgHolder: any = {};

        const byIdUrl = window.location.origin + "?id=" + node.id;
        const byIdUrlThreadView = byIdUrl + "&view=thread";
        const byIdUrlDocView = byIdUrl + "&view=doc";
        const byIdUrlTimelineView = byIdUrl + "&view=timeline";
        const pathPart = S.nodeUtil.getPathPartForNamedNode(node);
        children.push(new Div("Click any link to copy to clipboard.", { className: "alert alert-info" }));

        children.push(this.titleDiv("By ID"), //
            new Div(byIdUrl, {
                className: "linkDisplay",
                title: "Copy to clipboard",
                onClick: () => S.util.copyToClipboard(byIdUrl)
            }));

        const markdownByIdUrl = "[Link](?id=" + node.id + ")";
        children.push(this.titleDiv("By ID (Markdown)"), //
            new Div(markdownByIdUrl, {
                className: "linkDisplay",
                title: "Copy to clipboard",
                onClick: () => S.util.copyToClipboard(markdownByIdUrl)
            }));

        if (node.name) {
            const byNameUrl = window.location.origin + pathPart;
            children.push(this.titleDiv("By Name"), //
                new Div(byNameUrl, {
                    className: "linkDisplay",
                    title: "Copy to clipboard",
                    onClick: () => S.util.copyToClipboard(byNameUrl)
                }));

            const threadViewByNameUrl = window.location.origin + pathPart + "?view=thread";
            children.push(this.titleDiv("Thread View (By Name)"), //
                new Div(threadViewByNameUrl, {
                    className: "linkDisplay",
                    title: "Copy to clipboard",
                    onClick: () => S.util.copyToClipboard(threadViewByNameUrl)
                }));

            const docViewByNameUrl = window.location.origin + pathPart + "?view=doc";
            children.push(this.titleDiv("Doc View (By Name)"), //
                new Div(docViewByNameUrl, {
                    className: "linkDisplay",
                    title: "Copy to clipboard",
                    onClick: () => S.util.copyToClipboard(docViewByNameUrl)
                }));

            const timelineViewByNameUrl = window.location.origin + pathPart + "?view=timeline";
            children.push(this.titleDiv("Timeline View (By Name)"), //
                new Div(timelineViewByNameUrl, {
                    className: "linkDisplay",
                    title: "Copy to clipboard",
                    onClick: () => S.util.copyToClipboard(timelineViewByNameUrl)
                }));

            const markdownByNameUrl = "[Link](" + pathPart + ")";
            children.push(this.titleDiv("By Name (Markdown)"), //
                new Div(markdownByNameUrl, {
                    className: "linkDisplay",
                    title: "Copy to clipboard",
                    onClick: () => S.util.copyToClipboard(markdownByNameUrl)
                }));
        }

        children.push(this.titleDiv("Thread View by ID"), //
            new Div(byIdUrlThreadView, {
                className: "linkDisplay",
                title: "Copy to clipboard",
                onClick: () => S.util.copyToClipboard(byIdUrlThreadView)
            }));

        children.push(this.titleDiv("Doc View by ID"), //
            new Div(byIdUrlDocView, {
                className: "linkDisplay",
                title: "Copy to clipboard",
                onClick: () => S.util.copyToClipboard(byIdUrlDocView)
            }));

        children.push(this.titleDiv("Timeline View by ID"), //
            new Div(byIdUrlTimelineView, {
                className: "linkDisplay",
                title: "Copy to clipboard",
                onClick: () => S.util.copyToClipboard(byIdUrlTimelineView)
            }));

        // #rss-disable todo-2: rss feeds disabled for now (need to figure out how to format)
        // const rssFeed = window.location.origin + "/rss?id=" + node.id;
        // children.push(this.titleDiv("Node RSS Feed"), //
        //     new Div(rssFeed, {
        //         className: "linkDisplay",
        //         title: "Copy to clipboard",
        //         onClick: () => this.showLink(rssFeed)
        //     }));

        const attComps: Comp[] = [];
        if (node.attachments) {
            const atts: Attachment[] = S.props.getOrderedAtts(node);
            for (const att of atts) {
                attComps.push(new Tag("hr"));
                const bin = att ? att.bin : null;
                if (bin) {
                    attComps.push(new Div(null, { className: "float-end" }, [new NodeCompBinary(node, (att as any).key, true, false, true, null)]));
                    attComps.push(this.titleDiv(att.fileName + " (" + S.util.formatMemory(att.size) + " " + att.mime + ")"));
                    const linkGroup = new Div(null, { className: "attachmentLinkGroup" });

                    const attByIdUrl = window.location.origin + "/f/id/" + node.id;
                    linkGroup.addChildren([
                        this.titleDiv("View By Id"), //
                        new Div(attByIdUrl, {
                            className: "linkDisplay",
                            title: "Copy to clipboard",
                            onClick: () => S.util.copyToClipboard(attByIdUrl)
                        })
                    ]);

                    const downloadAttByIdUrl = attByIdUrl + "?download=y";
                    linkGroup.addChildren([
                        this.titleDiv("Download By Id"), //
                        new Div(downloadAttByIdUrl, {
                            className: "linkDisplay",
                            title: "Copy to clipboard",
                            onClick: () => S.util.copyToClipboard(downloadAttByIdUrl)
                        })
                    ]);

                    if (node.name) {
                        const attByNameUrl = window.location.origin + pathPart;
                        linkGroup.addChildren([
                            this.titleDiv("View By Name"), //
                            new Div(attByNameUrl, {
                                className: "linkDisplay",
                                title: "Copy to clipboard",
                                onClick: () => S.util.copyToClipboard(attByNameUrl)
                            })
                        ]);

                        const downloadAttByNameUrl = attByNameUrl + "?download=y";
                        linkGroup.addChildren([
                            this.titleDiv("Download By Name"), //
                            new Div(downloadAttByNameUrl, {
                                className: "linkDisplay",
                                title: "Copy to clipboard",
                                onClick: () => S.util.copyToClipboard(downloadAttByNameUrl)
                            })
                        ]);
                    }

                    attComps.push(linkGroup);
                }
            }

            if (attComps.length > 0) {
                children.push(new CollapsiblePanel("Show Attachment URLs", "Hide Attachment URLs", null, attComps, true, (exp: boolean) => {
                    dispatch("ExpandAttachment", s => s.linksToAttachmentsExpanded = exp);
                }, getAs().linksToAttachmentsExpanded, "marginAll", "attachmentLinksPanel", ""));
            }
        }

        dlgHolder.dlg = new MessageDlg(null, "Node URLs", null, new Div(null, null, children), false, 0, null);
        dlgHolder.dlg.open();
    }

    titleDiv(title: string): Div {
        return new Div(title, { className: "largerFont" });
    }

    allowAction(type: TypeIntf, action: NodeActionType, node: NodeInfo): boolean {
        return !type || type.allowAction(action, node);
    }

    async renderPage(res: J.RenderNodeResponse, scrollToTop: boolean,
        targetNodeId: string, clickTab: boolean = true, allowScroll: boolean = true) {
        if (res && res.noDataResponse) {
            S.util.showMessage(res.noDataResponse, "Note");
            return;
        }

        try {
            if (C.DEBUG_SCROLLING) {
                console.log("renderPage: scrollToTop=" + scrollToTop + " allowScroll=" + allowScroll);
            }

            await promiseDispatch("RenderPage", s => {
                s.fullScreenConfig = { type: FullScreenType.NONE };

                if (!s.activeTab || clickTab) {
                    S.tabUtil.tabChanging(s.activeTab, C.TAB_MAIN);
                    s.activeTab = C.TAB_MAIN;
                }

                s.pageMessage = null;

                if (MainTab.inst) {
                    MainTab.inst.openGraphComps = [];
                }

                let delay: number = 200;

                /* Note: This try block is solely to enforce the finally block to happen to guarantee setting s.rendering
                back to false, no matter what */
                try {
                    if (res) {
                        s.node = res.node;
                        s.endReached = res.endReached;

                        const data: TabBase = S.tabUtil.getAppTabData(C.TAB_MAIN);
                        if (!data || !data.props) return false;
                        data.props.breadcrumbs = res.breadcrumbs;

                        // if the rendered node has one child and it's an RSS node then render it right away.
                        if (s.node.children?.length === 1 && s.node.children[0].type === J.NodeType.RSS_FEED) {
                            const feedSrc: string = S.props.getPropStr(J.NodeProp.RSS_FEED_SRC, s.node.children[0]);
                            if (feedSrc) {
                                const feedSrcHash = S.util.hashOfString(feedSrc);

                                setTimeout(() => {
                                    dispatch("AutoRSSUpdate", s => {
                                        s.rssFeedCache[feedSrcHash] = "loading";
                                        s.rssProgressText = null;
                                        s.rssFeedPage[feedSrcHash] = 1;
                                        RSSView.loadFeed(s, feedSrcHash, feedSrc);
                                    });
                                }, 250);
                            }
                        }
                    }

                    let targetNode: NodeInfo = null;
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
                        this.fadeInId = targetNodeId;
                        S.quanta.pendingLocationHash = null;
                    }
                    else {
                        if (!this.fadeInId) {
                            this.fadeInId = s.node.id;
                        }
                    }

                    if (s.node) {
                        S.histUtil.pushTreeHistory(s.node);
                    }

                    if (this.debug && s.node) {
                        console.log("RENDER NODE: " + s.node.id);
                    }

                    if (S.quanta.pendingLocationHash) {
                        window.location.hash = S.quanta.pendingLocationHash;
                        // Note: the substring(1) trims the "#" character off.
                        if (allowScroll) {
                            S.nodeUtil.highlightRowById(s, S.quanta.pendingLocationHash.substring(1), true);
                            s.rendering = true;
                        }
                        S.quanta.pendingLocationHash = null;
                    }
                    else if (allowScroll && targetNodeId) {
                        if (C.DEBUG_SCROLLING) {
                            console.log("highlight byId: " + targetNodeId);
                        }

                        S.nodeUtil.highlightRowById(s, targetNodeId, true);
                        s.rendering = true;
                    }
                    else if (allowScroll && (scrollToTop || !S.nodeUtil.getHighlightedNode())) {
                        if (C.DEBUG_SCROLLING) {
                            console.log("rendering highlight: scrollTop");
                        }
                        S.view.scrollToTop();
                        s.rendering = true;
                    }
                    else if (allowScroll) {
                        console.log("warning: slow scroll delay");
                        delay = 2000;
                        S.view.scrollToNode(null, delay);
                        s.rendering = true;
                    }
                }
                finally {
                    if (s.rendering) {
                        /* This event is published when the page has finished the render stage */
                        PubSub.subSingleOnce(C.PUBSUB_postMainWindowScroll, () => {
                            setTimeout(() => {
                                dispatch("settingVisible", s => {
                                    s.rendering = false;
                                    this.allowFadeInId = true;
                                });
                            },
                                /* This delay has to be long enough to be sure scrolling has taken place already, so if we
                                set a longer delay above this delay should be even a bit longer than that.
                                */
                                delay + 200);
                        });
                    }
                    else {
                        this.allowFadeInId = true;
                    }

                    // only focus the TAB if we're not editing, because if editing the edit field
                    // will be focused. In other words, if we're about to initiate editing a
                    // TextArea field will be getting focus so we don't want to set the MAIN tab as
                    // the focus and mess that up.
                    if (!s.editNode) {
                        S.domUtil.focusId(C.TAB_MAIN);
                    }
                }
            });
        }
        catch (e) {
            S.util.logErr(e, "render failed");
        }
    }

    renderChildren(node: NodeInfo, tabData: TabBase<any>, level: number, allowNodeMove: boolean): Comp {
        if (!node || !node.children) return null;

        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get
         * filtered out on the client side for various reasons.
         */
        const layout = S.props.getPropStr(J.NodeProp.LAYOUT, node);
        const ast = getAs();

        /* Note: for edit mode (and our own node), or on mobile devices, always use vertical layout.
        */
        if ((ast.userPrefs.editMode && S.props.isMine(node)) || ast.mobileMode || !layout || layout === "v") {
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

    newUserAccountTips(): Div {
        return new Div(null, { className: "bigMargin alert alert-info" }, [
            new Div("You haven't created any content here yet. See the User Guide to learn how.", { className: "bigMarginBottom" }),
            new Button("View User Guide", () => S.nav.openContentNode(":user-guide", false))
        ]);
    }

    getAvatarImgUrl(ownerId: string, avatarVer: string) {
        if (!avatarVer) return null;
        return S.rpcUtil.getRpcPath() + "bin/avatar" + "?nodeId=" + ownerId + "&v=" + avatarVer;
    }

    getProfileHeaderImgUrl(ownerId: string, avatarVer: string) {
        if (!avatarVer) return null;
        return S.rpcUtil.getRpcPath() + "bin/profileHeader" + "?nodeId=" + ownerId + "&v=" + avatarVer;
    }

    makeHeaderAvatar(node: NodeInfo): Img {
        const src: string = node.apAvatar || this.getAvatarImgUrl(node.ownerId, node.avatarVer);
        if (!src) {
            return null;
        }

        // Note: we DO have the image width/height set on the node object (node.width, node.hight)
        // but we don't need it for anything currently
        return new Img({
            src,
            // For Transfer in Progress need a RED border here.
            className: "avatarImage",
            title: "User: " + node.owner + "\n\nShow Profile",
            [C.USER_ID_ATTR]: node.ownerId,
            onClick: S.nav._clickToOpenUserProfile
        });
    }

    /* Returns true if the logged in user and the type of node allow the property to be edited by the user */
    allowPropertyEdit(node: NodeInfo, propName: string): boolean {
        const type: TypeIntf = S.plugin.getType(node.type);
        return type ? type.allowPropertyEdit(propName) : true;
    }

    isReadOnlyProperty(propName: string): boolean {
        return S.props.readOnlyPropertyList.has(propName);
    }

    async showGraph(node: NodeInfo, searchText: string) {
        node = node || S.nodeUtil.getHighlightedNode();

        const res = await S.rpcUtil.rpc<J.GraphRequest, J.GraphResponse>("graphNodes", {
            searchDefinition: {
                searchText,
                sortDir: null,
                sortField: null,
                searchProp: null,
                fuzzy: false,
                caseSensitive: false,
                recursive: true,
                requirePriority: false,
                requireAttachment: false,
                requireDate: false
            },
            nodeId: node.id
        });

        dispatch("ShowGraph", s => {
            s.savedActiveTab = s.activeTab;
            s.fullScreenConfig = { type: FullScreenType.GRAPH, nodeId: node.id };
            s.graphSearchText = searchText;
            s.graphData = res.rootNode;
            FullScreenGraphViewer.reset();
        });
    }

    renderTagsDiv(node: NodeInfo, moreClasses: string = ""): Div {
        if (!node || !node.tags) return null;
        const tags = node.tags.split(" ");
        const spans: Span[] = tags.map(tag => new Span(tag, { className: "nodeTags" }));

        return new Div(null, {
            title: "Click to copy to clipboard",
            onClick: () => S.util.copyToClipboard(node.tags),
            className: "clickable float-end " + moreClasses
        }, spans);
    }

    renderUser(node: NodeInfo, user: string, _userBio: string, imgSrc: string,
        displayName: string, className: string, iconClass: string, _showMessageButton: boolean, onClick: (evt: any) => void): Comp {

        const img: Img = imgSrc
            ? new Img({
                className: iconClass,
                src: imgSrc,
                onClick
            }) : null;

        const attribs: any = {};
        if (className) attribs.className = className;
        const tagsDiv = this.renderTagsDiv(node, "microMarginBottom");

        return new Div(null, attribs, [
            new FlexRowLayout([
                new Div(null, { className: "friendLhs" }, [
                    img
                ]),
                new Div(null, { className: "friendRhs" }, [
                    // I'm removing this because we can click on the image and to these thru the Profile Dialog of the user.
                    // new ButtonBar([
                    //     // todo-2: need to make ALL calls be able to do a newSubNode here without so we don't need
                    //     // the showMessagesButton flag.
                    //     showMessageButton ? new Button("Message", S.edit.newSubNode, {
                    //         title: "Send Private Message",
                    //         [C.NODE_ID_ATTR]: nodeId
                    //     }) : null,
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
                    ]),
                    tagsDiv,
                    new Clearfix()

                    // The page just looks cleaner with the username only. We can click them to see their bio text.
                    // userBio ? new Html(userBio, {
                    //     className: "userBio"
                    // }) : null
                ])
            ])
        ]);
    }

    renderLinks(node: NodeInfo, tabData: TabBase): Div {
        if (!node.links) return null;
        const linkComps: Comp[] = [];
        const idSet: Set<string> = new Set();
        if (node.links) {
            const nameSet: Set<string> = new Set();
            node.links.forEach((link: J.NodeLink) => {
                if (!nameSet.has(link.name)) {
                    nameSet.add(link.name);
                    if (link.embed) {
                        idSet.add(link.id);
                    }
                    linkComps.push(new Span(link.name, {
                        title: "RDF: Click to Find Objects",
                        className: "nodeLink",
                        onClick: () => {
                            S.srch.search(node.id, null, link.name, J.Constant.SEARCH_TYPE_LINKED_NODES, "Predicate: " + link.name, null, false,
                                false, 0, true, null, null, false, false, false, true, false);
                        }
                    }));
                }
            });
        }

        node.linkedNodes?.forEach((node: J.NodeInfo) => {
            if (idSet.has(node.id)) {
                linkComps.push(new NodeCompContent(node, tabData, true, true, tabData.id, null, true, null));
            }
        });

        return linkComps.length > 0 ? new Div(null, { className: "linksPanel" }, linkComps) : null;
    }

    buildCustomLinks(configArray: any): Comp[] {
        const items: Comp[] = [];

        if (configArray) {
            for (const menuItem of configArray) {
                if (menuItem.name === "separator") {
                    // items.push(new MenuItemSeparator());
                }
                else {
                    const link: string = menuItem.link;
                    let func: () => void = null;

                    if (link) {
                        // allows ability to select a tab
                        if (link.startsWith("tab:")) {
                            const tab = link.substring(4);

                            /* special case for feed tab */
                            if (tab === C.TAB_FEED && !getAs().isAnonUser) {
                                func = S.nav._messagesToFromMe;
                            }
                            else {
                                func = () => S.tabUtil.selectTab(tab);
                            }
                        }
                        // covers http and https
                        else if (link.startsWith("http")) {
                            func = () => window.open(link);
                        }
                        // named nodes like ":myName"
                        else {
                            func = () => S.nav.openContentNode(link, true);
                        }
                    }

                    items.push(new AppNavLink(menuItem.name, func));
                }
            }
        }
        return items;
    }

    renderTagsStrDiv(tagsStr: string, classes: string, removeTag: (val: string) => void, labelClickFunc: () => void): Div {
        if (!tagsStr) tagsStr = "";
        const tags = tagsStr.split(" ");
        const spans: Span[] = tags.map(tag => {
            if (!tag) return null;
            return new Span(tag, {
                title: "Click to Remove",
                onClick: (evt: Event) => {
                    evt.stopPropagation();
                    removeTag(tag);
                },
                className: "nodeTagInEditor"
            })
        });

        const attrs = classes ? { className: classes } : null;
        return new Div(null, attrs, [
            new Div(null, { className: "inlineBlock" }, [
                new Div(null, {
                    className: "tagsFlexContainer"
                }, spans)
            ]),
            new IconButton("fa-tag", "", {
                onClick: (evt: Event) => {
                    evt.stopPropagation();
                    labelClickFunc();
                },
                title: "Select Hashtags"
            })
        ]);
    }

    buildCreditDiv(): Div {
        const ast = getAs();
        if (ast.userProfile?.balance) {
            const credit = getAs().userProfile.balance;
            const clazz = credit < 1 ? "accountCreditLow" : "accountCredit";
            const msg = credit < 1 ? " (Running low! Click to add funds)" : "";
            return new Div("Credit: $" + credit.toFixed(6) + msg, {
                className: clazz + " float-end",
                onClick: S.user.addAccountCredit
            });
        }
        return null;
    }

    makeDeleteQuestionDiv(): Div {
        const ast = getAs();
        const question = ast.nodesToDel.length === 1 ? "Delete" : "Delete " + ast.nodesToDel.length + " nodes";
        return new Div(null, { className: "deleteQuestion" }, [
            new Span(question, {
                className: "alert alert-danger askDeleteQuestion",
                onClick: () => S.edit.immediateDeleteSelNodes(getAs().nodesToDel)
            }),
            new Span("Cancel", {
                className: "alert alert-info askDeleteQuestion",
                onClick: S.edit._endDelete
            })
        ]);
    }

    getSignatureIcon(node: NodeInfo) {
        const sigFail: string = S.props.getClientPropStr(J.NodeProp.SIG_FAIL, node);
        if (sigFail) {
            return new Icon({
                title: "Crypto Signature Verification Failed",
                className: "fa fa-certificate fa-lg failedSignatureIcon mediumMarginRight"
            });
        } else {
            const signed = S.props.getPropStr(J.NodeProp.CRYPTO_SIG, node);
            if (signed) {
                return new Icon({
                    title: "Crypto Signature Verified",
                    className: "fa fa-certificate fa-lg signatureIcon mediumMarginRight"
                });
            }
        }
    }
}

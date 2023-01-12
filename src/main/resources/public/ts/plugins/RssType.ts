import { dispatch } from "../AppContext";
import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Anchor } from "../comp/core/Anchor";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { Html } from "../comp/core/Html";
import { Icon } from "../comp/core/Icon";
import { IconButton } from "../comp/core/IconButton";
import { Img } from "../comp/core/Img";
import { Span } from "../comp/core/Span";
import { Spinner } from "../comp/core/Spinner";
import { OpenGraphPanel } from "../comp/OpenGraphPanel";
import { Constants as C } from "../Constants";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { MainTab } from "../tabs/data/MainTab";
import { TypeBase } from "./base/TypeBase";

export class RssType extends TypeBase {
    static expansionState: any = {};
    static lastGoodFeed: J.RssFeed;
    static lastGoodPage: number;

    constructor() {
        super(J.NodeType.RSS_FEED, "RSS Feed", "fa-rss", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, ast: AppState): boolean {
        switch (action) {
            case NodeActionType.upload:
                return false;
            default:
                return true;
        }
    }

    getEditLabelForProp(propName: string): string {
        if (propName === J.NodeProp.RSS_FEED_SRC) {
            return "RSS Feed URLs (one per line)";
        }
        return propName;
    }

    getEditorRowsForProp(propName: string): number {
        if (propName === J.NodeProp.RSS_FEED_SRC) {
            return 10;
        }
        return 1;
    }

    getAllowPropertyAdd(): boolean {
        return false;
    }

    getAllowContentEdit(): boolean {
        return true;
    }

    getCustomProperties(): string[] {
        return [J.NodeProp.RSS_FEED_SRC];
    }

    allowPropertyEdit(propName: string, ast: AppState): boolean {
        return propName === J.NodeProp.RSS_FEED_SRC;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.RSS_FEED_SRC);
    }

    super_render = this.render;
    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean, ast: AppState): Comp => {

        let feedContent: Comp = null;

        const feedSrc: string = S.props.getPropStr(J.NodeProp.RSS_FEED_SRC, node);
        if (feedSrc) {
            const feedSrcHash = S.util.hashOfString(feedSrc);

            /*
            If we find the RSS feed in the cache, use it.
            disabling cache for now: somehow the "Play Button" never works (onClick not wired) whenever it renders from the cache and i haven't had time to
            figure this out yet.
            */
            if (ast.rssFeedCache[feedSrcHash] === "failed") {
                feedContent = new Div("Feed Failed: " + feedSrc, {
                    className: "marginAll"
                });
            }
            // if it's currently loading show the spinner
            else if (ast.rssFeedCache[feedSrcHash] === "loading") {
                feedContent = new Div(null, { className: "bigMargin" }, [
                    new Heading(4, "Loading RSS Feed..."),
                    new Spinner()
                ]);
            }
            else if (!ast.rssFeedCache[feedSrcHash]) {
                feedContent = new Button("Load Feed", () => {
                    dispatch("LoadingFeed", s => {
                        s.rssFeedCache[feedSrcHash] = "loading";
                        RssType.loadFeed(ast, feedSrcHash, feedSrc);
                    });
                }, null, "btn-primary marginAll");
            }
            /* if the feedCache doesn't contain either "failed" or "loading" then treat it like data and render it */
            else if (ast.rssFeedCache[feedSrcHash]) {
                feedContent = this.renderItem(ast.rssFeedCache[feedSrcHash], feedSrc, ast);
            }
            else {
                console.error("unknown state in feed runner");
            }
        }

        const baseComp = this.super_render(node, tabData, rowStyling, isTreeView, isLinkedNode, ast);
        return new Div(null, null, [
            baseComp,
            feedContent
        ]);
    }

    static loadFeed = async (ast: AppState, feedSrcHash: string, feedSrc: string) => {
        /* warning: paging here is not zero offset. First page is number 1 */
        let page: number = ast.rssFeedPage[feedSrcHash];
        if (!page) {
            page = 1;
            ast.rssFeedPage[feedSrcHash] = page;
        }

        const res = await S.rpcUtil.rpc<J.GetMultiRssRequest, J.GetMultiRssResponse>("getMultiRssFeed", {
            urls: feedSrc,
            page
        }, true);

        if (!res?.feed) {
            // new MessageDlg(err.message || "RSS Feed failed to load.", "Warning", null, null, false, 0, state).open();
            // console.log(err.message || "RSS Feed failed to load.");
            dispatch("RSSUpdated", s => {
                s.rssFeedCache[feedSrcHash] = "failed";
            });
        }
        else {
            dispatch("RSSUpdated", s => {
                S.domUtil.focusId(C.TAB_MAIN);
                S.tabUtil.tabScroll(s, C.TAB_MAIN, 0);
                setTimeout(() => {
                    S.tabUtil.tabScroll(s, C.TAB_MAIN, 0);
                }, 1000);

                if (!res.feed.entries || res.feed.entries.length === 0) {
                    s.rssFeedCache[feedSrcHash] = RssType.lastGoodFeed || {};
                    s.rssFeedPage[feedSrcHash] = RssType.lastGoodPage || 1;
                    setTimeout(() => {
                        S.util.showMessage("No more RSS items found.", "RSS");
                    }, 250);
                }
                else {
                    s.rssFeedCache[feedSrcHash] = res.feed;
                    RssType.lastGoodFeed = res.feed;
                    RssType.lastGoodPage = s.rssFeedPage[feedSrcHash];
                }
            });
        }
    }

    renderItem(feed: J.RssFeed, feedSrc: string, ast: AppState): Comp {
        const feedList = new Div("", { className: "rss-feed-listing" });
        const feedOut: Comp[] = [];

        const feedSrcHash = S.util.hashOfString(feedSrc);
        let page: number = ast.rssFeedPage[feedSrcHash];
        if (!page) {
            page = 1;
        }

        feedList.addChild(new Checkbox("Headlines Only", {
            className: "float-end"
        }, {
            setValue: (checked: boolean) => {
                dispatch("SetHeadlinesFlag", s => S.edit.setRssHeadlinesOnly(s, checked));
            },
            getValue: (): boolean => ast.userPrefs.rssHeadlinesOnly
        }));

        feedList.addChild(this.makeNavButtonBar(page, feedSrc, feedSrcHash, ast));

        /* Main Feed Image */
        if (feed.image) {
            feedOut.push(new Img({
                className: "rss-feed-image",
                src: feed.image
                // align: "left" // causes text to flow around
            }));
        }

        /* Main Feed Title */
        if (feed.title) {
            if (feed.link) {
                feedOut.push(new Anchor(feed.link, feed.title, {
                    className: "rssFeedTitle",
                    target: "_blank"
                }));
            }
            else {
                feedOut.push(new Span(feed.title, {
                    className: "rssFeedTitle"
                }));
            }
        }

        feedOut.push(new Div(null, { className: "clearBoth" }));

        if (feed.description) {
            feedOut.push(new Html(feed.description));
        }

        // A bit of a hack to avoid showing the feed URL of our own aggregate feeds. We could publish this but no need to and
        // is even undesirable for now. Also the newline check is to not show the feed urls if this is a multi RSS feed one
        if (feedSrc.indexOf("/multiRss?id=") === -1 && feedSrc.indexOf("\n") === -1) {
            feedOut.push(new Div(feedSrc));
        }

        if (feed.author) {
            feedOut.push(new Div(feed.author));
        }

        const feedOutDiv = new Div(null, { className: "marginBottom marginLeft" }, feedOut);
        feedList.addChild(feedOutDiv);

        for (const item of feed.entries) {
            feedList.addChild(this.buildFeedItem(feed, item, ast));
        }

        feedList.addChild(this.makeNavButtonBar(page, feedSrc, feedSrcHash, ast));
        return feedList;
    }

    makeNavButtonBar = (page: number, feedSrc: string, feedSrcHash: string, ast: AppState): ButtonBar => {
        return new ButtonBar([
            page > 2 ? new IconButton("fa-angle-double-left", null, {
                onClick: (event: Event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.setPage(feedSrc, feedSrcHash, ast, 1);
                },
                title: "First Page"
            }) : null,
            page > 1 ? new IconButton("fa-angle-left", null, {
                onClick: (event: Event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.pageBump(feedSrc, feedSrcHash, ast, -1);
                },
                title: "Previous Page"
            }) : null,
            new IconButton("fa-angle-right", "More", {
                onClick: (event: Event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.pageBump(feedSrc, feedSrcHash, ast, 1);
                },
                title: "Next Page"
            })
        ], "text-center marginTop marginBottom");
    }

    /* cleverly does both prev or next paging */
    pageBump = (feedSrc: string, feedSrcHash: string, ast: AppState, bump: number) => {
        let page: number = ast.rssFeedPage[feedSrcHash];
        if (!page) {
            page = 1;
        }
        if (page + bump < 1) return;
        this.setPage(feedSrc, feedSrcHash, ast, page + bump);
    }

    setPage = (feedSrc: string, feedSrcHash: string, ast: AppState, page: number) => {
        dispatch("RSSUpdated", s => {
            // deleting will force a requery from the server
            s.rssFeedCache[feedSrcHash] = "loading";
            s.rssFeedPage[feedSrcHash] = page;
            RssType.loadFeed(ast, feedSrcHash, feedSrc);
        });
    }

    buildFeedItem(feed: J.RssFeed, entry: J.RssFeedEntry, ast: AppState): Comp {
        const children: Comp[] = [];
        const headerDivChildren = [];
        let imageShown = false;

        /* todo-2: Sometimes entry.category can be an Object (not a String) here which will
        make React fail badly and render the entire page blank,
        blowing up the hole app, so we need probably validate EVERY
        property on entry with 'instanceof' like we're doing here to protect
        against that kind of chaos */
        // if (entry.category instanceof Object) {
        //     // todo-2: put this kind of typeof in "S.util.isString"
        //     if (entry.category.$ && (typeof entry.category.$.term === "string")) {
        //         // Some feeds have the category text buried under "$.term" so we just fix that here. This is a quick fix
        //         // only applicable to one feed afaik, and I'm not going to dig deeper into why we got this scenario (for now)
        //         entry.category = entry.category.$.term;
        //     }
        // }
        // if ((typeof entry.category === "string")) {
        //     headerDivChildren.push(new Div(entry.category));
        // }

        let anchor: Anchor = null;
        if (entry.title) {
            headerDivChildren.push(new Div(null, { className: "marginBottom" }, [
                anchor = new Anchor(entry.link, null, {
                    className: "rssAnchor",
                    target: "_blank",
                    dangerouslySetInnerHTML: Comp.getDangerousHtml(entry.title)
                })
            ]));
        }

        if (entry.subTitle) {
            headerDivChildren.push(new Span(entry.subTitle, {
                className: "rssSubTitle"
            }));
        }

        children.push(entry.parentFeedTitle ? new Div(null, {
            // className: "marginRight",
            dangerouslySetInnerHTML: Comp.getDangerousHtml(entry.parentFeedTitle)
        }) : null);

        children.push(new Div(null, null, headerDivChildren));

        // process audio enclosures
        let audioUrl: string = null;
        if (entry.enclosures) {
            entry.enclosures.forEach(enc => {
                if (enc.type && enc.type.indexOf("audio/") !== -1) {
                    audioUrl = enc.url;
                    const downloadLink = new Anchor(enc.url, "[ Download " + enc.type + " ]", { className: "rssDownloadLink" }, null);
                    const audioButton = new Button("Play Audio", () => {
                        const dlg = new AudioPlayerDlg(feed.title, entry.title, null, enc.url, 0);
                        dlg.open();
                    }, { className: "marginTop" }, "btn-primary");
                    children.push(new ButtonBar([audioButton, downloadLink], null, "rssMediaButtons marginBottom"));
                }
            });
        }

        children.push(new Div(null, { className: "clearBoth" }));

        if (entry.enclosures) {
            entry.enclosures.forEach(enc => {
                if (enc.type && enc.type.indexOf("image/") !== -1) {
                    imageShown = true;
                    children.push(new Img({
                        className: "rss-feed-image",
                        src: enc.url
                    }));
                }
            });
        }

        if (entry.image) {
            imageShown = true;
            children.push(new Img({
                className: "rss-feed-image",
                src: entry.image
            }));
        }
        else if (entry.thumbnail) {
            imageShown = true;
            children.push(new Img({
                className: "rss-feed-image",
                src: entry.thumbnail
            }));
        }

        if (entry.mediaContent) {
            let imageAdded = false;
            imageShown = true;
            entry.mediaContent.forEach(mc => {
                /* some feeds have the same image multiple times for some reason so we
                    use imageAdded to keep it from appearing twice */
                if (mc.medium === "image" && !imageAdded) {
                    imageAdded = true;
                    children.push(new Img({
                        className: "rss-feed-image",
                        src: mc.url
                    }));
                }
            });
        }

        if (!ast.userPrefs.rssHeadlinesOnly) {
            if (entry.description) {
                children.push(new Html(entry.description));
            }
        }

        if (anchor) {
            const og = new OpenGraphPanel(ast, MainTab.inst, anchor.getId("og_rss_"), entry.link, "openGraphPanelRss", "openGraphImageRss", false, false, !imageShown);
            children.push(og);

            if (MainTab.inst) {
                MainTab.inst.openGraphComps.push(og);
            }
        }

        const linkIcon = new Icon({
            className: "fa fa-link fa-lg rssLinkIcon",
            title: "Copy RSS Item URL into clipboard",
            onClick: () => {
                S.util.copyToClipboard(entry.link);
                S.util.flashMessage("Copied to Clipboard: " + entry.link, "Clipboard", true);
            }
        });

        const postIcon = !ast.isAnonUser ? new Icon({
            className: "fa fa-comment fa-lg rssPostIcon",
            title: "Post a comment about this Article/Link",
            onClick: () => {
                S.edit.addNode(null, null, false, entry.title + "\n\n" + entry.link, null, null, null, false, ast);
            }
        }) : null;

        const bookmarkIcon = !ast.isAnonUser ? new Icon({
            className: "fa fa-bookmark fa-lg rssBookmarkIcon",
            title: "Bookmark this RSS entry",
            onClick: () => {
                let content = "#### " + feed.title + ": " + entry.title + "\n\n" + entry.link;
                if (audioUrl) content += "\n\n" + audioUrl;
                S.edit.addLinkBookmark(content, audioUrl, ast);
            }
        }) : null;

        const footerSpan = new Span(entry.publishDate, { className: "marginRight" });

        children.push(new Div(null, null, [
            new Span(null, { className: "float-end" }, [
                footerSpan, postIcon, linkIcon, bookmarkIcon
            ]),
            // is this clearfix needed now that we wrapped this stuff in this div?
            new Clearfix()
        ]));

        return new Div(null, { className: "rss-feed-item" }, children);
    }

    /* This will process all the images loaded by the RSS Feed content to make sure they're all 300px wide because
    otherwise we can get rediculously large images. */
    domPreUpdateFunction(parent: CompIntf): void {
        // DO NOT DELETE: This is an important example of how to detect dupliate images
        // const urlSet: Set<string> = new Set<string>();

        S.domUtil.forEachElmBySel("#" + parent.getId() + " .rss-feed-listing img", (el: HTMLElement, i: any) => {

            // this logic doesn't apply to openGraphImages, so we detect those and bail out
            // Warning: this applies to openGraphImage, openGrapImageRss, and openGraphImageVert
            if (el.className.indexOf("openGraphImage") !== -1) {
                return;
            }

            /* Because some feeds use the same image in the header and content we try to detect that here
            and remove any but the first ocurrance of any given image on the entire page.

            NOTE: For now I decided it's a bit confusing to the user to have images disappar from the page, and it's
            better to allow duplicate images to show up than to have some mysteriously not showing up.

            todo-2: We could use this same logic on each individual FEED ITEM (fediverse), but for now I decided not to
            hide any dupliate images so this is commented out for now.
            */
            // const src: string = (el as any).src;
            // if (urlSet.has(src)) {
            //     el.style.display = "none";
            //     return;
            // }

            el.removeAttribute("align");

            // use 'block' here to stop any text from being crammed down the right side of the page
            // where there might not be enough space.
            el.style.display = "block";

            // DO NOT DELETE: This is an important example of how to detect dupliate images
            // urlSet.add(src);

            // console.log("IMG SRC: " + (el as any).src);
            el.style.borderRadius = ".6em";
            el.style.border = "1px solid gray";
            el.style.marginBottom = "12px";

            /* Setting width and removing height ensures the image does fit into our colum display
            and also will not stretch. We set images to max of 50% because for displaying RSS feeds we don't
            want any huge images going full width of the view. It hinders scrolling, by just consuming too much space. */
            el.style.maxWidth = "50%";
            delete el.style.width;
            el.removeAttribute("height");
        });

        // S.domUtil.forEachElmBySel("#" + parent.getId() + " .rss-feed-image", (el, i) => {
        //     el.style.maxWidth = "40%";
        // });
    }
}

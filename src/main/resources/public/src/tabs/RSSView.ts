import { dispatch, getAs } from "../AppContext";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
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
import { Progress } from "../comp/core/Progress";
import { TabHeading } from "../comp/core/TabHeading";
import { NodeCompMarkdown } from "../comp/node/NodeCompMarkdown";
import { OpenGraphPanel } from "../comp/OpenGraphPanel";
import { Constants as C } from "../Constants";
import { TabBase } from "../intf/TabBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { MainTab } from "../tabs/data/MainTab";

export class RSSView extends AppTab<any, RSSView> {

    static lastGoodFeed: J.RssFeed;
    static lastGoodPage: number;
    static loading: boolean = false;

    constructor(data: TabBase<any, RSSView>) {
        super(data);
        data.inst = this;
    }

    override preRender(): boolean | null {
        const ast = getAs();
        let comp: NodeCompMarkdown = null;
        let feedContent: Comp = null;

        const feedSrc: string = ast.rssNode ? S.props.getPropStr(J.NodeProp.RSS_FEED_SRC, ast.rssNode) : null;
        let feedSrcHash: string = null;
        let feedReady = false;
        let page: number = 0;
        if (feedSrc) {
            feedSrcHash = S.util.hashOfString(feedSrc);

            /*
            If we find the RSS feed in the cache, use it. disabling cache for now: somehow the "Play
            Button" never works (onClick not wired) whenever it renders from the cache and i haven't
            had time to figure this out yet.
            */
            if (ast.rssFeedCache[feedSrcHash] === "failed") {
                feedContent = new Div("Feed Failed: " + feedSrc, {
                    className: "marginAll"
                });
            }
            // if it's currently loading show the spinner
            else if (ast.rssFeedCache[feedSrcHash] === "loading") {
                feedContent = new Div(null, { className: "bigMargin" }, [
                    new Heading(4, "Loading..."),
                    ast.rssProgressText ? new Div(ast.rssProgressText, { className: "bigMarginBottom" }) : null,
                    new Progress()
                ]);
            }
            else if (!ast.rssFeedCache[feedSrcHash]) {
                feedContent = new Div(null, { className: "bigMargin" }, [
                    new Heading(4, "Refreshing..."),
                    new Progress()
                ]);
                setTimeout(() => {
                    dispatch("RefreshingFeed", s => {
                        s.rssFeedCache[feedSrcHash] = "loading";
                        s.rssProgressText = null;
                        RSSView.loadFeed(s, feedSrcHash, feedSrc);
                    });
                }, 250);
            }
            /* if the feedCache doesn't contain either "failed" or "loading" then treat it like data and render it */
            else if (ast.rssFeedCache[feedSrcHash]) {
                feedContent = this.renderFeed(ast.rssFeedCache[feedSrcHash], feedSrc);
                feedReady = true;

                page = ast.rssFeedPage[feedSrcHash];
                if (!page) {
                    page = 1;
                    ast.rssFeedPage[feedSrcHash] = page;
                }
            }
            else {
                console.error("unknown state in feed runner");
            }

            comp = ast.rssNode ? new NodeCompMarkdown(ast.rssNode, null, this.data, null) : null;
        }

        this.children = [
            this.headingBar = new TabHeading([
                new IconButton("fa-arrow-left", "", {
                    onClick: () => S.view.jumpToId(ast.rssNode.id),
                    title: "Back to Folders View"
                }, "marginRight"),
                new Div("RSS Feed", { className: "tabTitle" }),
                new Checkbox("Headlines Only", {
                    className: "tw-float-right"
                }, {
                    setValue: (checked: boolean) => {
                        dispatch("SetHeadlinesFlag", () => S.edit.setRssHeadlinesOnly(checked));
                    },
                    getValue: (): boolean => ast.userPrefs.rssHeadlinesOnly
                }),
                new Clearfix()
            ], this.data),
            feedReady ? this.makeNavButtonBar(page, feedSrc, feedSrcHash, "tw-float-right") : null,
            comp,
            feedContent
        ];
        return true;
    }

    static loadFeed(ust: AppState, feedSrcHash: string, urls: string) {
        if (RSSView.loading) return;

        setTimeout(() => {
            (async () => {
                let res = null;
                try {
                    RSSView.loading = true;

                    /* warning: paging here is not zero offset. First page is number 1 */
                    let page: number = ust.rssFeedPage[feedSrcHash];
                    if (!page) {
                        page = 1;
                        ust.rssFeedPage[feedSrcHash] = page;
                    }

                    res = await S.rpcUtil.rpc<J.GetMultiRssRequest, J.GetMultiRssResponse>("getMultiRssFeed", {
                        urls,
                        page
                    }, true);
                }
                finally {
                    RSSView.loading = false;
                }

                if (!res || !res.feed) {
                    // new MessageDlg(err.message || "RSS Feed failed to load.", "Warning", null, null, false, 0, state).open();
                    dispatch("RSSUpdated", s => {
                        s.rssFeedCache[feedSrcHash] = "failed";
                        s.rssProgressText = null;
                    });
                }
                else {
                    dispatch("RSSUpdated", s => {
                        S.domUtil.focusId(C.TAB_RSS);
                        S.tabUtil.tabScroll(C.TAB_RSS, 0);
                        setTimeout(() => {
                            S.tabUtil.tabScroll(C.TAB_RSS, 0);
                        }, 1000);

                        if (!res.feed.entries || res.feed.entries.length === 0) {
                            s.rssFeedCache[feedSrcHash] = RSSView.lastGoodFeed || {};
                            s.rssProgressText = null;
                            s.rssFeedPage[feedSrcHash] = RSSView.lastGoodPage || 1;
                            setTimeout(() => {
                                S.util.showMessage("No more RSS items found.", "RSS");
                            }, 250);
                        }
                        else {
                            s.rssFeedCache[feedSrcHash] = res.feed;
                            s.rssProgressText = null;
                            RSSView.lastGoodFeed = res.feed;
                            RSSView.lastGoodPage = s.rssFeedPage[feedSrcHash];
                        }
                    });
                }
            })();
        });
    }

    // Repair URLs. This is a hackernoon bug, not a Quanta bug we're working around.
    urlFix(url: string): string {
        if (!url) return url;
        return url.replace("https://hackernoon.com/https://cdn.hackernoon.com", "https://cdn.hackernoon.com");
    }

    renderFeed(feed: J.RssFeed, feedSrc: string): Comp {
        const ast = getAs();
        const feedList = new Div("", { className: "rssFeedListing" });
        const feedOut: Comp[] = [];

        const feedSrcHash = S.util.hashOfString(feedSrc);
        let page: number = ast.rssFeedPage[feedSrcHash];
        if (!page) {
            page = 1;
        }

        /* Main Feed Image */
        if (feed.image) {
            feedOut.push(new Img({
                className: "rssFeedImage",
                src: this.urlFix(feed.image)
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

        if (feed.description) {
            feedOut.push(new Html(feed.description));
        }

        // A bit of a hack to avoid showing the feed URL of our own aggregate feeds. We could
        // publish this but no need to and is even undesirable for now. Also the newline check is to
        // not show the feed urls if this is a multi RSS feed one
        if (feedSrc.indexOf("/multiRss?id=") === -1 && feedSrc.indexOf("\n") === -1) {
            feedOut.push(new Div(feedSrc));
        }

        if (feed.author) {
            feedOut.push(new Div(feed.author));
        }

        if (feedOut.length > 0) {
            const feedOutDiv = new Div(null, { className: "marginBottom marginLeft" }, feedOut);
            feedList.addChild(feedOutDiv);
        }

        for (const item of feed.entries) {
            feedList.addChild(this.buildFeedItem(feed, item));
        }

        feedList.addChild(this.makeNavButtonBar(page, feedSrc, feedSrcHash, "tw-text-center marginTop marginBottom"));
        return feedList;
    }

    makeNavButtonBar(page: number, feedSrc: string, feedSrcHash: string, clazz: string): ButtonBar {
        return new ButtonBar([
            page > 2 ? new IconButton("fa-angle-double-left", null, {
                onClick: (event: Event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.setPage(feedSrc, feedSrcHash, 1);
                },
                title: "First Page"
            }) : null,
            page > 1 ? new IconButton("fa-angle-left", null, {
                onClick: (event: Event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.pageBump(feedSrc, feedSrcHash, -1);
                },
                title: "Previous Page"
            }) : null,
            new IconButton("fa-angle-right", "More", {
                onClick: (event: Event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    this.pageBump(feedSrc, feedSrcHash, 1);
                },
                title: "Next Page"
            })
        ], clazz);
    }

    pageBump(feedSrc: string, feedSrcHash: string, bump: number) {
        const ast = getAs();
        let page: number = ast.rssFeedPage[feedSrcHash];
        if (!page) {
            page = 1;
        }
        if (page + bump < 1) return;
        this.setPage(feedSrc, feedSrcHash, page + bump);
    }

    setPage(feedSrc: string, feedSrcHash: string, page: number) {
        console.log("RSS Page Bump: page=" + page);
        dispatch("RSSUpdated", s => {
            // deleting will force a requery from the server
            s.rssFeedCache[feedSrcHash] = "loading";
            s.rssFeedPage[feedSrcHash] = page;
            RSSView.loadFeed(s, feedSrcHash, feedSrc);
        });
    }

    buildFeedItem(feed: J.RssFeed, entry: J.RssFeedEntry): Comp {
        const ast = getAs();
        const children: Comp[] = [];
        const headerDivChildren = [];
        let imageShown = false;

        /* todo: Sometimes entry.category can be an Object (not a String) here which will make
        React fail badly and render the entire page blank, blowing up the hole app, so we need
        probably validate EVERY property on entry with 'instanceof' like we're doing here to protect
        against that kind of chaos */
        // if (entry.category instanceof Object) {
        //     // todo: put this kind of typeof in "S.util.isString"
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
            if (entry.link) {
                headerDivChildren.push(new Div(null, { className: "marginBottom" }, [
                    anchor = new Anchor(entry.link, null, {
                        className: "rssAnchor",
                        target: "_blank",
                        dangerouslySetInnerHTML: Comp.getDangerousHtml(entry.title)
                    })
                ]));
            }
            else {
                headerDivChildren.push(new Div(entry.title, { className: "marginBottom" }));
            }
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
                    const audioButton = new Button("Play Audio", () =>
                        S.nav.showAudioPlayerTab(null, enc.url, 0, feed.title, entry.title),
                        { className: "marginTop" }, "-primary");
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
                        className: "rssFeedImage",
                        src: this.urlFix(enc.url)
                    }));
                }
            });
        }

        if (entry.image) {
            imageShown = true;
            children.push(new Img({
                className: "rssFeedImage",
                src: this.urlFix(entry.image)
            }));
        }
        else if (entry.thumbnail) {
            imageShown = true;
            children.push(new Img({
                className: "rssFeedImage",
                src: this.urlFix(entry.thumbnail)
            }));
        }

        if (entry.mediaContent) {
            let imageAdded = false;
            imageShown = true;
            entry.mediaContent.forEach(mc => {
                /* some feeds have the same image multiple times for some reason so we use
                    imageAdded to keep it from appearing twice */
                if (mc.medium === "image" && !imageAdded) {
                    imageAdded = true;
                    children.push(new Img({
                        className: "rssFeedImage",
                        src: this.urlFix(mc.url)
                    }));
                }
            });
        }

        if (!entry.title && entry.description) {
            if (entry.link) {
                children.push(new Div(null, { className: "marginBottom" }, [
                    anchor = new Anchor(entry.link, null, {
                        className: "rssAnchor",
                        target: "_blank",
                        dangerouslySetInnerHTML: Comp.getDangerousHtml(entry.description)
                    })
                ]));
            } else {
                children.push(new Div(entry.description, { className: "marginBottom" }))
            }
        }
        else if (!ast.userPrefs.rssHeadlinesOnly) {
            if (entry.description) {
                children.push(new Html(entry.description));
            }
        }

        if (anchor) {
            const og = new OpenGraphPanel(MainTab.inst, "og_rss_" + anchor.getId(), { url: entry.link }, "openGraphPanelRss", "openGraphImageRss", false, false, !imageShown);
            children.push(og);

            if (MainTab.inst) {
                MainTab.inst.openGraphComps.push(og);
            }
        }

        const linkIcon = new Icon({
            className: "fa fa-link fa-lg rssLinkIcon",
            title: "Copy RSS Item URL into clipboard",
            onClick: () => S.util.copyToClipboard(entry.link)
        });

        const postIcon = !ast.isAnonUser ? new Icon({
            className: "fa fa-comment fa-lg rssPostIcon",
            title: "Post a comment about this Article/Link",
            onClick: () => {
                S.edit.addNode(null, J.NodeType.COMMENT, entry.title + "\n\n" + entry.link, null);
            }
        }) : null;

        const bookmarkIcon = !ast.isAnonUser ? new Icon({
            className: "fa fa-bookmark fa-lg rssBookmarkIcon",
            title: "Bookmark this RSS entry",
            onClick: () => {
                let content = "";
                if (feed.title) content += "#### " + feed.title
                if (entry.title) content += ": " + entry.title;
                if (entry.link) {
                    if (content) content += "\n\n";
                    content += entry.link;
                }
                if (audioUrl) {
                    if (content) content += "\n\n";
                    content += audioUrl;
                }

                S.edit.addLinkBookmark(content, audioUrl);
            }
        }) : null;

        const footerSpan = new Span(entry.publishDate, { className: "marginRight" });

        children.push(new Div(null, null, [
            new Span(null, { className: "tw-float-right" }, [
                footerSpan, postIcon, linkIcon, bookmarkIcon
            ]),
            // is this clearfix needed now that we wrapped this stuff in this div?
            new Clearfix()
        ]));

        return new Div(null, { className: "rssFeedItem" }, children);
    }

    /* This will process all the images loaded by the RSS Feed content to make sure they're all
    300px wide because otherwise we can get rediculously large images. */
    domPreUpdateFunction(parent: Comp): void {
        // DO NOT DELETE: This is an important example of how to detect dupliate images
        // const urlSet: Set<string> = new Set<string>();

        S.domUtil.forEachElmBySel("#" + parent.getId() + " .rssFeedListing img", (el: HTMLElement, _i: any) => {

            // this logic doesn't apply to openGraphImages, so we detect those and bail out
            // Warning: this applies to openGraphImage, openGrapImageRss, and openGraphImageVert
            if (el.className.indexOf("openGraphImage") !== -1) {
                return;
            }

            /* Because some feeds use the same image in the header and content we try to detect that
            here and remove any but the first ocurrance of any given image on the entire page.

            NOTE: For now I decided it's a bit confusing to the user to have images disappar from
            the page, and it's better to allow duplicate images to show up than to have some
            mysteriously not showing up.
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

            el.style.borderRadius = ".6em";
            el.style.border = "1px solid gray";
            el.style.marginBottom = "12px";

            /* Setting width and removing height ensures the image does fit into our colum display
            and also will not stretch. We set images to max of 50% because for displaying RSS feeds
            we don't want any huge images going full width of the view. It hinders scrolling, by
            just consuming too much space. */
            el.style.maxWidth = "50%";
            delete el.style.width;
            el.removeAttribute("height");
        });

        // S.domUtil.forEachElmBySel("#" + parent.getId() + " .rssFeedImage", (el, i) => {
        //     el.style.maxWidth = "40%";
        // });
    }
}

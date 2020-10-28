import * as RssParser from "rss-parser";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { Comp } from "../widget/base/Comp";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Heading } from "../widget/Heading";
import { Img } from "../widget/Img";
import { MarkdownDiv } from "../widget/MarkdownDiv";
import { Para } from "../widget/Para";
import { TextContent } from "../widget/TextContent";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RssTypeHandler extends TypeBase {

    static MAX_FEED_ITEMS: number = 50;

    constructor() {
        super(J.NodeType.RSS_FEED, "RSS Feed", "fa-rss", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
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
            return 20;
        }
        return 1;
    }

    getAllowPropertyAdd(): boolean {
        return false;
    }

    getAllowContentEdit(): boolean {
        return false;
    }

    getCustomProperties(): string[] {
        return [J.NodeProp.RSS_FEED_SRC];
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return propName === J.NodeProp.RSS_FEED_SRC;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.RSS_FEED_SRC);
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {

        let feedSrc: string = S.props.getNodePropVal(J.NodeProp.RSS_FEED_SRC, node);
        if (!feedSrc) {
            return (new TextContent("Set the '" + J.NodeProp.RSS_FEED_SRC + "' node property to the RSS Feed URL.", "alert alert-info marginLeft marginTop"));
        }

        let feedSrcHash = S.util.hashOfString(feedSrc);
        let content = node.content;
        let itemListContainer: Div = new Div("", { className: "rss-feed-listing" }, [
            new Heading(3, content)
        ]);

        let parser = new RssParser();
        /*
        If we find the RSS feed in the cache, use it.
        disabling cache for now: somehow the "Play Button" never works (onClick not wired) whenever it renders from the cache and i haven't had time to
        figure this out yet.
        */
        if (state.feedCache[feedSrcHash] === "failed") {
            return new Div("Feed Failed: " + feedSrc, {
                className: "marginAll"
            });
        }
        else if (state.feedCache[feedSrcHash] === "loading") {
            return new Div("Loading: " + feedSrc, {
                className: "marginAll"
            });
        }
        else if (state.feedCache[feedSrcHash]) {
            this.renderItem(state.feedCache[feedSrcHash], feedSrc, itemListContainer, state);
        }
        // otherwise read from the internet
        else {
            state.feedCache[feedSrcHash] = "loading";

            itemListContainer.addChild(new Div("Loading RSS Feed..."));
            itemListContainer.addChild(new Div("(For large feeds this can take a few seconds)"));

            // todo-0: need an additional endpoint called getRssAggregate that takes the feedSrc, and allows it to represent
            // multiple newline delimited feeds and generate the resultant feed by utilizing and updating the rss cach as necessary.
            // let url = S.util.getRemoteHost() + "/proxyGet?url=" + encodeURIComponent(feedSrc);
            let url = S.util.getRemoteHost() + "/multiRssFeed?url=" + encodeURIComponent(feedSrc);

            // console.log("Reading RSS: " + url);
            parser.parseURL(url, (err, feed) => {
                if (!feed) {
                    // new MessageDlg(err.message || "RSS Feed failed to load.", "Warning", null, null, false, 0, state).open();
                    // console.log(err.message || "RSS Feed failed to load.");
                    dispatch({
                        type: "Action_RSSUpdated",
                        state,
                        update: (s: AppState): void => {
                            s.feedCache[feedSrcHash] = "failed";
                        }
                    });
                }
                else {
                    dispatch({
                        type: "Action_RSSUpdated",
                        state,
                        update: (s: AppState): void => {
                            s.feedCache[feedSrcHash] = feed;
                        }
                    });
                }
            });
        }

        return itemListContainer;
    }

    renderItem(feed: any, feedSrc: string, itemListContainer: Comp, state: AppState) {
        // console.log("Render Feed: " + S.util.prettyPrint(feed));
        // Current approach is to put the feed title in the parent node so we don't need it rendered
        // here also
        let feedOut: Comp[] = [];

        let description = feed.description || "";
        let pubDate = feed.pubDate || "";

        if (feed.title) {
            if (feed.link) {
                feedOut.push(new Div(null, null, [
                    new Anchor(feed.link, feed.title, {
                        style: { fontSize: "45px" },
                        target: "_blank"
                    })
                ]));
            }
            else {
                feedOut.push(new Div(feed.title, {
                    style: { fontSize: "45px" },
                    target: "_blank"
                }));
            }
        }

        // console.log("FEED: " + S.util.prettyPrint(feed));

        if (feed.image) {
            // link, title, url
            feedOut.push(new Img(null, {
                style: {
                    maxWidth: "50%",
                    marginBottom: "20px"
                },
                src: feed.image.url,
                title: feed.image.title
            }));
        }

        if (feed.itunes && feed.itunes.image) {
            feedOut.push(new Img(null, {
                style: {
                    maxWidth: "50%"
                },
                src: feed.itunes.image
            }));
        }

        if (description || pubDate) {
            feedOut.push(new Para(description + "  " + pubDate));
        }

        // A bit of a hack to avoid showing the feed URL of our own aggregate feeds. We could publish this but no need to and
        // is even undesirable for now.
        if (feedSrc.indexOf("/multiRss?id=") === -1) {
            feedOut.push(new Div(feedSrc));
        }
        if (feed.creator) {
            feedOut.push(new Div(feed.creator));
        }

        let feedOutDiv = new Div(null, null, feedOut);
        itemListContainer.getChildren().push(feedOutDiv);

        let itemCount = 0;

        // todo-0: this will be faster if we dont' iterata ALL. can't we return false to exit?
        feed.items.forEach(function (item) {
            if (itemCount < RssTypeHandler.MAX_FEED_ITEMS) {
                itemListContainer.getChildren().push(this.buildFeedItem(item, state));
            }
            itemCount++;
        }, this);
    }

    buildFeedItem(entry, state: AppState): Comp {
        let children: Comp[] = [];

        /* todo-0: When viewing a SINGLE feed that is not aggregate, this prefixed title (name of feed itself) is redundant */
        let colonIdx = entry.title.indexOf(":");
        if (colonIdx !== -1) {
            let headerPart = entry.title.substring(0, colonIdx);
            children.push(new Heading(3, headerPart));
            let title = entry.title.substring(colonIdx + 1);
            children.push(new Anchor(entry.link, title, {
                style: { fontSize: "25px" },
                target: "_blank"
            }));
        }
        else {
            children.push(new Anchor(entry.link, entry.title, {
                style: { fontSize: "25px" },
                target: "_blank"
            }));
        }

        if (entry.enclosure && entry.enclosure.url && entry.enclosure.type &&
            entry.enclosure.type.indexOf("audio/") !== -1) {

            let downloadLink = new Anchor(entry.enclosure.url, "[ Download " + entry.enclosure.type + " ]", { className: "rssDownloadLink" }, null, true);

            let audioButton = new Button("Play Audio", //
                () => {
                    new AudioPlayerDlg(entry.enclosure.url, state).open();
                });

            children.push(new ButtonBar([audioButton, downloadLink], null, "rssMediaButtons"));
        }

        if (entry["content:encoded"]) {
            /* set the dangerously flag for this stuff and render as html */
            let contentDiv = new MarkdownDiv(entry["content:encoded"]);
            children.push(contentDiv);
        }
        else if (entry.contentSnippet) {
            let contentDiv = new MarkdownDiv(entry.contentSnippet);
            children.push(contentDiv);
        }

        children.push(new Div(entry.pubDate, { className: "float-right" }));
        children.push(new Div(null, { className: "clearfix" }));

        return new Div(null, { className: "rss-feed-item" }, children);
    }

    /* This will process all the images loaded by the RSS Feed content to make sure they're all 300px wide because
    otherwise we get rediculously large images */
    getDomPreUpdateFunction(parent: CompIntf): void {
        S.util.forEachElmBySel("#" + parent.getId() + " .rss-feed-listing img", (el, i) => {
            el.style.maxWidth = "300px";
            el.style.width = "300px";
        });
    }
}

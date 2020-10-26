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
    static USE_PROXY: boolean = false;
    static CORS_PROXY = "https://cors-anywhere.herokuapp.com/";

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
            return "RSS Feed URL";
        }
        return propName;
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

        let content = node.content;
        let itemListContainer: Div = new Div("", { className: "rss-feed-listing" }, [
            new Heading(3, content)
        ]);

        let parser = new RssParser();
        /*
        Note: some RSS feeds can't be loaded in the browser due to CORS security.
        To get around this, you can use a proxy. (todo-1: need to eliminate this proxy)

        if we find the RSS feed in the cache, use it.
        disabling cache for now: somehow the "Play Button" never works (onClick not wired) whenever it renders from the cache and i haven't had time to
        figure this out yet.
        */
        if (state.failedFeedCache[feedSrc]) {
            return new Div("Feed Failed: " + feedSrc, {
                className: "marginAll"
            });
        }
        else if (state.feedCache[feedSrc]) {
            this.renderItem(state.feedCache[feedSrc], feedSrc, itemListContainer, state);
        }
        // otherwise read from the internet
        else {
            itemListContainer.addChild(new Div("Loading RSS Feed..."));
            itemListContainer.addChild(new Div("(For large feeds this can take a few seconds)"));

            let url = null;
            if (RssTypeHandler.USE_PROXY) {
                url = RssTypeHandler.CORS_PROXY + feedSrc;
            }
            else {
                url = S.util.getRemoteHost() + "/rssProxy?url=" + encodeURIComponent(feedSrc);
            }

            parser.parseURL(url, (err, feed) => {
                if (!feed) {
                    // new MessageDlg(err.message || "RSS Feed failed to load.", "Warning", null, null, false, 0, state).open();
                    // console.log(err.message || "RSS Feed failed to load.");
                    dispatch({
                        type: "Action_RSSUpdated",
                        state,
                        update: (s: AppState): void => {
                            s.failedFeedCache[feedSrc] = "true";
                        }
                    });
                }
                else {
                    dispatch({
                        type: "Action_RSSUpdated",
                        state,
                        update: (s: AppState): void => {
                            s.feedCache[feedSrc] = feed;
                        }
                    });
                }
            });
        }

        return itemListContainer;
    }

    renderItem(feed: any, feedSrc: string, itemListContainer: Comp, state: AppState) {
        // Current approach is to put the feed title in the parent node so we don't need it rendered
        // here also
        let feedOut: Comp[] = [];

        let description = feed.description || "";
        let pubDate = feed.pubDate || "";

        feedOut.push(new Para(description + "  " + pubDate));
        feedOut.push(new Para("Feed: " + feedSrc));

        if (feed.itunes && feed.itunes.image) {
            feedOut.push(new Img(null, {
                style: {
                    maxWidth: "100%",
                    marginBottom: "20px"
                },
                src: feed.itunes.image
            }));
        }

        let feedOutDiv = new Div(null, null, feedOut);
        itemListContainer.getChildren().push(feedOutDiv);

        let itemCount = 0;
        feed.items.forEach(function (item) {
            if (itemCount < RssTypeHandler.MAX_FEED_ITEMS) {
                itemListContainer.getChildren().push(this.buildFeedItem(item, state));
            }
            itemCount++;
        }, this);
    }

    buildFeedItem(entry, state: AppState): Comp {
        let children: Comp[] = [];
        children.push(new Anchor(entry.link, entry.title, {
            style: { fontSize: "25px" },
            target: "_blank"
        }));

        if (entry.enclosure && entry.enclosure.url && entry.enclosure.type &&
            entry.enclosure.type.indexOf("audio/") !== -1) {
            let audioButton = new Button("Play Audio", //
                () => {
                    new AudioPlayerDlg(entry.enclosure.url, state).open();
                });
            children.push(new Div(null, {
                style: {
                    paddingBottom: "10px"
                }
            }, [new ButtonBar([audioButton])]));
        }

        // item += "CONTENT:ENCODED"+entry["content:encoded"];
        if (entry["content:encoded"]) {
            let contentDiv = new MarkdownDiv(entry["content:encoded"]);
            children.push(contentDiv);
        }
        else if (entry.contentSnippet) {
            let contentDiv = new MarkdownDiv(entry.contentSnippet);
            children.push(contentDiv);
        }

        return new Div(null, {
            style: {
                borderBottom: "1px solid gray",
                paddingBottom: "10px",
                paddingTop: "10px"
            }
        }, children);
    }

    /* This will process all the images loaded by the RSS Feed content to make sure they're all 300px in side because
    otherwise we get rediculously large images */
    getDomPreUpdateFunction(parent: CompIntf): void {
        S.util.forEachElmBySel("#" + parent.getId() + " .rss-feed-listing img", (el, i) => {
            el.style.maxWidth = "300px";
            el.style.width = "300px";
        });
    }
}

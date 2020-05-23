import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import * as RssParser from 'rss-parser';
import { Div } from "../widget/Div";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { MessageDlg } from "../dlg/MessageDlg";
import { TextContent } from "../widget/TextContent";
import { Heading } from "../widget/Heading";
import { Para } from "../widget/Para";
import { Img } from "../widget/Img";
import { Anchor } from "../widget/Anchor";
import { ButtonBar } from "../widget/ButtonBar";
import { MarkdownDiv } from "../widget/MarkdownDiv";
import { AppState } from "../AppState";
import { dispatch } from "../AppRedux";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RssTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.RSS_FEED, "RSS Feed", "fa-rss");
    }

    allowPropertyEdit(propName: string): boolean {
        if (propName == J.NodeProp.RSS_FEED_SRC) {
            return true;
        }
        return false;
    }

    render(node: J.NodeInfo, rowStyling: boolean, state: AppState): Comp {

        let feedSrc: string = S.props.getNodePropVal(J.NodeProp.RSS_FEED_SRC, node);
        if (!feedSrc) {
            return (new TextContent("You need to set the '"+J.NodeProp.RSS_FEED_SRC+"' property of this node to the url of the RSS feed."));
        }

        let content = node.content;

        //ret += new Div("Feed Source: " + src);
        let itemListContainer: Div = new Div("", { className: "rss-feed-listing" }, [
            new Heading(3, content)
        ]);

        let parser = new RssParser();
        // Note: some RSS feeds can't be loaded in the browser due to CORS security.
        // To get around this, you can use a proxy. (todo-1: need to eliminate this proxy)

        //if we find the RSS feed in the cache, use it.
        //disabling cache for now: somehow the "Play Button" never works (onClick not wired) whenever it renders from the cache and i haven't had time to 
        //figure this out yet.
        if (state.feedCache[feedSrc]) {
            this.renderItem(state.feedCache[feedSrc], feedSrc, itemListContainer, state);
        }
        //otherwise read from the internet
        else {
            itemListContainer.addChild(new Div("Loading RSS Feed..."));

            parser.parseURL(feedSrc, (err, feed) => {
                if (!feed) {
                    new MessageDlg(err.message || "RSS Feed failed to load.", "Warning", null, null, false, 0, state).open();
                }
                else {
                    dispatch({
                        type: "Action_RSSUpdated", state,
                        update: (s: AppState): void => {
                            s.feedCache[feedSrc] = feed;
                        },
                    });
                }
            });
        }

        return itemListContainer;
    }

    renderItem(feed: any, feedSrc: string, itemListContainer: Comp, state: AppState) {
        //Current approach is to put the feed title in the parent node so we don't need it rendered
        //here also
        let feedOut: Comp[] = []; //tag("h2", {}, feed.title);

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
        itemListContainer.children.push(feedOutDiv);

        feed.items.forEach(function(item) {
            itemListContainer.children.push(this.buildFeedItem(item, state));
        }, this);
    }

    buildFeedItem(entry, state: AppState): Comp {
        let children: Comp[] = [];
        children.push(new Anchor(entry.link, entry.title, {
            style: { fontSize: "25px" },
            "target": "_blank"
        }));

        if (entry.enclosure && entry.enclosure.url && entry.enclosure.type &&
            entry.enclosure.type.indexOf("audio/") != -1) {
            let audioButton = new Button("Play Audio", //
                () => {
                    S.podcast.openPlayerDialog(entry.enclosure.url, entry.title, state);
                });
            children.push(new Div(null, {
                style: {
                    paddingBottom: "10px"
                }
            }, [new ButtonBar([audioButton])]));
        }

        //item += "CONTENT:ENCODED"+entry["content:encoded"];
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
}

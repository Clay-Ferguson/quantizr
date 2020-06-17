import * as J from "../JavaIntf";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import * as RssParser from 'rss-parser';
import { Div } from "../widget/Div";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
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
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RssTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.RSS_FEED, "RSS Feed", "fa-rss", true);
    }

    getCustomProperties(): string[] {
        return [J.NodeProp.RSS_FEED_SRC,
            //content isn't a 'property' in the 'properties' array, but is a prop ON SubNode.java, so we don't have a J.NodeProp for it.    
            "content"];
    }

    allowPropertyEdit(propName: string): boolean {
        return true;
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
        // Note: some RSS feeds can't be loaded in the browser due to CORS security.
        // To get around this, you can use a proxy. (todo-1: need to eliminate this proxy)

        //if we find the RSS feed in the cache, use it.
        //disabling cache for now: somehow the "Play Button" never works (onClick not wired) whenever it renders from the cache and i haven't had time to 
        //figure this out yet.
        if (state.failedFeedCache[feedSrc]) {
            return new Div("Feed Failed: " + feedSrc, {
                className: "marginAll"
            });
        }
        else if (state.feedCache[feedSrc]) {
            this.renderItem(state.feedCache[feedSrc], feedSrc, itemListContainer, state);
        }
        //otherwise read from the internet
        else {
            itemListContainer.addChild(new Div("Loading RSS Feed..."));

            //The 'rss-parser' doc suggested herokuapp, but I don't know if I can write my own service or use some better one?
            const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";

            parser.parseURL(CORS_PROXY + feedSrc, (err, feed) => {
                if (!feed) {
                    //new MessageDlg(err.message || "RSS Feed failed to load.", "Warning", null, null, false, 0, state).open();
                    //console.log(err.message || "RSS Feed failed to load.");
                    dispatch({
                        type: "Action_RSSUpdated", state,
                        update: (s: AppState): void => {
                            s.failedFeedCache[feedSrc] = "true";
                        },
                    });
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
        itemListContainer.getChildren().push(feedOutDiv);

        let itemCount = 0;
        feed.items.forEach(function (item) {

            //only process the first 50 items. todo-1: at some point we can make this a user option.
            //todo-0: test this out on joerogan's podcast
            if (itemCount < 50) {
                itemListContainer.getChildren().push(this.buildFeedItem(item, state));
            }
            itemCount++;
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

    /* This will process all the images loaded by the RSS Feed content to make sure they're all 300px in side because
    otherwise we get rediculously large images */
    getDomPreUpdateFunction(parent: CompIntf): void {
        S.util.forEachElmBySel("#" + parent.getId() + " .rss-feed-listing img", (el, i) => {
            el.style.maxWidth = "300px";
            el.style.width = "300px";
        });
    }
}

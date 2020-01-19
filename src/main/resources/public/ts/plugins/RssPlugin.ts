import * as I from "../Interfaces";
import { RssPluginIntf } from "../intf/RssPluginIntf";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import * as RssParser from 'rss-parser';
import { Div } from "../widget/Div";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { MessageDlg } from "../dlg/MessageDlg";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { TextContent } from "../widget/TextContent";
import { Heading } from "../widget/Heading";
import { ProgressDlg } from "../dlg/ProgressDlg";
import { Para } from "../widget/Para";
import { Img } from "../widget/Img";
import { Anchor } from "../widget/Anchor";
import { ButtonBar } from "../widget/ButtonBar";
import { MarkdownDiv } from "../widget/MarkdownDiv";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

class RssTypeHandler implements TypeHandlerIntf {
    constructor(private rssPlugin: RssPlugin) {
    }

    render = (node: I.NodeInfo, rowStyling: boolean): Comp => {
        return this.rssPlugin.renderFeedNode(node, rowStyling);
    }

    orderProps(node: I.NodeInfo, _props: I.PropertyInfo[]): I.PropertyInfo[] {
        return _props;
    }

    getIconClass(node: I.NodeInfo): string {
        return null;
    }

    allowAction(action: string): boolean {
        return true;
    }
}

export class RssPlugin implements RssPluginIntf {

    //map of feeds by URL, so that we only read once until user forces browser refresh.
    feedCache = {};

    //another service like this is:
    //XML Retrieve URL - https://cors.now.sh/https://example.com/rss-xml-link

    CORS_PROXY = "https://cors-anywhere.herokuapp.com/";

    rssTypeHandler: TypeHandlerIntf = new RssTypeHandler(this);

    init = () => {
        S.meta64.addTypeHandler("sn:rssfeed", this.rssTypeHandler);
    }

    renderFeedNode = (node: I.NodeInfo, rowStyling: boolean): Comp => {

        let feedSrc: string = S.props.getNodePropertyVal("sn:rssFeedSrc", node);
        if (!feedSrc) {
            return (new TextContent("You need to set the 'sn:rssFeedSrc' property of this node to the url of the RSS feed."));
        }

        let content = node.content;

        //ret += new Div("Feed Source: " + src);
        let itemListContainer = new Div("", { className: "rss-feed-listing" }, [
            new Heading(3, content)
        ]);

        let parser = new RssParser();
        // Note: some RSS feeds can't be loaded in the browser due to CORS security.
        // To get around this, you can use a proxy. (todo-1: need to eliminate this proxy)

        //if we find the RSS feed in the cache, use it.
        //disabling cache for now: somehow the "Play Button" never works (onClick not wired) whenever it renders from the cache and i haven't had time to 
        //figure this out yet.
        if (this.feedCache[feedSrc]) {

            /* Somehow the 'onClick' event is not getting wired properly without this async timeout here, i guess because
            we need the container to be rendered before we make this call, but this was a guess and i'm not fully sure why it doesn't
            work without this timeout */
            setTimeout(() => {
                this.renderItem(this.feedCache[feedSrc], feedSrc, itemListContainer);
            }, 1000);
        }
        //otherwise read from the internet
        else {
            let pgrsDlg = new ProgressDlg();
            pgrsDlg.open();

            //todo-1: to avoid performance issues i'll just allow only 100 items to load for now but this
            //should be somehow controlled by the user (they may want to wait for the full list)
            parser.parseURL(this.CORS_PROXY + feedSrc, (err, feed) => {
                pgrsDlg.close();
                if (!feed) {
                    if (err.message) {
                        new MessageDlg(
                            err.message + "<br>Note: you may need '?format=xml' added to the url ?", "Message"
                        ).open();
                    }

                    //fallback to using our simlified version of a feed reader:
                    // S.rssReader.readFeed(this.CORS_PROXY + feedSrc, (err, feed) => {
                    // });
                }
                else {
                    this.feedCache[feedSrc] = feed;
                    this.renderItem(feed, feedSrc, itemListContainer);
                }
            });
        }

        //This render will only attach an empty dom element, and then the async parseURL function above
        //is when the dom is actually populated.
        return itemListContainer;
    }

    renderItem = (feed: any, feedSrc: string, itemListContainer: Comp) => {
        //Current approach is to put the feed title in the parent node so we don't need it rendered
        //here also
        let feedOut: Comp[] = []; //tag("h2", {}, feed.title);

        let description = feed.description || "";
        let pubDate = feed.pubDate || "";

        feedOut.push(new Para(description + "  " + pubDate));
        feedOut.push(new Para("Feed: " + feedSrc));

        if (feed.itunes && feed.itunes.image) {
            feedOut.push(new Img({
                style: {
                    maxWidth: "100%",
                    marginBottom: "20px"
                },
                src: feed.itunes.image
            }));
        }

        let feedOutDiv = new Div(null, null, feedOut);
        itemListContainer.children.push(feedOutDiv);

        feed.items.forEach((item) => {
            itemListContainer.children.push(this.buildFeedItem(item));
        });

        itemListContainer.updateDOM();
    }

    buildFeedItem = (entry): Comp => {
        let children: Comp[] = [];
        children.push(new Anchor(entry.link, entry.title, {
            style: { fontSize: "25px" },
            "target": "_blank"
        }));

        if (entry.enclosure && entry.enclosure.url && entry.enclosure.type &&
            entry.enclosure.type.indexOf("audio/") != -1) {
            let audioButton = new Button("Play Audio", //
                () => {
                    S.podcast.openPlayerDialog(entry.enclosure.url, entry.title);
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


import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { Icon } from "../widget/Icon";
import { Img } from "../widget/Img";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class OpenGraphPanel extends Div {
    loading: boolean;

    constructor(private appState: AppState, key: string, private url: string) {
        super(null, {
            title: url,
            key
        });
        this.domAddEvent = this.domAddEvent.bind(this);

        /* The state should always contain loading==true (if currently querying the server) or a non-null 'og'. A completed but failed
         pull of the open graph data should result in og being an empty object and not null. */
        let og = S.meta64.openGraphData.get(url);
        if (og) {
            this.mergeState({ og });
        }
    }

    domAddEvent(): void {
        let elm: HTMLElement = this.getRef();
        if (!elm || !elm.isConnected || this.getState().og) return;
        let og = S.meta64.openGraphData.get(this.url);
        if (!og) {
            let observer = new IntersectionObserver(entries => {
                entries.forEach((entry: any) => {
                    if (entry.isIntersecting) {
                        let og = S.meta64.openGraphData.get(this.url);
                        if (!og) {
                            if (!this.loading) {
                                this.loading = true;
                                S.util.loadOpenGraph(this.url, (og: any) => {
                                    this.loading = false;
                                    if (!og) {
                                        og = {};
                                    }
                                    S.meta64.openGraphData.set(this.url, og);
                                    if (!elm.isConnected) return;
                                    this.mergeState({ og });
                                });
                            }
                        }
                        else {
                            this.mergeState({ og });
                        }
                        this.loadNext();
                    }
                });
            });
            observer.observe(elm.parentElement);
        }
        else {
            this.mergeState({ og });
        }
        super.domAddEvent();
    }

    /* This loads the next upcomming OpenGraph assuming the user is scrolling down */
    loadNext = (): void => {
        let found = false;
        let count = 0;
        S.meta64.openGraphComps.forEach(o => {
            if (found) {
                /* I think it's counterproductive for smooth scrolling to preload more than one */
                if (count++ < 1) {
                    let og = S.meta64.openGraphData.get(o.url);
                    if (!og) {
                        if (!o.loading) {
                            o.loading = true;
                            S.util.loadOpenGraph(o.url, (og: any) => {
                                o.loading = false;
                                if (!og) {
                                    og = {};
                                }
                                S.meta64.openGraphData.set(o.url, og);
                                if (!o.getRef()) return;
                                o.mergeState({ og });
                            });
                        }
                    }
                    else {
                        o.mergeState({ og });
                    }
                }
            }
            else if (o.getId() === this.getId()) {
                found = true;
            }
        });
    }

    preRender(): void {
        let state = this.getState();
        if (state.loading || !state.og) {
            this.setChildren(null);
            return;
        }
        let o: any = state.og;
        let title = o.ogTitle || o.twitterTitle;
        let desc = o.ogDecsciption || o.twitterDescription;
        let image = o.ogImage || o.twitterImage;

        /* If neither a description nor image exists, this will not be interesting enough so don't render */
        if (!desc && !image) {
            this.setChildren(null);
            return null;
        }

        if (!o.ogUrl) {
            o.ogUrl = this.url;
        }

        let bookmarkIcon = o.ogUrl && !this.appState.isAnonUser ? new Icon({
            className: "fa fa-bookmark fa-lg ogBookmarkIcon float-right",
            title: "Bookmark this RSS entry",
            onClick: () => {
                S.edit.addLinkBookmark(o.ogUrl, null);
            }
        }) : null;

        if (desc?.length > 800) {
            desc = desc.substring(0, 800) + "...";
        }

        let imgAndDesc: CompIntf = null;
        if (image?.url) {
            // if mobile portrait mode render image above (not beside) description
            if (this.appState.mobileMode && window.innerWidth < window.innerHeight) {
                imgAndDesc = new Div(null, null, [
                    new Img(null, {
                        className: "openGraphImageVert",
                        src: image.url
                    }),
                    new Div(desc)
                ]);
            }
            else {
                // if we have an image then render a left-hand side and right-hand side.
                imgAndDesc = new HorizontalLayout([
                    new Div(null, { className: "openGraphLhs" }, [
                        new Img(null, {
                            className: "openGraphImage",
                            src: image.url
                        })
                    ]),
                    new Div(null, { className: "openGraphRhs" }, [
                        new Div(desc)
                    ])
                ], "displayTableNoSpacing");
            }
        }
        // if no image just display the description in a div
        else {
            imgAndDesc = new Div(null, { className: "openGraphNoImage" }, [
                new Div(desc)
            ]);
        }

        this.attribs.className = "openGraphPanel";
        this.setChildren([
            bookmarkIcon,
            o.ogUrl ? new Anchor(o.ogUrl, title, {
                target: "_blank",
                className: "openGraphTitle"
            }) : new Div(title, {
                className: "openGraphTitle"
            }),
            imgAndDesc
        ]);
    }
}

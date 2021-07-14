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
import * as J from "../JavaIntf";

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
        let og: J.OpenGraph = S.meta64.openGraphData.get(url);
        if (og) {
            this.mergeState({ og });
        }
    }

    domAddEvent(): void {
        let elm: HTMLElement = this.getRef();
        if (!elm || !elm.isConnected || this.getState().og) return;
        let og: J.OpenGraph = S.meta64.openGraphData.get(this.url);
        if (!og) {
            let observer = new IntersectionObserver(entries => {
                entries.forEach((entry: any) => {
                    if (entry.isIntersecting) {
                        let og: J.OpenGraph = S.meta64.openGraphData.get(this.url);
                        if (!og) {
                            if (!this.loading) {
                                this.loading = true;
                                S.util.loadOpenGraph(this.url, (og: J.OpenGraph) => {
                                    this.loading = false;
                                    if (!og) {
                                        og = {
                                            title: null,
                                            description: null,
                                            image: null
                                        };
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
                    let og: J.OpenGraph = S.meta64.openGraphData.get(o.url);
                    if (!og) {
                        if (!o.loading) {
                            o.loading = true;
                            S.util.loadOpenGraph(o.url, (og: J.OpenGraph) => {
                                o.loading = false;
                                if (!og) {
                                    og = {
                                        title: null,
                                        description: null,
                                        image: null
                                    };
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

        // all 4 of these variables can be removed. (todo-0)
        // also we have an "OpenGraph" type that should be used in TypeScript now (defined in Java)
        let o: any = state.og;
        let title = o.title;
        let desc = o.description;
        let image = o.image;

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
        if (image) {
            // if mobile portrait mode render image above (not beside) description
            if (this.appState.mobileMode && window.innerWidth < window.innerHeight) {
                imgAndDesc = new Div(null, null, [
                    new Img(null, {
                        className: "openGraphImageVert",
                        src: image
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
                            src: image
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

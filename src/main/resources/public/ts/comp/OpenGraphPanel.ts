import { AppState } from "../AppState";
import { Anchor } from "../comp/core/Anchor";
import { CompIntf } from "../comp/base/CompIntf";
import { Div } from "../comp/core/Div";
import { HorizontalLayout } from "./core/HorizontalLayout";
import { Icon } from "../comp/core/Icon";
import { Img } from "../comp/core/Img";
import * as J from "../JavaIntf";
import { S } from "../Singletons";

interface LS {
    og: J.OpenGraph;
    loading?: boolean;
}

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
        let og: J.OpenGraph = S.quanta.openGraphData.get(url);
        if (og) {
            this.mergeState<LS>({ og });
        }
    }

    domAddEvent(): void {
        let elm: HTMLElement = this.getRef();
        if (!elm || !elm.isConnected || this.getState<LS>().og) return;
        let og: J.OpenGraph = S.quanta.openGraphData.get(this.url);
        if (!og) {
            let observer = new IntersectionObserver(entries => {
                entries.forEach((entry: any) => {
                    if (entry.isIntersecting) {
                        let og: J.OpenGraph = S.quanta.openGraphData.get(this.url);
                        if (!og) {
                            if (!this.loading) {
                                this.loading = true;
                                S.util.loadOpenGraph(this.url, (og: J.OpenGraph) => {
                                    this.loading = false;
                                    if (!og) {
                                        og = {
                                            title: null,
                                            description: null,
                                            image: null,
                                            url: null
                                        };
                                    }
                                    // observer.disconnect();
                                    S.quanta.openGraphData.set(this.url, og);
                                    if (!elm.isConnected) return;
                                    this.mergeState<LS>({ og });
                                });
                            }
                        }
                        else {
                            this.mergeState<LS>({ og });
                        }
                        this.loadNext();
                    }
                });
            });
            observer.observe(elm.parentElement);
        }
        else {
            this.mergeState<LS>({ og });
        }
        super.domAddEvent();
    }

    /* This loads the next upcomming OpenGraph assuming the user is scrolling down */
    loadNext = (): void => {
        let found = false;
        let count = 0;
        S.quanta.openGraphComps.forEach(o => {
            if (found) {
                /* I think it's counterproductive for smooth scrolling to preload more than one */
                if (count++ < 1) {
                    let og: J.OpenGraph = S.quanta.openGraphData.get(o.url);
                    if (!og) {
                        if (!o.loading) {
                            o.loading = true;
                            S.util.loadOpenGraph(o.url, (og: J.OpenGraph) => {
                                o.loading = false;
                                if (!og) {
                                    og = {
                                        title: null,
                                        description: null,
                                        image: null,
                                        url: null
                                    };
                                }
                                S.quanta.openGraphData.set(o.url, og);
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
        let state = this.getState<LS>();
        if (state.loading || !state.og) {
            this.setChildren(null);
            return;
        }

        /* If neither a description nor image exists, this will not be interesting enough so don't render */
        if (!state.og.description && !state.og.image) {
            this.setChildren(null);
            return null;
        }

        if (!state.og.url) {
            state.og.url = this.url;
        }

        let bookmarkIcon = state.og.url && !this.appState.isAnonUser ? new Icon({
            className: "fa fa-bookmark fa-lg ogBookmarkIcon float-end",
            title: "Bookmark this RSS entry",
            onClick: () => {
                S.edit.addLinkBookmark(state.og.url, null);
            }
        }) : null;

        if (state.og?.description?.length > 804) {
            state.og.description = state.og.description.substring(0, 800) + "...";
        }

        let imgAndDesc: CompIntf = null;
        if (state.og.image) {
            // if mobile portrait mode render image above (not beside) description
            if (this.appState.mobileMode && window.innerWidth < window.innerHeight) {
                imgAndDesc = new Div(null, null, [
                    new Img(null, {
                        className: "openGraphImageVert",
                        src: state.og.image
                    }),
                    new Div(state.og.description)
                ]);
            }
            else {
                // if we have an image then render a left-hand side and right-hand side.
                imgAndDesc = new HorizontalLayout([
                    new Div(null, { className: "openGraphLhs" }, [
                        new Img(null, {
                            className: "openGraphImage",
                            src: state.og.image
                        })
                    ]),
                    new Div(null, { className: "openGraphRhs" }, [
                        new Div(state.og.description)
                    ])
                ], "displayTableNoSpacing");
            }
        }
        // if no image just display the description in a div
        else {
            imgAndDesc = new Div(null, { className: "openGraphNoImage" }, [
                new Div(state.og.description)
            ]);
        }

        this.attribs.className = "openGraphPanel";
        this.setChildren([
            bookmarkIcon,
            state.og.url ? new Anchor(state.og.url, state.og.title, {
                target: "_blank",
                className: "openGraphTitle"
            }) : new Div(state.og.title, {
                className: "openGraphTitle"
            }),
            imgAndDesc
        ]);
    }
}

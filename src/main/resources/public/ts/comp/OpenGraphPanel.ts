import { AppState } from "../AppState";
import { Anchor } from "../comp/core/Anchor";
import { CompIntf } from "../comp/base/CompIntf";
import { Div } from "../comp/core/Div";
import { HorizontalLayout } from "./core/HorizontalLayout";
import { Icon } from "../comp/core/Icon";
import { Img } from "../comp/core/Img";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TabIntf } from "../intf/TabIntf";
import { Html } from "./core/Html";

interface LS { // Local State
    og: J.OpenGraph;
    loading?: boolean;
}

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class OpenGraphPanel extends Div {
    loading: boolean;

    constructor(private appState: AppState, private tabData: TabIntf<any>, key: string, private url: string, private wrapperClass: string,
        private imageClass: string, private showTitle: boolean, private allowBookmarkIcon: boolean, private includeImage: boolean) {
        super(null, {
            title: url,
            key
        });

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

    /* This loads the next upcomming OpenGraph assuming the user is scrolling down. This is purely a
    performance optimization to help the user experience and is not a core part of the logic for
     'correct' functioning */
    loadNext = (): void => {
        let found = false;
        let count = 0;
        if (!this.tabData) return;

        this.tabData.openGraphComps.forEach(o => {
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

        let bookmarkIcon = this.allowBookmarkIcon && state.og.url && !this.appState.isAnonUser ? new Icon({
            className: "fa fa-bookmark fa-lg ogBookmarkIcon float-end",
            onClick: () => {
                S.edit.addLinkBookmark(state.og.url, null, null);
            }
        }) : null;

        if (state.og?.description?.length > 804) {
            state.og.description = state.og.description.substring(0, 800) + "...";
        }

        let imgAndDesc: CompIntf = null;
        if (state.og.image && this.includeImage) {
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
                if (state?.og?.image) {
                    // According to my test results this can cause a scrolling glitch, where the browser throws an error and somehow
                    // apparently that interfered wit rendering. Wasn't able to repro on localhost because of using http I think, so
                    // this code is probably harmless even if I'm making a mistake blaming the scrolling glitch on this.
                    state.og.image = S.util.replaceAll(state.og.image, "http://", "https://");
                }
                // if we have an image then render a left-hand side and right-hand side.
                imgAndDesc = new HorizontalLayout([
                    new Div(null, { className: "openGraphLhs" }, [
                        new Img(null, {
                            // warning: this class is referenced other places in the code, you must chagne both if you chagne one.
                            className: this.imageClass,
                            src: state.og.image
                        })
                    ]),
                    new Div(null, { className: "openGraphRhs" }, [
                        new Html(state.og.description, { className: "openGraphDesc" })
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

        this.attribs.className = this.wrapperClass;
        this.setChildren([
            bookmarkIcon,
            this.showTitle ? (state.og.url ? new Anchor(state.og.url, state.og.title, {
                target: "_blank",
                className: "openGraphTitle"
            }) : new Div(state.og.title, {
                className: "openGraphTitle"
            })) : null,
            imgAndDesc
        ]);
    }
}

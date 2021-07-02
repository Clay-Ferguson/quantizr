import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
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

    constructor(key: string, private url: string) {
        super(null, {
            title: url,
            key
        });
        this.domAddEvent = this.domAddEvent.bind(this);

        let og = S.meta64.openGraphData.get(url);
        this.mergeState({ og });
    }

    domAddEvent(): void {
        let elm: HTMLElement = this.getRef();
        if (!elm || !elm.isConnected) return;
        let og = S.meta64.openGraphData.get(this.url);
        if (!og) {
            let observer = new IntersectionObserver(entries => {
                entries.forEach((entry: any) => {
                    if (entry.isIntersecting) {
                        let og = S.meta64.openGraphData.get(this.url);
                        if (!og) {
                            // set a value so we know we can't re-enter into here again.
                            S.meta64.openGraphData.set(this.url, {});

                            // wait 2 seconds before showing the loading indicator.
                            // setTimeout(() => {
                            //     if (!elm.isConnected) return;

                            //     let og = S.meta64.openGraphData.get(this.url);
                            //     if (!og) {
                            //         this.mergeState({ loading: true });
                            //     }
                            // }, 2000);

                            S.util.loadOpenGraph(this.url, (og: any) => {
                                S.meta64.openGraphData.set(this.url, og || {});
                                if (!elm.isConnected) return;
                                this.mergeState({ loading: false, og });
                            });
                            this.loadNext();
                        }
                        else {
                            this.mergeState({ loading: false, og });
                        }
                    }
                });
            });
            observer.observe(elm.parentElement);
        }
        else {
            this.mergeState({ loading: false, og });
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
                        // set a value so we know we can't re-enter into here again.
                        S.meta64.openGraphData.set(o.url, {});

                        // console.log("nextup: " + o.url);
                        S.util.loadOpenGraph(o.url, (og: any) => {
                            S.meta64.openGraphData.set(o.url, og || {});
                            if (!o.getRef()) return;
                            o.mergeState({ loading: false, og });
                        });
                    }
                    else {
                        o.mergeState({ loading: false, og });
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
        // if (state.loading) {
        //     this.setChildren([
        //         // This spinner works fine, but I decided after using it, it's a better user experience to just not
        //         // even indicate to the user that a link is attempting to have it's OpenGraph displayed. Just let it popup
        //         // if ready, but if not the user sees a nice clean page regardlessl.
        //         // new Div(null, {
        //         //     className: "progressSpinner"
        //         // }, [new Spinner()])
        //     ]);
        //     return;
        // }
        let o: any = state.og;
        if (!o) {
            this.setChildren(null);
            return;
        };
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

        let bookmarkIcon = o.ogUrl && !state.isAnonUser ? new Icon({
            className: "fa fa-bookmark fa-lg ogBookmarkIcon float-right",
            title: "Bookmark this RSS entry",
            onClick: () => {
                S.edit.addLinkBookmark(o.ogUrl, null);
            }
        }) : null;

        if (desc?.length > 800) {
            desc = desc.substring(0, 800) + "...";
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
            new HorizontalLayout([
                new Div(null, { className: "openGraphLhs" }, [
                    image?.url ? new Img(null, {
                        className: "openGraphImage",
                        src: image.url
                    }) : null
                ]),
                new Div(null, { className: "openGraphRhs" }, [
                    new Div(desc)
                ])
            ])
        ]);
    }
}

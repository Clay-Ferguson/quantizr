import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { Div } from "../widget/Div";
import { Img } from "../widget/Img";
import { Spinner } from "../widget/Spinner";

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

        let og = S.meta64.openGraphData.get(url);
        this.mergeState({ og });
    }

    onAddEvent = (): void => {
        // the current ref needs to be passed in from the base as an arg here (todo-0)
        if (!this.attribs.ref || !this.attribs.ref.current) {
            return;
        }
        let elm = this.attribs.ref.current;

        let og = S.meta64.openGraphData.get(this.url);
        if (!og) {
            let observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    let og = S.meta64.openGraphData.get(this.url);
                    if (!og) {
                        this.mergeState({ loading: true });
                        S.util.loadOpenGraph(this.url, (og: any) => {
                            S.meta64.openGraphData.set(this.url, og || {});
                            this.mergeState({ loading: false, og });
                        });
                    }
                }
            },
            // todo-0: threshold may be better as non-zero ?
            { threshold: [0] });
            observer.observe(elm);
        }
    }

    preRender(): void {
        let state = this.getState();
        if (state.loading) {
            this.setChildren([
                new Div(null, {
                    className: "progressSpinner"
                }, [new Spinner()])
            ]);
            return;
        }
        let o: any = state.og;
        if (!o) {
            this.setChildren([]);
            return;
        };
        let title = o.ogTitle || o.twitterTitle;
        let desc = o.ogDecsciption || o.twitterDescription;
        let image = o.ogImage || o.twitterImage;

        /* If neither a description nor image exists, this will not be interesting enough so don't render */
        if (!desc && !image) {
            this.setChildren([]);
            return null;
        }

        if (!o.ogUrl) {
            o.ogUrl = this.url;
        }

        // todo-1: need to detect when there's an image width specified (image.width?) that is
        // less than what is in openGraphImage, and then use that with
        this.attribs.className = "openGraphPanel";
        this.setChildren([
            o.ogUrl ? new Anchor(o.ogUrl, title, {
                target: "_blank",
                className: "openGraphTitle"
            }) : new Div(title, {
                className: "openGraphTitle"
            }),
            new Div(desc),
            image && image.url ? new Img(null, {
                className: "openGraphImage",
                src: image.url
            }) : null
        ]);
    }
}

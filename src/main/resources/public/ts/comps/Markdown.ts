import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Html } from "../widget/Html";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class Markdown extends Html {

    constructor(private text: string) {
        super(S.util.markdown(text), null, null);
        this.attribs.className = "markdown-content";
    }
}

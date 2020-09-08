import { Div } from "./Div";

// let S: Singletons;
// PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
//     S = ctx;
// });

//note: class not in use yet
export class DlgContainer extends Div {

    constructor(attribs: Object = {}) {
        super(null, attribs);
    }

    preRender(): void {
        this.setChildren([
            new Div("This is a test")
        ]);
    }
}

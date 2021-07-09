import { Constants as C } from "../Constants";
import { NodeHistoryItem } from "../NodeHistoryItem";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class HistoryPanel extends Div {
    constructor() {
        super(null, {
            id: C.ID_RHS + "_hist",
            className: "nodeHistoryPanel"
        });
    }

    preRender(): void {
        let children = [];
        children.push(new Div("History", { className: "nodeHistoryTitle" }));
        S.meta64.nodeHistory.forEach((h: NodeHistoryItem) => {
            let d;
            children.push(d = new Div("&#x1f535 " + h.content, {
                id: h.id + "_hist",
                nid: h.id,
                onClick: this.jumpToId,
                className: "nodeHistoryItem"
            }));
            d.renderRawHtml = true;
        });

        this.setChildren(children && children.length > 0 ? children : null);
    }

    /* We use the standard trick of storing the ID on the dom so we can avoid unnecessary function scopes */
    jumpToId = (evt: any): void => {
        let id = S.util.getPropFromDom(evt, "nid");
        S.view.jumpToId(id);
    }
}

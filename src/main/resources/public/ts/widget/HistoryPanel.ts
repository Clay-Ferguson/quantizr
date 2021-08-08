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
    private static MAX_SUBITEMS = 5;

    constructor() {
        super(null, {
            id: C.ID_RHS + "_hist",
            className: "nodeHistoryPanel"
        });
    }

    preRender(): void {
        if (S.quanta.nodeHistory.length === 0) {
            this.setChildren(null);
            return;
        }
        let children = [];
        children.push(new Div("History", { className: "nodeHistoryTitle" }));
        S.quanta.nodeHistory.forEach((h: NodeHistoryItem) => {
            if (!h.content) return;
            let d;
            children.push(d = new Div("&#x1f535 " + h.content, {
                id: h.id + "_hist",
                nid: h.id,
                onClick: this.jumpToId,
                className: "nodeHistoryItem"
            }));
            d.renderRawHtml = true;

            if (h.subItems) {
                let count = 0;
                let dotsShown = false;

                // we include topLevelId in the ids below so the React 'key' (same as id, by default) isn't
                // ever able to be duplilcated, because that throws a warning in React.
                let topLevelId = h.id;

                h.subItems.forEach((h: NodeHistoryItem) => {
                    if (!h.content || dotsShown) return;
                    if (count++ < HistoryPanel.MAX_SUBITEMS) {
                        let d;
                        children.push(d = new Div(h.content, {
                            id: topLevelId + "_" + h.id + "_subhist",
                            nid: h.id,
                            onClick: this.jumpToId,
                            className: "nodeHistorySubItem"
                        }));
                        d.renderRawHtml = true;
                    }
                    else {
                        if (!dotsShown) {
                            dotsShown = true;
                            children.push(new Div("...", {
                                id: topLevelId + "_" + h.id + "_subhist",
                                className: "nodeHistorySubItemDots"
                            }));
                        }
                    }
                });
            }
        });
        this.setChildren(children);
    }

    /* We use the standard trick of storing the ID on the dom so we can avoid unnecessary function scopes */
    jumpToId = (evt: any): void => {
        let id = S.util.getPropFromDom(evt, "nid");
        S.view.jumpToId(id);
    }
}

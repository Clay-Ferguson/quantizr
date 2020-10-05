import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Comp } from "./base/Comp";
import { Div } from "./Div";
import { Span } from "./Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class BreadcrumbsPanel extends Div {

    constructor() {
        super(null, {
            className: "breadcrumbPanel"
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);

        this.setChildren([
            this.createBreadcrumbs(state)
        ]);
    }

    createBreadcrumbs = (state: AppState): Comp => {
        if (!state.breadcrumbs || state.breadcrumbs.length === 0) return new Span("Loading...");

        let children = [];
        state.breadcrumbs.forEach(bc => {
            if (bc.id === state.homeNodeId) {
                // ignore root node. we don't need it.
            }
            else if (bc.id) {
                if (!bc.name) {
                    const typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(bc.type);
                    if (typeHandler) {
                        bc.name = typeHandler.getName();
                    }
                    else {
                        bc.name = "???";
                    }
                }

                children.push(new Span(bc.name, {
                    onClick: () => { S.view.refreshTree(bc.id, true, bc.id, false, false, true, true, state); },
                    className: "breadcrumbItem"
                }));
            }
            else {
                children.push(new Span("...", { className: "marginRight" }));
            }
        });

        return new Div(null, null, children);
    }
}

import { useAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { Icon } from "./core/Icon";

export class BreadcrumbsPanel extends Div {
    constructor() {
        super(null, {
            className: "breadcrumbPanel"
        });
    }

    preRender(): void {
        let state = useAppState();
        this.setChildren([this.createBreadcrumbs(state)]);
    }

    createBreadcrumbs = (state: AppState): Comp => {
        let children = [];

        if (state.breadcrumbs?.length > 0) {
            children = state.breadcrumbs.map(bc => {
                if (bc.id === state.node.id) {
                    // ignore root node or page root node. we don't need it.
                    return null;
                }
                else if (bc.id) {
                    if (!bc.name) {
                        const typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(bc.type);
                        bc.name = typeHandler ? typeHandler.getName() : "???";
                    }

                    return new Span(S.util.removeHtmlTags(bc.name), {
                        onClick: () => S.view.jumpToId(bc.id),
                        className: "breadcrumbItem"
                    });
                }
                else {
                    return new Span("...", { className: "marginRight" });
                }
            }).filter(c => !!c);
        }

        if (children.length > 0 && !state.userPreferences.showParents) {
            children.push(new Icon({
                className: "fa fa-level-down fa-lg showParentsIcon",
                title: "Toggle: Show Parent on page",
                onClick: () => S.edit.toggleShowParents(state)
            }));
        }

        return new Div(null, null, children);
    }
}

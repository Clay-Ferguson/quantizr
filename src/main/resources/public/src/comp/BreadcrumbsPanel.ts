import { getAs } from "../AppContext";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { Comp } from "./base/Comp";

export class BreadcrumbsPanel extends Div {
    constructor(public breadcrumbs: J.BreadcrumbInfo[]) {
        super(null, {
            className: "breadcrumbPanel"
        });
    }

    override preRender = (): boolean => {
        this.children = [this.createBreadcrumbs()];
        return true;
    }

    createBreadcrumbs = (): Comp => {
        let children: Comp[] = [];

        const ast = getAs();
        if (this.breadcrumbs?.length > 0) {
            children = this.breadcrumbs.map(bc => {
                if (bc.id === ast.node.id) {
                    // ignore root node or page root node. we don't need it.
                    return null;
                }
                else if (bc.id) {
                    if (!bc.name) {
                        const type = S.plugin.getType(bc.type);
                        bc.name = type ? type.getName() : "???";
                    }

                    const span = new Span(S.util.removeHtmlTags(bc.name), {
                        onClick: () => S.view.jumpToId(bc.id),
                        className: "breadcrumbItem"
                    });

                    if (!ast.mobileMode) {
                        S.domUtil.makeDropTarget(span.attribs, bc.id);
                    }
                    return span;
                }
                else {
                    return new Span("...", { className: "breadcrumbElipsis" });
                }
            }).filter(c => !!c);
        }

        return new Div(null, null, children);
    }
}

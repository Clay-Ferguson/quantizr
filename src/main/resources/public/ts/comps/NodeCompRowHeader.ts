import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "../widget/Div";
import { Comp } from "../widget/base/Comp";
import { ReactNode } from "react";
import { Span } from "../widget/Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompRowHeader extends Div {

    constructor(private node: J.NodeInfo) {
        super(null, {
            className: "header-text"
        });
    }

    build = (): void => {
        let node = this.node;
        let children = [];

        let priority = S.props.getNodePropVal(J.NodeProp.PRIORITY, node);
        priority = (priority && priority != "0") ? " P" + priority : "";

        if (node.name) {
            children.push(new Div("Name: " + node.name));
        }

        children.push(new Div(
            "ID:" + node.id + " " + //
            ((node.logicalOrdinal != -1) ? ("[" + node.logicalOrdinal + "] ") : "") + //
            "Type:" + node.type + //
            (node.lastModified ? " (Mod: " + S.util.formatDate(new Date(node.lastModified)) + ")" : "") + //
            priority));

        if (node.owner && node.owner != "?") {
            let clazz: string = (node.owner === S.meta64.userName) ? "created-by-me" : "created-by-other";
            children.push(new Span("Created By: " + node.owner, {
                className: clazz
            }));
        }

        this.setChildren(children);
    }

    super_CompRender: any = this.compRender;
    compRender = (): ReactNode => {
        this.build();
        return this.super_CompRender();
    }
}

import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { ReactNode } from "react";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { NodeCompRowHeader } from "./NodeCompRowHeader";
import { NodeCompMarkdown } from "./NodeCompMarkdown";
import { NodeCompBinary } from "./NodeCompBinary";
import { Div } from "../widget/Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompContent extends Comp {

    comp: Comp = null;

    constructor(public node: J.NodeInfo, public rowStyling: boolean, public showHeader: boolean, public idPrefix = "") {
        super();
        this.comp = this.build();
    }

    build = (): Comp => {
        let node = this.node;
        let ret: Comp[] = [];
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);

        /* todo-2: enable headerText when appropriate here */
        if (S.meta64.showMetaData) {
            if (this.showHeader) {
                ret.push(new NodeCompRowHeader(node));
            }
        }

        if (S.meta64.showProperties) {
            let propTable = S.props.renderProperties(node.properties);
            if (propTable) {
                ret.push(propTable);
            }
        } else {
            let renderComplete: boolean = false;

            /*
             * Special Rendering for Nodes that have a plugin-renderer
             */
            if (typeHandler) {
                renderComplete = true;
                ret.push(typeHandler.render(node, this.rowStyling));
            }

            if (!renderComplete) {
                let retState: any = {};
                retState.renderComplete = renderComplete;
                ret.push(new NodeCompMarkdown(node, retState));
                renderComplete = retState.renderComplete;
            }

            if (!renderComplete) {
                let properties = S.props.renderProperties(node.properties);
                if (properties) {
                    ret.push(properties);
                }
            }
        }

        /* if node owner matches node id this is someone's account root node, so what we're doing here is not
        showing the normal attachment for this node, because that will the same as the avatar */
        let isAnAccountNode = node.ownerId && node.id == node.ownerId;

        if (S.props.hasBinary(node) && !isAnAccountNode) {
            let binary = new NodeCompBinary(node);

            //todo-0: bring this back. I already needed it again.
            /*
             * We append the binary image or resource link either at the end of the text or at the location where
             * the user has put {{insert-attachment}} if they are using that to make the image appear in a specific
             * location in the content text.
             *
             * NOTE: temporarily removing during refactoring.
             */
            // if (util.contains(ret, cnst.INSERT_ATTACHMENT)) {
            //     ret = S.util.replaceAll(ret, cnst.INSERT_ATTACHMENT, binary.render());
            // } else {
            ret.push(binary);
            //}
        }

        return new Div(null, { "id": node.id + "_" + this.idPrefix + "_content" }, ret);
    }

    compRender = (): ReactNode => {
        /* Delegate rendering to comp */
        return this.comp.compRender();
    }
}

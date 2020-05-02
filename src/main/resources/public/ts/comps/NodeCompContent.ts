import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Comp } from "../widget/base/Comp";
import { ReactNode } from "react";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { NodeCompMarkdown } from "./NodeCompMarkdown";
import { NodeCompBinary } from "./NodeCompBinary";
import { Div } from "../widget/Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompContent extends Div {

    constructor(public node: J.NodeInfo, public rowStyling: boolean, public showHeader: boolean, public idPrefix = "") {
        super(null);
    }

    super_CompRender: any = this.compRender;
    compRender = (): ReactNode => {
        let node = this.node;

        if (!node) {
            return this.super_CompRender();
        }

        //console.log("NodeCompContent node is rendering: "+S.util.prettyPrint(node));
        this.attribs.id = node.id + "_" + this.idPrefix + "_content";

        let children: Comp[] = [];
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);

        // /* todo-2: enable headerText when appropriate here */
        // if (S.meta64.showMetaData) {
        //     if (this.showHeader) {
        //         children.push(new NodeCompRowHeader(node));
        //     }
        // }

        if (S.meta64.showProperties) {
            let propTable = S.props.renderProperties(node.properties);
            if (propTable) {
                children.push(propTable);
            }
        } else {
            let renderComplete: boolean = false;

            /*
             * Special Rendering for Nodes that have a plugin-renderer
             */
            if (typeHandler) {
                renderComplete = true;
                children.push(typeHandler.render(node, this.rowStyling));
            }

            if (!renderComplete) {
                let retState: any = {};
                retState.renderComplete = renderComplete;
                children.push(new NodeCompMarkdown(node, retState));
                renderComplete = retState.renderComplete;
            }
        }

        // /* if node owner matches node id this is someone's account root node, so what we're doing here is not
        // showing the normal attachment for this node, because that will the same as the avatar */
        let isAnAccountNode = node.ownerId && node.id == node.ownerId;

        if (S.props.hasBinary(node) && !isAnAccountNode) {
            let binary = new NodeCompBinary(node);

            //todo-1: bring this back. I already needed it again.
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
            children.push(binary);
            //}
        }

        this.setChildren(children);

        return this.super_CompRender();
    }
}

import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import { NodeCompBinary } from "./NodeCompBinary";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompContent extends Div {

    domPreUpdateFunc: Function;

    constructor(public node: J.NodeInfo,
        public rowStyling: boolean,
        public showHeader: boolean,
        public idPrefix?: string,
        public isFeed?: boolean,
        public imgSizeOverride?: string,
        public isTreeView?: boolean) {
        super(null, {
            id: (idPrefix ? idPrefix : "n") + node.id
        });
        this.domPreUpdateEvent = this.domPreUpdateEvent.bind(this);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;

        if (!node) {
            this.setChildren(null);
            return;
        }

        let children: CompIntf[] = [];
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        let embeddedImg = false;

        if (state.showProperties) {
            let propTable = S.props.renderProperties(node.properties);
            if (propTable) {
                children.push(propTable);
            }
        }
        else {
            if (!typeHandler) {
                typeHandler = S.plugin.getTypeHandler(J.NodeType.NONE);
            }

            if (node.content && ( //
                node.content.indexOf("{{imgUrl}}") !== -1 ||
                node.content.indexOf("{{img}}") !== -1 ||
                node.content.indexOf("{{imgUpperLeft}}") !== -1 ||
                node.content.indexOf("{{imgUpperRight}}") !== -1)) {
                embeddedImg = true;
            }
            this.domPreUpdateFunc = typeHandler.getDomPreUpdateFunction;
            children.push(typeHandler.render(node, this.rowStyling, this.isTreeView, state));
        }

        /* if node owner matches node id this is someone's account root node, so what we're doing here is not
         showing the normal attachment for this node, because that will the same as the avatar */
        let isAnAccountNode = node.ownerId && node.id === node.ownerId;

        if (!embeddedImg && S.props.hasBinary(node) && !isAnAccountNode) {
            children.push(new NodeCompBinary(node, false, false, this.imgSizeOverride));
        }

        this.maybeRenderDateTime(children, J.NodeProp.DATE, "Date", node);
        this.setChildren(children);
    }

    maybeRenderDateTime = (children: CompIntf[], propName: string, displayName: string, node: J.NodeInfo): void => {
        let timestampVal = S.props.getNodePropVal(propName, node);
        if (timestampVal) {
            let dateVal: Date = new Date(parseInt(timestampVal));
            let diffTime = dateVal.getTime() - (new Date().getTime());
            let diffDays: number = Math.round(diffTime / (1000 * 3600 * 24));
            let diffStr = "";
            if (diffDays === 0) {
                diffStr = " (today)";
            }
            else if (diffDays > 0) {
                if (diffDays === 1) {
                    diffStr = " (tomorrow)";
                }
                else {
                    diffStr = " (" + diffDays + " days away)";
                }
            }
            else if (diffDays < 0) {
                if (diffDays === -1) {
                    diffStr = " (yesterday)";
                }
                else {
                    diffStr = " (" + Math.abs(diffDays) + " days ago)";
                }
            }

            children.push(new Div(displayName + ": " + S.util.formatDate(dateVal) + //
                " - " + S.util.getDayOfWeek(dateVal) + diffStr, {
                className: "dateTimeDisplay"
            }));
        }
    }

    domPreUpdateEvent(): void {
        let elm = this.attribs.ref.current;

        // todo-0: is domPreUpdateFunc still needed ? we have 'elm' here now.
        if (this.domPreUpdateFunc) {
            // this.whenElm((elm) => {
                this.domPreUpdateFunc(this);
            // });
        }
        super.domPreUpdateEvent();
    }
}

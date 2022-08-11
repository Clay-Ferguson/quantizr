import { useAppState } from "../../AppRedux";
import { CompIntf } from "../../comp/base/CompIntf";
import { Div } from "../../comp/core/Div";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { Clearfix } from "../core/Clearfix";
import { NodeCompBinary } from "./NodeCompBinary";

export class NodeCompContent extends Div {
    domPreUpdateFunc: Function;

    constructor(public node: J.NodeInfo,
        public tabData: TabIntf<any>,
        public rowStyling: boolean,
        public showHeader: boolean,
        public idPrefix: string,
        public isFeed: boolean,
        public imgSizeOverride: string,
        public isTreeView: boolean,
        public isLinkedNode: boolean) {
        super(null, {
            id: (idPrefix ? idPrefix : "n") + node?.id
        });
    }

    preRender(): void {
        const state = useAppState();

        if (!this.node) {
            this.setChildren(null);
            return;
        }

        const children: CompIntf[] = [];
        let typeHandler = S.plugin.getTypeHandler(this.node.type);
        let embeddedImg = false;

        if (state.showProperties) {
            const propTable = S.props.renderProperties(this.node.properties);
            if (propTable) {
                children.push(propTable);
            }
        }
        else {
            typeHandler = typeHandler || S.plugin.getTypeHandler(J.NodeType.NONE);

            if (this.node.content && ( //
            this.node.content.indexOf("{{imgUrl}}") !== -1 ||
            this.node.content.indexOf("{{img}}") !== -1 ||
            this.node.content.indexOf("{{imgUpperLeft}}") !== -1 ||
            this.node.content.indexOf("{{imgUpperRight}}") !== -1 ||
            this.node.content.indexOf("{{imgUpperCenter}}") !== -1)) {
                embeddedImg = true;
            }

            this.domPreUpdateFunc = typeHandler.getDomPreUpdateFunction;
            children.push(typeHandler.render(this.node, this.tabData, this.rowStyling, this.isTreeView, this.isLinkedNode, state));
        }

        /* if node owner matches node id this is someone's account root node, so what we're doing here is not
         showing the normal attachment for this node, because that will the same as the avatar */
        const isAnAccountNode = this.node.ownerId && this.node.id === this.node.ownerId;

        if (!embeddedImg && S.props.hasBinary(this.node) && !isAnAccountNode) {
            children.push(new NodeCompBinary(this.node, false, false, this.imgSizeOverride));
        }

        this.maybeRenderDateTime(children, J.NodeProp.DATE, "Date", this.node);
        this.setChildren(children);
    }

    maybeRenderDateTime = (children: CompIntf[], propName: string, displayName: string, node: J.NodeInfo) => {
        const timestampVal = S.props.getPropStr(propName, node);
        if (timestampVal) {
            const dateVal: Date = new Date(parseInt(timestampVal));
            const diffTime = dateVal.getTime() - (new Date().getTime());
            const diffDays: number = Math.round(diffTime / (1000 * 3600 * 24));
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
                className: "dateTimeDisplay float-end"
            }));
            children.push(new Clearfix());
        }
    }

    domPreUpdateEvent = () => {
        if (this.domPreUpdateFunc) {
            this.domPreUpdateFunc(this);
        }
    }
}

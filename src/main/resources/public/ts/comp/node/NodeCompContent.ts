import { useAppState } from "../../AppContext";
import { CompIntf } from "../../comp/base/CompIntf";
import { Div } from "../../comp/core/Div";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { Anchor } from "../core/Anchor";
import { Clearfix } from "../core/Clearfix";
import { Heading } from "../core/Heading";
import { Img } from "../core/Img";
import { PropTable } from "../PropTable";
import { NodeCompBinary } from "./NodeCompBinary";

export class NodeCompContent extends Div {
    domPreUpdateFunc: Function;

    constructor(public node: J.NodeInfo,
        public tabData: TabIntf<any>,
        public rowStyling: boolean,
        public showHeader: boolean,
        public idPrefix: string,
        public isFeed: boolean,
        public isTreeView: boolean,
        public isLinkedNode: boolean,
        public wrapperClass: string) {
        super(null, {
            id: (idPrefix ? idPrefix : "n") + node?.id,
            className: wrapperClass
        });
    }

    preRender(): void {
        const state = useAppState();

        if (!this.node) {
            this.setChildren(null);
            return;
        }

        const children: CompIntf[] = [];
        let type = S.plugin.getType(this.node.type);
        type = type || S.plugin.getType(J.NodeType.NONE);

        this.domPreUpdateFunc = type.getDomPreUpdateFunction;

        const name: string = S.props.getPropObj(J.NodeProp.ACT_PUB_OBJ_NAME, this.node);
        if (name) {
            children.push(new Heading(4, name, { className: "marginLeft marginTop" }));
        }

        children.push(type.render(this.node, this.tabData, this.rowStyling, this.isTreeView, this.isLinkedNode, state));

        if (state.userPrefs.showProps && this.node.properties?.length > 0) {
            children.push(new PropTable(this.node));
            children.push(new Clearfix());
        }

        /* if node owner matches node id this is someone's account root node, so what we're doing here is not
         showing the normal attachment for this node, because that will the same as the avatar */
        const isAccountNode = this.node.ownerId && this.node.id === this.node.ownerId;

        if (S.props.hasBinary(this.node) && !isAccountNode) {
            const attComps: CompIntf[] = [];
            S.props.getOrderedAttachments(this.node).forEach(att => {
                // having 'att.key' is a client-side only hack, and only generated during the ordering,
                // so we break a bit of type safety here.

                // show it here only if there's no "position(p)" for it, becasue the positioned ones are layed out
                // via html in 'render.injectSubstitutions'
                if (!att.p || att.p === "auto") {
                    attComps.push(new NodeCompBinary(this.node, (att as any).key, false, false));
                }
            });
            children.push(new Div(null, { className: "rowImageContainer" }, attComps));
        }

        this.renderActPubUrls(children, this.node);
        this.renderActPubIcons(children, this.node);

        this.maybeRenderDateTime(children, J.NodeProp.DATE, this.node);
        this.setChildren(children);
    }

    renderActPubUrls = (children: CompIntf[], node: J.NodeInfo) => {
        const urls: J.APObjUrl[] = S.props.getPropObj(J.NodeProp.ACT_PUB_OBJ_URLS, node);
        let div: Div = null;
        if (urls?.forEach) {
            urls.forEach(url => {
                if (url.type === "Link") {
                    // lazy create div
                    div = div || new Div(null, { className: "apObjLinksContainer float-end" });
                    div.addChild(new Div(null, { className: "apUrlLink" }, [
                        new Anchor(url.href, url.mediaType, { target: "_blank" })
                    ]));
                }
            });
        }

        if (div) {
            children.push(new Clearfix());
            children.push(div);
        }
    }

    renderActPubIcons = (children: CompIntf[], node: J.NodeInfo) => {
        const icons: J.APObjIcon[] = S.props.getPropObj(J.NodeProp.ACT_PUB_OBJ_ICONS, node);
        let div: Div = null;
        if (icons?.forEach) {
            icons.forEach(icon => {
                if (icon.type === "Icon") {
                    // lazy create div
                    div = div || new Div(null, { className: "apObjIconContainer" });
                    div.addChild(new Img({ src: icon.url, className: "apObjIcon" }));
                }
            });
        }

        if (div) {
            children.push(div);
        }
    }

    maybeRenderDateTime = (children: CompIntf[], propName: string, node: J.NodeInfo) => {
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

            // if more than two days in future or past we don't show the time, just the date
            const when = (diffDays <= -2 || diffDays >= 2) ? S.util.formatDateShort(dateVal) : S.util.formatDateTime(dateVal);
            children.push(new Div(when + " " + S.util.getDayOfWeek(dateVal) + diffStr, {
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

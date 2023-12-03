import { getAs } from "../../AppContext";
import { Comp } from "../../comp/base/Comp";
import { Div } from "../../comp/core/Div";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { Anchor } from "../core/Anchor";
import { Clearfix } from "../core/Clearfix";
import { Heading } from "../core/Heading";
import { Img } from "../core/Img";
import { PropDisplayLayout } from "../PropDisplayLayout";
import { PropTable } from "../PropTable";
import { NodeCompBinary } from "./NodeCompBinary";

export class NodeCompContent extends Div {
    domPreUpdateFunc: (parent: Comp) => void;
    static PRE_PREFIX = "nc_";

    constructor(public node: J.NodeInfo,
        public tabData: TabIntf<any>,
        public rowStyling: boolean,
        public showHeader: boolean,
        public idPrefix: string,
        public isFeed: boolean,
        public isTreeView: boolean,
        public isLinkedNode: boolean,
        public wrapperClass: string) {

        if (node.id == getAs().indexHighlightNode) {
            wrapperClass = wrapperClass || "";
            wrapperClass += " docNodeHighlight";
        }

        super(null, {
            // nc_ == Node Content (prefix+id will be the ENTIRE row Dom ID)
            id: NodeCompContent.PRE_PREFIX + idPrefix + node?.id,
            className: wrapperClass
        });
    }

    override preRender = (): boolean => {
        const ast = getAs();

        if (!this.node) {
            this.setChildren(null);
            return false;
        }

        const children: Comp[] = [];
        let type = S.plugin.getType(this.node.type);
        type = type || S.plugin.getType(J.NodeType.NONE);
        this.domPreUpdateFunc = type.domPreUpdateFunction;

        const name: string = S.props.getPropObj(J.NodeProp.ACT_PUB_OBJ_NAME, this.node);
        if (name) {
            children.push(new Heading(4, name, { className: "marginLeft marginTop" }));
        }

        /* if node owner matches node id this is someone's account root node, so what we're doing here is not
        showing the normal attachment for this node, because that will the same as the avatar */
        const isAccountNode = this.node.ownerId && this.node.id === this.node.ownerId;
        if (S.props.hasBinary(this.node) && !isAccountNode) {
            const attachments = S.props.getOrderedAtts(this.node);
            attachments.forEach(att => {
                if (S.nodeUtil.isCutAttachment(att, this.node.id)) return;

                // don't process here, we process below
                if (!att.p || att.p === "auto" || att.p === "ft") return;
                let clazz = null;

                // Center Top
                if (att.p === "c") {
                    clazz = "imgUpperCenter";
                }
                // Upper Left
                else if (att.p === "ul") {
                    clazz = "imgUpperLeft";
                }
                // Upper Right
                else if (att.p === "ur") {
                    clazz = "imgUpperRight";
                }
                children.push(new NodeCompBinary(this.node, (att as any).key, false, false, attachments.length > 0, clazz));
            });
        }

        children.push(type.render(this.node, this.tabData, this.rowStyling, this.isTreeView, this.isLinkedNode));

        // if this node has File or Folder props and we own it then show the properties table.
        const hasFileOrFolderProp = S.props.getPropStr(J.NodeProp.FILE_NAME, this.node) ||
            S.props.getPropStr(J.NodeProp.FOLDER_NAME, this.node);

        if (this.node.type !== J.NodeType.ACCOUNT && //
            ((hasFileOrFolderProp && S.props.isMine(this.node)) || ast.userPrefs.showProps || type.schemaOrg) && S.props.hasDisplayableProps(this.node)) {
            if (type.schemaOrg) {
                children.push(new PropDisplayLayout(this.node));
            }
            else {
                children.push(new PropTable(this.node));
            }
            children.push(new Clearfix());
        }

        if (S.props.hasBinary(this.node) && !isAccountNode) {
            const attComps: Comp[] = [];
            const attachments = S.props.getOrderedAtts(this.node);
            attachments.forEach(att => {
                if (S.nodeUtil.isCutAttachment(att, this.node.id)) return;

                // having 'att.key' is a client-side only hack, and only generated during the ordering,
                // so we break a bit of type safety here.

                // show it here only if there's no "position(p)" for it, because the positioned ones are layed out
                // via html in 'render.injectSubstitutions'
                if (!att.p || att.p === "auto") {
                    attComps.push(new NodeCompBinary(this.node, (att as any).key, false, false, attachments.length > 0, null));
                }
            });
            children.push(new Div(null, { className: "rowImageContainer" }, attComps));
        }

        this.renderActPubUrls(children, this.node);
        this.renderActPubIcons(children, this.node);

        this.maybeRenderDateTime(children, J.NodeProp.DATE, this.node);
        this.setChildren(children);
        return true;
    }

    renderActPubUrls = (children: Comp[], node: J.NodeInfo) => {
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

    renderActPubIcons = (children: Comp[], node: J.NodeInfo) => {
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

    maybeRenderDateTime = (children: Comp[], propName: string, node: J.NodeInfo) => {
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

    override domPreUpdateEvent = () => {
        if (this.domPreUpdateFunc) {
            this.domPreUpdateFunc(this);
        }

        const elm = this.getRef();
        if (!elm) return;

        // DO NOT DELETE
        // Experimenting with ContentEditable HTML Attribute.
        // This would work great, but consolidating changes from the HTML back into any
        // Markdown formatted text is a challenge, and probably never doable, so we might
        // eventually use this just for plain (non-markdown) editing in the future in some
        // future use case.
        //
        // elm.querySelectorAll(".mkCont").forEach((e: Element) => {
        //     if (!this.node?.content) return;
        //     // let text = e.textContent;
        //     let text = "";
        //     for (let i = 0; i < e.childNodes.length; ++i) {
        //         if (e.childNodes[i].nodeType === Node.TEXT_NODE) {
        //             text += e.childNodes[i].textContent;
        //         }
        //     }
        //     console.log("e.text[" + text + "] content [" + this.node.content + "]");
        //     const matches = this.node.content.match(new RegExp(text, "g"));
        //     if (matches) {
        //         console.log("matches=" + matches.length);
        //         if (matches.length !== 1) return;
        //     }
        //     e.setAttribute("contentEditable", "true");
        //     e.addEventListener("input", (evt) => {
        //         // console.log("changed.");
        //     }, false);
        //     // Don't allow ENTER key because that makes DOM changes and we don't handle that.
        //     e.addEventListener("keydown", (evt: any) => {
        //         if (evt.code === "Enter") {
        //             evt.preventDefault();
        //         }
        //     }, false);
        // });
    }
}

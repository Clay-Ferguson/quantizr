import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "../widget/Div";
import { Icon } from "../widget/Icon";
import { Comp } from "../widget/base/Comp";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { ReactNode } from "react";
import { VideoPlayerDlg } from "../dlg/VideoPlayerDlg";
import { Anchor } from "../widget/Anchor";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { Span } from "../widget/Span";
import { Img } from "../widget/Img";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompBinary extends Comp {

    comp: Comp = null;

    constructor(public node: J.NodeInfo) {
        super();
        this.comp = this.build();
    }

    build = (): Comp => {
        let node = this.node;

               /*
         * If this is an image render the image directly onto the page as a visible image
         */
        if (S.props.hasImage(node)) {
            return this.makeImageTag(node);
        }
        else if (S.props.hasVideo(node)) {
            return new ButtonBar([
                new Button("Play Video", () => {
                    new VideoPlayerDlg(S.render.getStreamUrlForNodeAttachment(node)).open();
                }),
                new Div("", {
                    className: "videoDownloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(node), "[Download Video]")])
            ], "marginAll");
        }
        else if (S.props.hasAudio(node)) {
            return new ButtonBar([
                new Button("Play Audio", () => {
                    new AudioPlayerDlg(S.render.getStreamUrlForNodeAttachment(node)).open();
                }),
                new Div("", {
                    className: "audioDownloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(node), "[Download Audio]")])
            ], "marginAll");
        }
        /*
         * If not an image we render a link to the attachment, so that it can be downloaded.
         */
        else {
            let fileName: string = S.props.getNodePropVal(J.NodeProp.BIN_FILENAME, node);
            let fileSize: string = S.props.getNodePropVal(J.NodeProp.BIN_SIZE, node);
            let fileType: string = S.props.getNodePropVal(J.NodeProp.BIN_MIME, node);

            let viewFileLink: Anchor = null;
            if (fileType == "application/pdf" || fileType.startsWith("text/")) {
                viewFileLink = new Anchor(S.render.getUrlForNodeAttachment(node), "[View]", {
                    target: "_blank",
                    className: "marginLeft"
                });
            }

            return new Div("", {
                className: "binary-link",
                title: "File Size:" + fileSize + " Type:" + fileType
            }, [
                new Icon("", null, {
                    "style": { marginRight: '12px', verticalAlign: 'middle' },
                    className: "fa fa-file fa-lg"
                }),
                new Span(fileName, {
                    className: "normalText marginRight"
                }),
                new Anchor(S.render.getUrlForNodeAttachment(node), "[Download]"),
                viewFileLink
            ]);
        }
    }

    makeImageTag = (node: J.NodeInfo): Img => {
        let src: string = S.render.getUrlForNodeAttachment(node);

        let imgSize = S.props.getNodePropVal(J.NodeProp.IMG_SIZE, node);
        //console.log("imgSize for nodeId=" + node.id + " is " + imgSize + " during render.");
        let style: any = {};
        let normalWidth = "";

        if (!imgSize || imgSize == "0") {
            style.maxWidth = "";
            style.width = "";
            normalWidth = "";
        }
        else {
            style.maxWidth = "calc(" + imgSize + "% - 12px)";
            style.width = "calc(" + imgSize + "% - 12px)";
            normalWidth = "calc(" + imgSize + "% - 12px)";
        }

        //Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        let img: Img = new Img({
            "src": src,
            className: "attached-img",
            style,
            "title": "Click image to enlarge/reduce"
        });

        img.whenElm((elm: HTMLElement) => {
            elm.addEventListener("click", () => {
                if (elm.style.maxWidth) {
                    elm.style.maxWidth = "";
                    elm.style.width = "";
                }
                else {
                    elm.style.maxWidth = normalWidth || "100% - 12px";
                    elm.style.width = normalWidth || "100% - 12px";
                }
            });
        });

        return img;
    }

    compRender = () : ReactNode => {
        /* Delegate rendering to comp */
        return this.comp.compRender();
    }
}

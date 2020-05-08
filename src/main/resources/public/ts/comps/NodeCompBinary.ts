import * as J from "../JavaIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Div } from "../widget/Div";
import { Icon } from "../widget/Icon";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { VideoPlayerDlg } from "../dlg/VideoPlayerDlg";
import { Anchor } from "../widget/Anchor";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { Span } from "../widget/Span";
import { Img } from "../widget/Img";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";
import { dispatch } from "../AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompBinary extends Div {

    constructor(public node: J.NodeInfo) {
        super();
    }

    makeImageTag = (node: J.NodeInfo, state: AppState): Img => {
        let src: string = S.render.getUrlForNodeAttachment(node);

        let imgSize = S.props.getNodePropVal(J.NodeProp.IMG_SIZE, node);
        let style: any = {};

        if (!imgSize || imgSize == "0") {
            style.maxWidth = "";
            style.width = "";
        }
        else {
            style.maxWidth = "calc(" + imgSize + "% - 12px)";
            style.width = "calc(" + imgSize + "% - 12px)";
        }

        //Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        let img: Img = new Img(node.id, {
            src,
            className: "attached-img",
            style,
            "title": "Click image to enlarge/reduce",
            onClick: (evt) => {
                dispatch({
                    type: "Action_ClickImage", state,
                    update: (s: AppState): void => {
                        if (s.expandedImages[node.id]) {
                            delete s.expandedImages[node.id];
                        }
                        else {
                            s.expandedImages[node.id] = "y";
                        }
                    },
                });
            }
        });
        return img;
    }

    preRender = (): void => {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        if (!node) {
            this.children = null;
            return;
        }

        /* If this is an image render the image directly onto the page as a visible image */
        if (S.props.hasImage(node)) {
            this.setChildren([this.makeImageTag(node, state)]);
        }
        else if (S.props.hasVideo(node)) {
            this.setChildren([new ButtonBar([
                new Button("Play Video", () => {
                    new VideoPlayerDlg(S.render.getStreamUrlForNodeAttachment(node), null, state).open();
                }),
                new Div("", {
                    className: "videoDownloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(node), "[Download Video]")])
            ], "marginAll")]);
        }
        else if (S.props.hasAudio(node)) {
            this.setChildren([new ButtonBar([
                new Button("Play Audio", () => {
                    new AudioPlayerDlg(S.render.getStreamUrlForNodeAttachment(node), state).open();
                }),
                new Div("", {
                    className: "audioDownloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(node), "[Download Audio]")])
            ], "marginAll")]);
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

            this.setChildren([new Div("", {
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
            ])]);
        }
    }
}

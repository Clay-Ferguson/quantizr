import { useSelector } from "react-redux";
import { appState, dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { VideoPlayerDlg } from "../dlg/VideoPlayerDlg";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Icon } from "../widget/Icon";
import { Img } from "../widget/Img";
import { Span } from "../widget/Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompBinary extends Div {

    /* editorEmbed is true when this component is inside the node editor dialog */
    constructor(public node: J.NodeInfo, private isEditorEmbed: boolean, private isFullScreenEmbed: boolean, public imgSizeOverride: string) {
        super();
    }

    makeImageTag = (node: J.NodeInfo, state: AppState): Img => {
        let src: string = S.render.getUrlForNodeAttachment(node, false);

        let imgSize = "";
        if (this.isFullScreenEmbed) {
            imgSize = state.fullScreenImageSize;
        }
        else if (this.isEditorEmbed) {
            imgSize = "200px";
        }
        else {
            imgSize = (this.imgSizeOverride && this.imgSizeOverride !== "n") ? this.imgSizeOverride : S.props.getNodePropVal(J.NodeProp.IMG_SIZE, node);
        }
        let style: any = {};
        // console.log("id: " + node.id + " imgSize=" + imgSize);

        if (!imgSize || imgSize === "0") {
            style.maxWidth = "";
            style.width = "";
        }
        else {
            imgSize = imgSize.trim();

            // for backwards compatability if no units are given assume percent
            if (!imgSize.endsWith("%") && !imgSize.endsWith("px")) {
                imgSize += "%";
            }
            style.maxWidth = "calc(" + imgSize + " - 12px)";
            style.width = "calc(" + imgSize + " - 12px)";
        }

        return new Img(node.id, {
            src,
            className: this.isEditorEmbed ? "attached-img-in-editor" : "attached-img-in-row",
            style,
            title: "Click image to enlarge/reduce",
            onClick: () => {
                this.cached_clickOnImage(node.id);
            }
        });
    }

    cached_clickOnImage = (nodeId: string) => {
        if (this.isEditorEmbed) return;
        let state = appState();

        dispatch({
            type: "Action_ClickImage",
            state,
            update: (s: AppState): void => {
                if (s.fullScreenViewId && this.isFullScreenEmbed) {
                    s.fullScreenImageSize = s.fullScreenImageSize ? "" : "100%";
                }
                s.fullScreenViewId = nodeId;
            }
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        if (!this.node) {
            this.setChildren(null);
            return;
        }

        /* If this is an image render the image directly onto the page as a visible image */
        if (S.props.hasImage(this.node)) {
            this.setChildren([this.makeImageTag(this.node, state)]);
        }
        else if (S.props.hasVideo(this.node)) {
            this.setChildren([new ButtonBar([
                new Button("Play Video", () => {
                    new VideoPlayerDlg(S.render.getStreamUrlForNodeAttachment(this.node), null, state).open();
                }),
                new Span("", {
                    className: "videoDownloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(this.node, true), "[Download Video]")])
            ], "marginAll")]);
        }
        else if (S.props.hasAudio(this.node)) {
            this.setChildren([new ButtonBar([
                new Button("Play Audio", () => {
                    new AudioPlayerDlg(null, null, null, S.render.getStreamUrlForNodeAttachment(this.node), state).open();
                }),
                new Span("", {
                    className: "audioDownloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(this.node, true), "[Download Audio]")])
            ], "marginAll")]);
        }
        /*
         * If not an image we render a link to the attachment, so that it can be downloaded.
         */
        else {
            let fileName: string = S.props.getNodePropVal(J.NodeProp.BIN_FILENAME, this.node);
            let fileSize: string = S.props.getNodePropVal(J.NodeProp.BIN_SIZE, this.node);
            let fileType: string = S.props.getNodePropVal(J.NodeProp.BIN_MIME, this.node);

            let viewFileLink: Anchor = null;
            if (fileType === "application/pdf" || fileType.startsWith("text/")) {
                viewFileLink = new Anchor(S.render.getUrlForNodeAttachment(this.node, false), "[ View ]", {
                    target: "_blank",
                    className: "marginLeft"
                });
            }

            this.setChildren([new Div("", {
                className: "binary-link",
                title: "File Size:" + fileSize + " Type:" + fileType
            }, [
                new Icon({
                    style: { marginRight: "12px", verticalAlign: "middle" },
                    className: "fa fa-file fa-lg"
                }),
                new Span(fileName, {
                    className: "normalText marginRight"
                }),
                new Anchor(S.render.getUrlForNodeAttachment(this.node, true), "[ Download ]"),
                viewFileLink
            ])]);
        }
    }
}

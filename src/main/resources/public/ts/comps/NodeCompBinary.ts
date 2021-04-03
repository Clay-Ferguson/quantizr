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
        this.mergeState({ node });
    }

    makeImageTag = (node: J.NodeInfo, state: AppState): Img => {
        if (!node) return null;
        let src: string = S.render.getUrlForNodeAttachment(node, false);

        let imgSize = "";
        if (this.isFullScreenEmbed) {
            imgSize = state.fullScreenImageSize;
        }
        else if (this.isEditorEmbed) {
            imgSize = "120px";
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
            style.maxWidth = `calc(${imgSize} - 12px)`;
            style.width = `calc(${imgSize} - 12px)`;
        }

        return new Img(node.id, {
            src,
            className: this.isEditorEmbed ? "attached-img-in-editor" : "attached-img-in-row",
            style,
            title: "Click image to enlarge/reduce",
            onClick: this.clickOnImage,
            nid: node.id
        });
    }

    clickOnImage = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        if (this.isEditorEmbed) return;

        dispatch("Action_ClickImage", (s: AppState): AppState => {
            /* When we click to enlarge an image we need to save the current scroll position
            after we close the image.

            todo-0: need more generalized solution to restoring scroll position based on what tab is active, and also
            sort of treating the fullScreen viewer as a tab also, at least for the purpose of scroll management
            */
            if (s.savedScrollPosition === -1) {
                s.savedScrollPosition = window.scrollY;
                // console.log("Saved ScrollPos: " + s.savedScrollPosition);
            }

            if (s.fullScreenViewId && this.isFullScreenEmbed) {
                s.fullScreenImageSize = s.fullScreenImageSize ? "" : "100%";
            }
            s.fullScreenViewId = id;
            return s;
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.getState().node;
        if (!node) {
            this.setChildren(null);
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
                new Span("", {
                    className: "videoDownloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(node, true), "[Download]")])
            ], "marginAll")]);
        }
        else if (S.props.hasAudio(node)) {
            this.setChildren([new ButtonBar([
                new Button("Play Audio", () => {
                    new AudioPlayerDlg(null, null, null, S.render.getStreamUrlForNodeAttachment(node), 0, state).open();
                }),
                new Span("", {
                    className: "audioDownloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(node, true), "[Download]")])
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
            if (fileType === "application/pdf" || fileType.startsWith("text/")) {
                viewFileLink = new Anchor(S.render.getUrlForNodeAttachment(node, false), "[ View ]", {
                    target: "_blank",
                    className: "marginLeft"
                });
            }

            this.setChildren([new Div("", {
                className: "binary-link",
                title: `File Size:${fileSize} Type:${fileType}`
            }, [
                new Icon({
                    style: { marginRight: "12px", verticalAlign: "middle" },
                    className: "fa fa-file fa-lg"
                }),
                new Span(fileName, {
                    className: "normalText marginRight"
                }),
                new Div(null, null, [
                    new Anchor(S.render.getUrlForNodeAttachment(node, true), "[ Download ]"),
                    viewFileLink
                ])
            ])]);
        }
    }
}

import { dispatch, useAppState } from "../../AppRedux";
import { AppState } from "../../AppState";
import { Anchor } from "../../comp/core/Anchor";
import { Div } from "../../comp/core/Div";
import { Icon } from "../../comp/core/Icon";
import { IconButton } from "../../comp/core/IconButton";
import { Img } from "../../comp/core/Img";
import { Span } from "../../comp/core/Span";
import { Constants as C } from "../../Constants";
import { DialogMode } from "../../DialogBase";
import { AudioPlayerDlg } from "../../dlg/AudioPlayerDlg";
import { VideoPlayerDlg } from "../../dlg/VideoPlayerDlg";
import { FullScreenType } from "../../Interfaces";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { HorizontalLayout } from "../core/HorizontalLayout";

interface LS {
    node: J.NodeInfo;
}

export class NodeCompBinary extends Div {

    /* editorEmbed is true when this component is inside the node editor dialog */
    constructor(public node: J.NodeInfo, private isEditorEmbed: boolean, private isFullScreenEmbed: boolean, public imgSizeOverride: string) {
        super();
        this.mergeState<LS>({ node });
    }

    makeImageTag = (node: J.NodeInfo, state: AppState): Img => {
        if (!node) return null;
        const src: string = S.attachment.getUrlForNodeAttachment(node, false);

        let size = "";
        if (this.isFullScreenEmbed) {
            size = state.fullScreenImageSize;
        }
        else if (this.isEditorEmbed) {
            size = "150px";
        }
        else {
            size = (this.imgSizeOverride && this.imgSizeOverride !== "n") ? this.imgSizeOverride : S.props.getPropStr(J.NodeProp.IMG_SIZE, node);
        }
        const style: any = {};

        if (!size || size === "0") {
            style.maxWidth = "";
            style.width = "";
        }
        else {
            size = size.trim();

            // for backwards compatability if no units are given assume percent
            if (!size.endsWith("%") && !size.endsWith("px")) {
                size += "%";
            }
            style.maxWidth = `calc(${size} - 24px)`;
            style.width = `calc(${size} - 24px)`;
        }

        const className = this.isFullScreenEmbed ? "full-screen-img" : (this.isEditorEmbed ? "img-in-editor" : "img-in-row")

        return new Img(node.id, {
            src,
            className,
            style,
            title: "Click image to enlarge/reduce",
            onClick: this.clickOnImage,
            nid: node.id
        });
    }

    clickOnImage = (evt: Event, id: string) => {
        id = S.util.allowIdFromEvent(evt, id);
        if (this.isEditorEmbed) return;

        dispatch("ClickImage", s => {
            if (s.fullScreenConfig.type === FullScreenType.IMAGE && this.isFullScreenEmbed) {
                s.fullScreenImageSize = s.fullScreenImageSize ? "" : C.FULL_SCREEN_MAX_WIDTH;
            }
            s.fullScreenConfig = { type: FullScreenType.IMAGE, nodeId: id };
            return s;
        });
    }

    preRender(): void {
        const state = useAppState();
        const node = this.getState<LS>().node;
        if (!node) {
            this.setChildren(null);
            return;
        }

        /* If this is an image render the image directly onto the page as a visible image */
        if (S.props.hasImage(node)) {
            this.setChildren([this.makeImageTag(node, state)]);
        }
        else if (S.props.hasVideo(node)) {
            this.setChildren([new HorizontalLayout([
                new IconButton("fa-play", "Play Video", {
                    onClick: () => {
                        new VideoPlayerDlg("vidPlayer-" + node.id, S.attachment.getStreamUrlForNodeAttachment(node), null, DialogMode.FULLSCREEN).open();
                    }
                }, "btn-primary"),
                new Span("", {
                    className: "downloadLink"
                }, [new Anchor(S.attachment.getUrlForNodeAttachment(node, true), "Download", { target: "_blank" })])
            ])]);
        }
        else if (S.props.hasAudio(node)) {
            this.setChildren([new HorizontalLayout([
                new IconButton("fa-play", "Play Audio", {
                    onClick: () => {
                        new AudioPlayerDlg(null, null, null, S.attachment.getStreamUrlForNodeAttachment(node), 0).open();
                    }
                }, "btn-primary"),
                new Span("", {
                    className: "downloadLink"
                }, [new Anchor(S.attachment.getUrlForNodeAttachment(node, true), "Download", { target: "_blank" })])
            ])]);
        }
        /*
         * If not an image we render a link to the attachment, so that it can be downloaded.
         */
        else {
            const fileName = S.props.getPropStr(J.NodeProp.BIN_FILENAME, node);
            const fileSize = S.props.getPropStr(J.NodeProp.BIN_SIZE, node);
            const fileType = S.props.getPropStr(J.NodeProp.BIN_MIME, node);

            let viewFileLink: Anchor = null;
            if (fileType === "application/pdf" || fileType?.startsWith("text/")) {
                viewFileLink = new Anchor(S.attachment.getUrlForNodeAttachment(node, false), "View", {
                    target: "_blank",
                    className: "downloadLink"
                });
            }

            this.setChildren([new Div("", {
                className: "binary-link",
                title: `File Size:${fileSize} Type:${fileType}`
            }, [
                new Icon({
                    className: "fa fa-file fa-lg iconMarginRight"
                }),
                new Span(fileName, {
                    className: "normalText marginRight"
                }),
                new Div(null, { className: "marginTop" }, [
                    new Anchor(S.attachment.getUrlForNodeAttachment(node, true), "Download", { className: "downloadLink" }),
                    viewFileLink
                ])
            ])]);
        }
    }
}

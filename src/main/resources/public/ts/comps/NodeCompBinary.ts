import { useSelector } from "react-redux";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { TorrentListingDlg } from "../dlg/TorrentListingDlg";
import { VideoPlayerDlg } from "../dlg/VideoPlayerDlg";
import { DialogMode } from "../enums/DialogMode";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { Div } from "../widget/Div";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { Icon } from "../widget/Icon";
import { IconButton } from "../widget/IconButton";
import { Img } from "../widget/Img";
import { Span } from "../widget/Span";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    node: J.NodeInfo;
}

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompBinary extends Div {

    /* editorEmbed is true when this component is inside the node editor dialog */
    constructor(public node: J.NodeInfo, private isEditorEmbed: boolean, private isFullScreenEmbed: boolean, public imgSizeOverride: string) {
        super();
        this.mergeState<LS>({ node });
    }

    makeImageTag = (node: J.NodeInfo, state: AppState): Img => {
        if (!node) return null;
        let src: string = S.render.getUrlForNodeAttachment(node, false);

        let imgSize = "";
        if (this.isFullScreenEmbed) {
            imgSize = state.fullScreenImageSize;
        }
        else if (this.isEditorEmbed) {
            imgSize = "150px";
        }
        else {
            imgSize = (this.imgSizeOverride && this.imgSizeOverride !== "n") ? this.imgSizeOverride : S.props.getNodePropVal(J.NodeProp.IMG_SIZE, node);
        }
        let style: any = {};

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

        let className = null;
        if (this.isFullScreenEmbed) {
            className = "full-screen-img";
        }
        else {
            className = this.isEditorEmbed ? "img-in-editor" : "img-in-row";
        }

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

        dispatch("Action_ClickImage", (s: AppState): AppState => {
            if (s.fullScreenViewId && this.isFullScreenEmbed) {
                s.fullScreenImageSize = s.fullScreenImageSize ? "" : C.FULL_SCREEN_MAX_WIDTH;
            }
            s.fullScreenViewId = id;
            return s;
        });
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.getState<LS>().node;
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
                        new VideoPlayerDlg("vidPlayer-" + node.id, S.render.getStreamUrlForNodeAttachment(node), null, DialogMode.FULLSCREEN, state).open();
                    }
                }, "btn-primary"),
                new Span("", {
                    className: "downloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(node, true), "Download", { target: "_blank" })])
            ])]);
        }
        else if (S.props.hasAudio(node)) {
            this.setChildren([new HorizontalLayout([
                new IconButton("fa-play", "Play Audio", {
                    onClick: () => {
                        new AudioPlayerDlg(null, null, null, S.render.getStreamUrlForNodeAttachment(node), 0, state).open();
                    }
                }, "btn-primary"),
                new Span("", {
                    className: "downloadLink"
                }, [new Anchor(S.render.getUrlForNodeAttachment(node, true), "Download", { target: "_blank" })])
            ])]);
        }
        else if (S.props.hasTorrent(node)) {
            const torrentId = S.props.getNodePropVal(J.NodeProp.BIN_URL, node);
            this.setChildren([new HorizontalLayout([
                new IconButton("fa-magnet", "Torrent", {
                    onClick: () => {
                        new TorrentListingDlg(torrentId, DialogMode.POPUP, state).open();
                    }
                }, "btn-primary")
            ])]);
        }
        /*
         * If not an image we render a link to the attachment, so that it can be downloaded.
         */
        else {
            let fileName: string = S.props.getNodePropVal(J.NodeProp.BIN_FILENAME, node);
            let fileSize: string = S.props.getNodePropVal(J.NodeProp.BIN_SIZE, node);
            let fileType: string = S.props.getNodePropVal(J.NodeProp.BIN_MIME, node);

            let viewFileLink: Anchor = null;
            if (fileType && (fileType === "application/pdf" || fileType.startsWith("text/"))) {
                viewFileLink = new Anchor(S.render.getUrlForNodeAttachment(node, false), "View", {
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
                    new Anchor(S.render.getUrlForNodeAttachment(node, true), "Download", { className: "downloadLink" }),
                    viewFileLink
                ])
            ])]);
        }
    }
}

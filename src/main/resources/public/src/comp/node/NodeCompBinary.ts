import { dispatch, getAs } from "../../AppContext";
import { Anchor } from "../../comp/core/Anchor";
import { Div } from "../../comp/core/Div";
import { Icon } from "../../comp/core/Icon";
import { IconButton } from "../../comp/core/IconButton";
import { Constants as C } from "../../Constants";
import { DialogMode } from "../../DialogBase";
import { VideoPlayerDlg } from "../../dlg/VideoPlayerDlg";
import { FullScreenType } from "../../Interfaces";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { Comp } from "../base/Comp";
import { FlexRowLayout } from "../core/FlexRowLayout";
import { Img } from "../core/Img";
import { Span } from "../core/Span";

interface LS {
    node: NodeInfo;
}

export class NodeCompBinary extends Comp {

    /* editorEmbed is true when this component is inside the node editor dialog */
    constructor(public node: NodeInfo, public attName: string, private isEditorEmbed: boolean,
        private isFullScreenEmbed: boolean, private allowRightMargin: boolean, private imgClass: string) {
        super();
        this.mergeState<LS>({ node });
    }

    makeImageComp(node: NodeInfo): Img {
        const ast = getAs();
        if (!node) return null;
        const att = S.props.getAttachment(this.attName, node);
        if (!att) return null;
        const src: string = S.attachment.getUrlForNodeAttachment(node, this.attName, false);
        const style: any = {};
        let size = "";
        let rtMargin = true;
        if (this.isFullScreenEmbed) {
            size = ast.fullScreenImageSize;
        }
        else if (this.isEditorEmbed) {
            // same as 'imgInEditor' class width
            style.width = "75px";
        }
        else {
            size = att.cssSize;
            if (size === "0" || size === "100%") {
                rtMargin = false;
            }
        }

        if (!this.isEditorEmbed) {
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

                // I forgot why I needed the "-24px" here, let's run without it.
                // style.maxWidth = `calc(${size} - 24px)`;
                // style.width = `calc(${size} - 24px)`;
                style.maxWidth = size;
                style.width = size;
            }
        }

        let imgTitleSuffix = "";
        imgTitleSuffix = att.fileName ? "\n\n" + att.fileName + "\n(" + att.mime + ")" : "";

        const className = this.isFullScreenEmbed ? "fullScreenImg" : (this.isEditorEmbed ? "imgInEditor" : "imgInRow");
        const img = new Img();
        const imgAttrs: any = {
            ...img.attribs, // need to keep because of 'id' etc.
            src,
            className,
            title: this.isEditorEmbed ? "Attached image" + imgTitleSuffix : "Click image to enlarge/reduce" + imgTitleSuffix,
            onClick: (evt: MouseEvent) => {
                // we have CTRL-CLICK already doing a zoom on images, so we don't want to do that here.
                NodeCompBinary.clickOnImage(img.getRef() as HTMLImageElement, evt, node.id, (att as any).key, this.isEditorEmbed, this.isFullScreenEmbed);
            }
        };

        if (this.isFullScreenEmbed) {
            imgAttrs.style = style;
        }
        else {
            this.attribs.style = style;
            if (!this.isEditorEmbed) {
                if (this.imgClass) {
                    this.attribs.className = this.imgClass;
                }
                else {
                    this.attribs.className = rtMargin && this.allowRightMargin ? "nodeCompBinary" : "nodeCompBinaryNoRtMargin";
                }
            }
        }

        img.attribs = imgAttrs;
        return img;
    }

    /* This method needs to be called statically and we cannot use 'this' in it,
    because it's referenced by the plain HTML text that's used when positioned images are inserted in the content */
    static clickOnImage(elm: HTMLImageElement, evt: MouseEvent, id: string, attName: string, isEditorEmbed: boolean, isFullScreenEmbed: boolean) {
        if (evt.ctrlKey) {
            NodeCompBinary.toggleZoom(elm, evt);
            return;
        }
        const node = S.nodeUtil.findNode(id);
        const att = S.props.getAttachment(attName, node);

        if (isEditorEmbed) {
            S.util.copyToClipboard(att.fileName);
            return;
        }

        dispatch("ClickImage", s => {
            if (s.fullScreenConfig.type === FullScreenType.IMAGE && isFullScreenEmbed) {
                s.fullScreenImageSize = s.fullScreenImageSize ? "" : C.FULL_SCREEN_MAX_WIDTH;
            }
            s.savedActiveTab = s.activeTab;
            s.fullScreenConfig.type = FullScreenType.IMAGE;

            // if clicking this node first time.
            if (!s.fullScreenConfig.nodeId) {
                if (node) {
                    s.fullScreenConfig.ordinal = att.ordinal || 0;
                }
            }
            s.fullScreenConfig.nodeId = id;
        });
    }

    static toggleZoom(elm: HTMLImageElement, evt: MouseEvent) {
        // Get the current zoom state from the attribute
        const isZoomedIn = elm.getAttribute("data-zoomed") === "true";

        // Get the position of the image relative to the viewport
        const rect = elm.getBoundingClientRect();

        // Calculate the click coordinates relative to the image
        const x = (evt.clientX - rect.left) / elm.clientWidth;
        const y = (evt.clientY - rect.top) / elm.clientHeight;

        if (isZoomedIn) {
            // Zoom out (restore to the original size)
            elm.style.transformOrigin = "center center";
            elm.style.transform = "scale(1)";
            elm.setAttribute("data-zoomed", "false");
        } else {
            // zoom in where user clicked
            const scale = 4;
            elm.style.transformOrigin = `${x * 100}% ${y * 100}%`;
            elm.style.transform = `scale(${scale})`;
            elm.setAttribute("data-zoomed", "true");

            // Add the zoomed class to enable the transition animation
            elm.classList.add("zoomed");

            // Remove the zoomed class after the animation is complete
            setTimeout(() => {
                elm.classList.remove("zoomed");
            }, 1500); // 1.5 seconds 
        }
    }

    override preRender(): boolean | null {
        const node = this.getState<LS>().node;
        if (!node) {
            this.children = null;
            return;
        }

        /* If this is an image render the image directly onto the page as a visible image */
        if (S.props.hasImage(node, this.attName)) {
            this.children = [this.makeImageComp(node)];
        }
        else if (S.props.hasVideo(node, this.attName)) {
            this.children = [
                new FlexRowLayout([
                    this.isEditorEmbed ? null : new IconButton("fa-play", "Video", {
                        onClick: () => {
                            new VideoPlayerDlg("vidPlayer-" + node.id, S.attachment.getStreamUrlForNodeAttachment(node, this.attName), null, DialogMode.FULLSCREEN).open();
                        }
                    }, "btn-primary marginRight"),
                    new Span(null, {
                        className: "downloadLink marginRight"
                    }, [new Anchor(S.attachment.getUrlForNodeAttachment(node, this.attName, true), "Download", { target: "_blank" })])
                ], "marginBottom")
            ];
        }
        else if (S.props.hasAudio(node, this.attName)) {
            this.children = [
                new FlexRowLayout([
                    this.isEditorEmbed ? null : new IconButton("fa-play", "Audio", {
                        onClick: () => S.nav.showAudioPlayerTab(S.attachment.getStreamUrlForNodeAttachment(node, this.attName))
                    }, "btn-primary marginRight"),
                    new Span(null, {
                        className: "downloadLink marginRight"
                    }, [new Anchor(S.attachment.getUrlForNodeAttachment(node, this.attName, true), "Download", { target: "_blank" })])
                ], "marginBottom")
            ];
        }
        /*
         * If not an image we render a link to the attachment, so that it can be downloaded.
         */
        else {
            const att = S.props.getAttachment(this.attName, node);
            const fileName = att ? att.fileName : null;
            const fileSize = att ? att.size : null;
            const fileType = att ? att.mime : null;

            let viewFileLink: Anchor = null;
            if (fileType === "application/pdf" || fileType?.startsWith("text/")) {
                viewFileLink = new Anchor(S.attachment.getUrlForNodeAttachment(node, this.attName, false), "View", {
                    target: "_blank",
                    className: "downloadLink",
                    title: "Click to open and view in your browser"
                });
            }

            const fileIcon = S.util.getFileIcon(fileType);
            const titleSuffix = `File Size:${fileSize}\n\nType:${fileType}`;
            this.children = [
                new Div(null, {
                    className: "binary-link"
                }, [
                    new Icon({
                        className: "fa " + fileIcon + " fa-lg smallMarginRight xlIcon"
                    }),
                    new Span(null, null, [
                        new Anchor(S.attachment.getUrlForNodeAttachment(node, this.attName, true), fileName || "link", {
                            className: "downloadLink marginRight",
                            title: "Click to download attachment\n\n" + titleSuffix
                        }),
                        viewFileLink
                    ])
                ])
            ];
        }
        return true;
    }
}

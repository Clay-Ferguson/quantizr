import { useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Constants as C } from "../Constants";
import { FullScreenType } from "../Interfaces";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import * as J from "../JavaIntf";

export class FullScreenControlBar extends Div {

    constructor() {
        super();
        this.attribs.className = "float-end fullScreenToolbar";
    }

    preRender(): void {
        this.setChildren(this.getButtons(useAppState()));
    }

    getButtons = (state: AppState): Comp[] => {
        const buttons = [];

        if (state.fullScreenConfig.type === FullScreenType.IMAGE && state.activeTab === C.TAB_MAIN) {
            const node = S.nodeUtil.findNode(state, state.fullScreenConfig.nodeId);
            let onFirst = false;
            let onLast = false;
            if (node && node.attachments) {
                const list: J.Attachment[] = S.props.getOrderedAttachments(node);
                onFirst = list[0].o === state.fullScreenConfig.ordinal;
                onLast = list[list.length-1].o === state.fullScreenConfig.ordinal;
            }

            if (!onFirst) {
                buttons.push(
                    new IconButton("fa-angle-left fa-lg", "", {
                        onClick: () => S.nav.prevFullScreenImgViewer(state),
                        title: "View Previous Attachment"
                    }, "btn-primary", "off"));
            }

            if (!onLast) {
                buttons.push(
                    new IconButton("fa-angle-right fa-lg", "", {
                        onClick: () => S.nav.nextFullScreenImgViewer(state),
                        title: "View Next Attachment"
                    }, "btn-primary", "off"));
            }
        }

        buttons.push(
            new IconButton("fa-window-close fa-lg", "Close", {
                onClick: () => S.nav.closeFullScreenViewer(state),
                title: "Close Viewer (ESC Key)"
            }, "btn-primary", "off"));

        return buttons;
    }
}

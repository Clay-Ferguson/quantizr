import { useAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Constants as C } from "../Constants";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";

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

        if (state.fullScreenViewId && state.activeTab === C.TAB_MAIN) {
            if (S.nav.getAdjacentNode("prev", state)) {
                buttons.push(
                    new IconButton("fa-angle-left fa-lg", "", {
                        onClick: () => { S.nav.prevFullScreenImgViewer(state); },
                        title: "View Previous Node (or left arrow key)"
                    }, "btn-primary", "off"));
            }

            if (S.nav.getAdjacentNode("next", state)) {
                buttons.push(
                    new IconButton("fa-angle-right fa-lg", "", {
                        onClick: () => { S.nav.nextFullScreenImgViewer(state); },
                        title: "View Next Node (or right arrow key)"
                    }, "btn-primary", "off"));
            }
        }

        buttons.push(
            new IconButton("fa-window-close fa-lg", "Close", {
                onClick: () => { S.nav.closeFullScreenViewer(state); },
                title: "Close Viewer (ESC Key)"
            }, "btn-primary", "off"));

        return buttons;
    }
}

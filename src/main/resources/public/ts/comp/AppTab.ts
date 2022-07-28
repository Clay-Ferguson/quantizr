import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { TabIntf } from "../intf/TabIntf";

export class AppTab<PropType = any> extends Div {
    constructor(public data: TabIntf<PropType>, private extraEditModeClass: string = null) {
        super(null, {
            id: data.id,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "2"
        });
        // console.log("Constructed AppTab: " + data.id);
    }

    getClass = (state: AppState): string => {
        let className = "tab-pane fade" +
            (state.mobileMode ? " my-tab-pane-mobile" : " my-tab-pane customScrollbar") +
            (state.userPrefs.editMode && this.extraEditModeClass ? (" " + this.extraEditModeClass) /* " my-tab-pane-editmode" */ : "");

        if (state.activeTab === this.getId()) {
            className += " show active";
        }
        return className;
    }

    getScrollPos = (): number => {
        return this.data.scrollPos;
    }

    setScrollPos = (pos: number): void => {
        this.data.scrollPos = pos;
    }
}

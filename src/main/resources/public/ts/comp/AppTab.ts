import { AppState } from "../AppState";
import { Div } from "../comp/core/Div";
import { Constants as C } from "../Constants";
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
            (state.userPreferences.editMode && this.extraEditModeClass ? (" " + this.extraEditModeClass) /* " my-tab-pane-editmode" */ : "");

        if (state.activeTab === this.getId()) {
            className += " show active";
        }
        // console.log("ID: " + this.data.id + " className=" + className);
        return className;
    }

    // sets scroll position to the value the 'data' specifies.
    reScroll = (elm: HTMLElement): void => {
        if (!elm) return;
        if (C.DEBUG_SCROLLING) {
            console.log("reScroll [" + this.data.name + "]: elm.scrollTop=" + elm.scrollTop + " elm.scrollHeight=" + elm.scrollHeight);
        }

        elm.scrollTop = this.data.scrollPos === -1 ? elm.scrollHeight : this.data.scrollPos;
    }

    // use NON-Arrow for inheritance compatability
    domAddEvent = (): void => {
        if (C.DEBUG_SCROLLING) {
            console.log("domAddEvent(a): " + this.data.name);
        }
        let elm = this.getRef();
        if (elm) {
            this.reScroll(elm);

            elm.addEventListener("scroll", () => {
                if (C.DEBUG_SCROLLING) {
                    console.log("Scroll Evt [" + this.data.name + "]: elm.scrollTop=" + elm.scrollTop);
                }

                this.data.scrollPos = elm.scrollTop;
            }, { passive: true });
        }
    }

    domPreUpdateEvent = (): void => {
        let elm = this.getRef();
        if (elm) {
            if (C.DEBUG_SCROLLING) {
                console.log("domPreUpdateEvent calling reScroll")
            }
            this.reScroll(elm);
        }
    }
}

import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { State } from "../State";
import { Div } from "./Div";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class AppTab extends Div {
    data: TabDataIntf;

    constructor(state: AppState, data: TabDataIntf, private extraEditModeClass: string = null) {
        super(null, {
            id: data.id,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "-1"
        });
        this.data = data;
        this.domAddEvent = this.domAddEvent.bind(this);
        this.domPreUpdateEvent = this.domPreUpdateEvent.bind(this);
    }

    getClass = (state: AppState): string => {
        let className = "tab-pane fade" +
            (state.mobileMode ? " my-tab-pane-mobile" : " my-tab-pane customScrollbar") +
            (state.userPreferences.editMode && this.extraEditModeClass ? (" " + this.extraEditModeClass) /* " my-tab-pane-editmode" */ : "");

        if (state.activeTab === this.getId()) {
            className += " show active";
        }
        return className;
    }

    reScroll = (elm: HTMLElement): void => {
        // console.log("reScroll: " + elm.scrollTop);
        elm.scrollTop = this.data.scrollPos;
    }

    domAddEvent(): void {
        // console.log("domAddEvent: " + this.data.name);
        let elm = this.getRef();
        this.reScroll(elm);

        // need to remove this listener in some other react state callback.
        elm.addEventListener("scroll", () => {
            // console.log("Scroll: " + elm.scrollTop);
            this.data.scrollPos = elm.scrollTop;
        }, { passive: true });

        super.domAddEvent();
    }

    domPreUpdateEvent(): void {
        let elm = this.getRef();
        this.reScroll(elm);
        super.domPreUpdateEvent();
    }
}

import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "./Anchor";
import { Div } from "./Div";
import { Li } from "./Li";
import { Ul } from "./Ul";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class TabPanelButtons extends Div {

    constructor(private verticalButtons: boolean, public moreClasses: string = "") {
        super(null);
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let tabButtons = new Div(null, {
            className: "tab-buttons-container"
        }, [
            new Ul(null, {
                className: "nav nav-tabs " + (this.verticalButtons ? "flex-column" : "") + " " + this.moreClasses,
                id: "navTabs"
            }, this.buildTabButtons(state))]
        );

        this.setChildren([
            tabButtons
        ]);
    }

    buildTabButtons = (state: AppState): Li[] => {
        let items: Li[] = [];
        for (let tab of state.tabData) {
            items.push(this.getTabButton(state, tab));
        }
        return items;
    }

    getTabButton(state: AppState, data: TabDataIntf): Li {
        return new Li(null, {
            className: "nav-item navItem",
            style: { display: data.isVisible() ? "inline" : "none" },
            onClick: (event) => {
                event.stopPropagation();
                event.preventDefault();
                S.meta64.selectTab(data.id);
            }
        }, [
            new Anchor("#" + data.id, data.name, {
                "data-toggle": "tab",
                className: "nav-link" + (state.activeTab === data.id ? " active" : "")
            })
        ]);
    }
}

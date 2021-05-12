import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
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
        for (const tab of S.meta64.tabs) {
            items.push(tab.getTabButton(state));
        }
        return items;
    }
}

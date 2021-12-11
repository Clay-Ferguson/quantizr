import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import { S } from "../Singletons";
import { Anchor } from "./Anchor";
import { Div } from "./Div";
import { Li } from "./Li";
import { Ul } from "./Ul";

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
        let tabName = data.name;
        let feedData: TabDataIntf = S.tabUtil.getTabDataById(state, C.TAB_FEED);

        // slight hack until we have 'name' as a function and not a string.
        if (tabName === "Feed" && feedData?.props?.feedFilterRootNode) {
            tabName = "Chat Room";
        }

        return new Li(null, {
            className: "nav-item",
            style: { display: data.isVisible() ? "inline" : "none" },
            onClick: (event) => {
                event.stopPropagation();
                event.preventDefault();
                S.tabUtil.selectTab(data.id);
            }
        }, [
            new Anchor("#" + data.id, tabName, {
                "data-bs-toggle": "tab",
                className: "nav-link myNavTab" + (state.activeTab === data.id ? " active" : "")
            })
        ]);
    }
}

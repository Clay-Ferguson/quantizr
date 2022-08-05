import { useAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { Anchor } from "../comp/core/Anchor";
import { Div } from "../comp/core/Div";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { FeedViewData } from "../tabs/data/FeedViewData";
import { Comp } from "./base/Comp";
import { Li } from "./core/Li";
import { Ul } from "./core/Ul";
export class TabPanelButtons extends Div {

    constructor(private verticalButtons: boolean, public moreClasses: string = "") {
        super(null);
    }

    preRender(): void {
        const state = useAppState();

        this.setChildren([
            new Div(null, {
                className: "tab-buttons-container"
            }, [
                new Ul(null, {
                    className: "nav nav-tabs " + (this.verticalButtons ? "flex-column" : "") + " " + this.moreClasses,
                    id: "navTabs"
                }, this.buildTabButtons(state))]
            )
        ]);
    }

    buildTabButtons = (state: AppState): Comp[] => {
        const items: Comp[] = [];
        for (const tab of state.tabData) {
            items.push(this.getTabButton(state, tab));

            const tabSubOptions = tab.getTabSubOptions(state);
            if (tabSubOptions) {
                items.push(tabSubOptions);
            }
        }
        return items;
    }

    getTabButton(state: AppState, data: TabIntf): Li {
        let tabName = data.name;

        // slight hack until we have 'name' as a function and not a string.
        if (tabName === "Feed" && FeedViewData.inst?.props?.feedFilterRootNode) {
            tabName = "Chat Room";
        }

        return new Li(null, {
            className: "nav-item",
            style: { display: data.isVisible(state) ? "inline" : "none" },
            onClick: (event: Event) => {
                event.stopPropagation();
                event.preventDefault();
                PubSub.pub(C.PUBSUB_closeNavPanel);
                S.tabUtil.selectTab(data.id);
            }
        }, [
            new Anchor("#" + data.id, tabName, {
                "data-bs-toggle": "tab",
                className: "nav-link appNavTab" + (state.activeTab === data.id ? " active" : ""),
                title: data.tooltip
            })
        ]);
    }
}

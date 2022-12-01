import { useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Anchor } from "../comp/core/Anchor";
import { Div } from "../comp/core/Div";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { FeedTab } from "../tabs/data/FeedTab";
import { Comp } from "./base/Comp";
import { Li } from "./core/Li";
import { Ul } from "./core/Ul";

export class TabPanelButtons extends Div {

    constructor(private verticalButtons: boolean, public moreClasses: string = "") {
        super(null);
    }

    preRender(): void {
        const ast = useAppState();

        this.setChildren([
            new Div(null, {
                className: "tab-buttons-container"
            }, [
                new Ul(null, {
                    className: "nav nav-tabs " + (this.verticalButtons ? "flex-column" : "") + " " + this.moreClasses,
                    id: "navTabs"
                }, this.buildTabButtons(ast))]
            )
        ]);
    }

    buildTabButtons = (ast: AppState): Comp[] => {
        const items: Comp[] = [];
        for (const tab of ast.tabData) {
            items.push(this.getTabButton(ast, tab));

            const tabSubOpts = tab.getTabSubOptions(ast);
            if (tabSubOpts) {
                items.push(tabSubOpts);
            }
        }
        return items;
    }

    getTabButton(ast: AppState, data: TabIntf): Li {
        let tabName = data.name;

        // slight hack until we have 'name' as a function and not a string.
        if (tabName === "Feed" && FeedTab.inst?.props?.feedFilterRootNode) {
            tabName = "Chat Room";
        }

        return new Li(null, {
            className: "nav-item",
            style: { display: data.isVisible(ast) ? "inline" : "none" },
            onClick: (event: Event) => {
                event.stopPropagation();
                event.preventDefault();
                PubSub.pub(C.PUBSUB_closeNavPanel);
                S.tabUtil.selectTab(data.id);
            }
        }, [
            new Anchor("#" + data.id, tabName, {
                "data-bs-toggle": "tab",
                className: "nav-link appNavTab" + (ast.activeTab === data.id ? " active" : ""),
                title: data.tooltip
            })
        ]);
    }
}

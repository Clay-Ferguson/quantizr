import { getAs } from "../AppContext";
import { Anchor } from "../comp/core/Anchor";
import { Div } from "../comp/core/Div";
import { Constants as C } from "../Constants";
import { TabIntf } from "../intf/TabIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { Li } from "./core/Li";
import { Ul } from "./core/Ul";

export class TabPanelButtons extends Div {
    constructor(private verticalButtons: boolean, public moreClasses: string = "") {
        super(null);
    }

    override preRender = (): boolean => {
        this.children = [
            new Div(null, {
                className: "tabButtonsContainer"
            }, [
                new Ul(null, {
                    className: "nav nav-tabs " + (this.verticalButtons ? "flex-column" : "") + " " + this.moreClasses,
                    id: "navTabs"
                }, this.buildTabButtons())]
            )
        ];
        return true;
    }

    buildTabButtons = (): Comp[] => {
        const items: Comp[] = [];
        getAs().tabData.forEach(tab => {
            items.push(this.getTabButton(tab));
            const tabSubOpts = tab.getTabSubOptions();
            if (tabSubOpts) {
                items.push(tabSubOpts);
            }
        });
        return items;
    }

    getTabButton(data: TabIntf): Li {
        const ast = getAs();
        let clazz = "nav-link appNavTab ui-app-tab-btn" + (ast.activeTab === data.id ? " active" : "");

        // experimental hack. Will write 'good code' for this if I like it.
        if (data.id == C.TAB_TTS && ast.speechSpeaking && !ast.speechPaused) {
            clazz += " appNavTabAttention";
        }

        return new Li(null, {
            className: "nav-item",
            style: { display: data.isVisible() ? "inline" : "none" },
            onClick: (event: Event) => {
                event.stopPropagation();
                event.preventDefault();
                PubSub.pub(C.PUBSUB_closeNavPanel);
                S.tabUtil.selectTab(data.id);
            }
        }, [
            new Anchor("#" + data.id, data.name, {
                "data-bs-toggle": "tab",
                className: "nav-link appNavTab ui-app-tab-btn" + (ast.activeTab === data.id ? " active" : ""),
                title: data.tooltip
            })
        ]);
    }
}

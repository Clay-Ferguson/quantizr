import { getAs } from "../AppContext";
import { Anchor } from "../comp/core/Anchor";
import { Div } from "../comp/core/Div";
import { Constants as C } from "../Constants";
import { TabBase } from "../intf/TabBase";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { Li } from "./core/Li";
import { Ul } from "./core/Ul";

export class TabPanelButtons extends Comp {
    constructor(private verticalButtons: boolean, public moreClasses: string = "") {
        super();
    }

    override preRender(): boolean | null {
        this.children = [
            new Div(null, {
                className: "tabButtonsContainer"
            }, [
                new Ul(null, {
                    className: (this.verticalButtons ? "tw-flex tw-flex-col" : "") + " " + this.moreClasses,
                    id: "navTabs"
                }, this.buildTabButtons())]
            )
        ];
        return true;
    }

    buildTabButtons(): Comp[] {
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

    getTabButton(data: TabBase): Li {
        const ast = getAs();
        let clazz = "appNavTab ui-app-tab-btn" + (ast.activeTab === data.id ? " active" : "");

        // experimental hack. Will write 'good code' for this if I like it.
        if (data.id == C.TAB_TTS && ast.speechSpeaking && !ast.speechPaused) {
            clazz += " appNavTabAttention";
        }

        return new Li(null, {
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
                className: "appNavTab ui-app-tab-btn" + (ast.activeTab === data.id ? " active" : ""),
                title: data.tooltip
            })
        ]);
    }
}

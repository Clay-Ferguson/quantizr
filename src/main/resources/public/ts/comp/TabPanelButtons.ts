import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Anchor } from "../comp/core/Anchor";
import { Div } from "../comp/core/Div";
import { Constants as C } from "../Constants";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Comp } from "./base/Comp";
import { Li } from "./core/Li";
import { Ul } from "./core/Ul";
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

    buildTabButtons = (state: AppState): Comp[] => {
        let items: Comp[] = [];
        for (let tab of state.tabData) {
            items.push(this.getTabButton(state, tab));

            let tabSubOptions = this.getTabSubOptions(state, tab);
            if (tabSubOptions) {
                items.push(tabSubOptions);
            }
        }
        return items;
    }

    getTabSubOptions(state: AppState, data: TabDataIntf): Div {
        let tabName = data.name;

        // todo-1: temp hack for POC (we can move this to a callback on the TabDataIntf to create this extra Div for any tab)
        if (!state.isAnonUser) {
            if (tabName === "Feed" /* This would make it show up only when Feed is active: && S.quanta.activeTab === C.TAB_FEED */) {
                return new Div(null, { className: "tabSubOptions" }, [
                    new Div("To/From Me", { className: "tabSubOptionsItem", onClick: S.nav.messagesToFromMe }),
                    new Div("To Me", { className: "tabSubOptionsItem", onClick: S.nav.messagesToMe }),
                    new Div("From Me", { className: "tabSubOptionsItem", onClick: S.nav.messagesFromMe }),
                    new Div("From Friends", { className: "tabSubOptionsItem", onClick: S.nav.messagesFromFriends }),
                    // We need to make this a configurable option.
                    // new MenuItem("From Local Users", S.nav.messagesLocal),
                    new Div("Public Fediverse", { className: "tabSubOptionsItem", onClick: S.nav.messagesFediverse })
                ]);
            }
            else if (tabName === "Tree") {
                return new Div(null, { className: "tabSubOptions" }, [
                    new Div("My Root", { className: "tabSubOptionsItem", onClick: () => S.nav.navHome(state) }),
                    new Div("My Home", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode(":" + state.userName + ":home") }),
                    new Div("My Posts", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode("~" + J.NodeType.POSTS) })
                ]);
            }
        }

        // todo-1: the hardcoded types in here are ugly. fix it.
        if (tabName === "Trending" /* This would make it show up only when Feed is active: && S.quanta.activeTab === C.TAB_FEED */) {
            return new Div(null, { className: "tabSubOptions" }, [
                new Div("Hashtags", { className: "tabSubOptionsItem", onClick: S.nav.showTrendingHashtags }),
                new Div("Mentions", { className: "tabSubOptionsItem", onClick: S.nav.showTrendingMentions }),
                new Div("Words", { className: "tabSubOptionsItem", onClick: S.nav.showTrendingWords })
            ]);
        }

        return null;
    }

    getTabButton(state: AppState, data: TabDataIntf): Li {
        let tabName = data.name;
        let feedData: TabDataIntf = S.tabUtil.getTabDataById(state, C.TAB_FEED);

        // slight hack until we have 'name' as a function and not a string.
        if (tabName === "Feed" && feedData?.props?.feedFilterRootNode) {
            tabName = "Feed (Chat Room)";
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

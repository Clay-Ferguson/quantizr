import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { PubSub } from "../../PubSub";
import { S } from "../../Singletons";
import { MainTabComp } from "../MainTabComp";

export class MainTabCompData implements TabIntf {
    name = "Quanta";
    tooltip = "Quanta global tree-like Database";
    id = C.TAB_MAIN;
    rsInfo = null;
    scrollPos = 0;
    props = {};
    openGraphComps = [];

    isVisible = (state: AppState) => true;
    constructView = (data: TabIntf) => new MainTabComp(data);

    getTabSubOptions = (state: AppState): Div => {
        return new Div(null, { className: "tabSubOptions" }, [
            !state.isAnonUser ? new Div("My Account", {
                className: "tabSubOptionsItem", onClick: () => {
                    PubSub.pub(C.PUBSUB_navAction);
                    S.nav.navHome(state);
                }
            }) : null,
            !state.isAnonUser ? new Div("My Home", {
                className: "tabSubOptionsItem", onClick: () => {
                    PubSub.pub(C.PUBSUB_navAction);
                    S.nav.openContentNode(":" + state.userName + ":home");
                }
            }) : null,
            !state.isAnonUser ? new Div("My Posts", {
                className: "tabSubOptionsItem", onClick: () => {
                    PubSub.pub(C.PUBSUB_navAction);
                    S.nav.openContentNode("~" + J.NodeType.POSTS);
                }
            }) : null,
            ...this.customAnonRHSLinks(state)
        ]);
    };

    // Put these directly here on main page for non-logged in users, becasue we definitely cannot expect these users to click hru to
    // the help menu to find these at least until they've signed up, but once signed up having these here becomes an annoyance.
    customAnonRHSLinks = (state: AppState): Div[] => {
        let items: Div[] = [];

        // if not anon user return empty items
        if (!state.isAnonUser) return items;

        if (state.config?.rhsAnonLinks) {
            for (let menuItem of state.config.rhsAnonLinks) {
                if (menuItem.name === "separator") {
                    // items.push(new MenuItemSeparator());
                }
                else {
                    let link: string = menuItem.link;
                    let func: Function = null;

                    if (link) {
                        // allows ability to select a tab
                        if (link.startsWith("tab:")) {
                            let tab = link.substring(4);

                            /* special case for feed tab */
                            if (tab === C.TAB_FEED) {
                                func = S.nav.messagesFediverse;
                            }
                            else {
                                func = () => S.tabUtil.selectTab(tab);
                            }
                        }
                        // covers http and https
                        else if (link.startsWith("http")) {
                            func = () => window.open(link);
                        }
                        // named nodes like ":myName"
                        else {
                            func = () => S.nav.openContentNode(link);
                        }
                    }

                    items.push(new Div(menuItem.name, {
                        className: "tabSubOptionsItem", onClick: () => {
                            PubSub.pub(C.PUBSUB_navAction);
                            func();
                        }
                    }));
                }
            }
        }
        return items;
    }
}

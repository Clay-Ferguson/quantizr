import { useSelector } from "react-redux";
import { dispatch } from "../AppRedux";
import { AppState } from "../AppState";
import clientInfo from "../ClientInfo";
import { FeedView } from "../comps/FeedView";
import { MainTabComp } from "../comps/MainTabComp";
import { SearchView } from "../comps/SearchView";
import { TimelineView } from "../comps/TimelineView";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "./Anchor";
import { Div } from "./Div";
import { Li } from "./Li";
import { Ul } from "./Ul";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TabPanel extends Div {

    constructor() {
        super(null);

        if (clientInfo.isMobile) {
            this.attribs.className = "col-12";
        }
        else {
            this.attribs.className = "col-" + C.mainPanelCols + " offset-" + C.leftNavPanelCols;
        }
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let searchResults = state.searchResults;
        let timelineResults = state.timelineResults;
        let feedResults = state.feedResults;

        let mainDisplay = "inline";
        let searchDisplay = searchResults ? "inline" : "none";
        let timelineDisplay = timelineResults ? "inline" : "none";
        let feedDisplay = feedResults ? "inline" : "none";

        /* If mainDisplay would be the only tab showing, then don't show that tab */
        if (searchDisplay == "none" && timelineDisplay == "none" && feedDisplay == "none") {
            mainDisplay = "none";
        }

        //the row of buttons that ARE the tabs where you click to change tabs.
        let tabButtons = new Div(null, {
            className: "row tab-buttons-container"
        }, [
            new Ul(null, {
                className: "nav nav-tabs",
                style: { marginLeft: '15px' },
                id: "navTabs"
            },
                /* These 'li' (list item) elements hold the tab bar that goes across the top of every page */
                [new Li(null, {
                    className: "nav-item",
                    style: { display: mainDisplay }
                }, [
                    new Anchor("#mainTab", "Main", {
                        "data-toggle": "tab",
                        className: "nav-link" + (state.activeTab == "mainTab" ? " active" : ""),
                        onClick: () => {
                            dispatch({
                                type: "Action_SetTab",
                                update: (s: AppState): void => {
                                    s.activeTab = "mainTab";
                                }
                            });
                        }
                    })]
                ),

                new Li(null, {
                    className: "nav-item",
                    style: { display: searchDisplay }
                },
                    [new Anchor("#searchTab", "Search", {
                        "data-toggle": "tab",
                        className: "nav-link" + (state.activeTab == "searchTab" ? " active" : ""),
                        onClick: () => {
                            dispatch({
                                type: "Action_SetTab",
                                update: (s: AppState): void => {
                                    s.activeTab = "searchTab";
                                }
                            });
                        }
                    })]
                ),

                new Li(null, {
                    className: "nav-item",
                    style: { display: timelineDisplay }
                },
                    [new Anchor("#timelineTab", "Timeline", {
                        "data-toggle": "tab",
                        className: "nav-link" + (state.activeTab == "timelineTab" ? " active" : ""),
                        onClick: () => {
                            dispatch({
                                type: "Action_SetTab",
                                update: (s: AppState): void => {
                                    s.activeTab = "timelineTab";
                                }
                            });
                        }
                    })]
                ),

                new Li(null, {
                    className: "nav-item",
                    style: { display: feedDisplay }
                },
                    [new Anchor("#feedTab", "Feed", {
                        "data-toggle": "tab",
                        className: "nav-link" + (state.activeTab == "feedTab" ? " active" : ""),
                        onClick: () => {
                            dispatch({
                                type: "Action_SetTab",
                                update: (s: AppState): void => {
                                    s.activeTab = "feedTab";
                                }
                            });
                        }
                    })]
                ),
                ]
            )]
        );

        //Tab content below buttons
        let tabContent = new Div(null, {
            className: "row tab-content",
            // id: "mainScrollingArea",
            role: "main",
        }, [
            new MainTabComp(),
            new SearchView(),
            new TimelineView(),
            new FeedView(),
        ]);

        this.setChildren([
            tabButtons, tabContent
        ]);
    }
}

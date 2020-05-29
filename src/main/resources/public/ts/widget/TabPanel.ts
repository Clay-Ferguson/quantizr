import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Div } from "./Div";
import { Ul } from "./Ul";
import { Li } from "./Li";
import { Anchor } from "./Anchor";
import { MainTabComp } from "../comps/MainTabComp";
import { SearchView } from "../comps/SearchView";
import { TimelineView } from "../comps/TimelineView";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "../AppState";
import { dispatch } from "../AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class TabPanel extends Div {

    constructor() {
        super(null);
        this.attribs.className = "col-" + C.mainPanelCols + " offset-" + C.leftNavPanelCols;
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let searchResults = state.searchResults;
        let timelineResults = state.timelineResults;

        let mainDisplay = "inline";
        let searchDisplay = searchResults ? "inline" : "none";
        let timelineDisplay = timelineResults ? "inline" : "none";

        /* If mainDisplay would be the only tab showing, then don't show that tab */
        if (searchDisplay == "none" && timelineDisplay == "none") {
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

                    // This works perfectly, but isn't ready to deploy yet.
                    // new Li(null, {
                    //     className: "nav-item",
                    // },
                    //     [new Anchor("#graphTab", "Graph", {
                    //         "data-toggle": "tab",
                    //         className: "nav-link",
                    //         onClick: () => S.meta64.rebuildTab("graphTab")
                    //     })]
                    // )
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

            // This works perfectly, but isn't ready to deploy yet.
            // //GRAPH TAB
            // //------------
            // new Div(null, {
            //     id: "graphTab",
            //     className: "tab-pane fade"
            // }, [
            //         new GraphPanel()
            //     ]
            // )
        ]
        );

        this.setChildren([
            tabButtons, tabContent
        ]);
    }
}

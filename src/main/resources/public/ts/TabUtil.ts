import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { CompIntf } from "./comp/base/CompIntf";
import { Constants as C } from "./Constants";
import { TabIntf } from "./intf/TabIntf";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";
import { FeedViewData } from "./tabs/data/FeedViewData";
import { FollowersResultSetViewData } from "./tabs/data/FollowersResultSetViewData";
import { FollowingResultSetViewData } from "./tabs/data/FollowingResultSetViewData";
import { MainTabCompData } from "./tabs/data/MainTabCompData";
import { MFSViewData } from "./tabs/data/MFSViewData";
import { SearchResultSetViewData } from "./tabs/data/SearchResultSetViewData";
import { ServerInfoViewData } from "./tabs/data/ServerInfoViewData";
import { SharedNodesResultSetViewData } from "./tabs/data/SharedNodesResultSetViewData";
import { ThreadViewData } from "./tabs/data/ThreadViewData";
import { TimelineResultSetViewData } from "./tabs/data/TimelineResultSetViewData";
import { TrendingViewData } from "./tabs/data/TrendingViewData";

export class TabUtil {
    selectTab = (tabName: string): void => {
        /* if tab is already active no need to update state now

        SOME codepaths like (openNode) are currently relying on selectTab
        to cause the dispatch/update, even when tab isn't changing, so need
        to find all those before we can optimize here to ignore setting to same tab.
        */
        // if (state.activeTab==tabName) return;

        dispatch("Action_SelectTab", (s: AppState): AppState => {
            if (tabName === C.TAB_MAIN && !s.node) {
                S.nav.navHome(s);
            }
            else {
                s.guiReady = true;
                this.tabChanging(s.activeTab, tabName, s);
                s.activeTab = S.quanta.activeTab = tabName;
            }
            return s;
        });
    }

    /* Does a select tab that's safe within a dispatch (i.e. doesn't itself dispatch) */
    selectTabStateOnly = (tabName: string, state: AppState): void => {
        if (tabName === C.TAB_MAIN && !state.node) {

            // we need to run immediately but in a timer so it doesn't happen in this call stack and trigger
            // an error that we did a dispatch in a dispatch.
            setTimeout(() => {
                S.nav.navHome(null);
            }, 1);
        }
        else {
            this.tabChanging(state.activeTab, tabName, state);
            state.activeTab = S.quanta.activeTab = tabName;
        }
    }

    createAppTabs = (): void => {
        dispatch("Action_initTabs", (s: AppState): AppState => {
            s.tabData = [
                new MainTabCompData(),
                new SearchResultSetViewData(),
                new SharedNodesResultSetViewData(),
                new TimelineResultSetViewData(),
                new FollowersResultSetViewData(),
                new FollowingResultSetViewData(),
                new FeedViewData(),
                new MFSViewData(),

                // DO NOT DELETE
                // The IPSMView will be repurposed as a server event log viewer
                // {
                //     name: "IPSM Console",
                //     id: C.TAB_IPSM,
                //     isVisible: () => {
                //         let state: AppState = store.getState();
                //         return state.ipsmActive;
                //     },
                //     constructView: (data: TabIntf) => new IPSMView(s, data),
                //     rsInfo: null,
                //     scrollPos: 0,
                //     // need typesafe props (todo-2)
                //     props: {
                //         events: null // for now string[]
                //     }
                // },

                new TrendingViewData(),
                new ThreadViewData(),
                new ServerInfoViewData()

                // this is throwing a react error, but we don't need this now anyaay
                // {
                //     name: "Log",
                //     id: C.TAB_LOG,
                //     isVisible: () => {
                //         // this function needs to get the state itself.
                //         let state = store.getState();
                //         return state.isAdminUser;
                //     },
                //     constructView: (data: TabIntf) => new LogView(data),
                //     rsInfo: null,
                //     props: {}
                // }
            ];
            return s;
        });
    }

    getTabDataById = (state: AppState, id: string): TabIntf => {
        if (!state) {
            state = store.getState();
        }
        let data = state.tabData.find(d => d.id === id);
        return data;
    }

    getActiveTabComp = (state: AppState): CompIntf => {
        if (!state.tabData) return null;
        let data = state.tabData.find(d => d.id === state.activeTab);
        return data ? data.inst : null;
    }

    tabScroll = (state: AppState, tabName: string, pos: number) => {
        if (C.DEBUG_SCROLLING) {
            console.log("Scrolling tab " + tabName + " to offset " + pos);
        }
        let data = state.tabData.find(d => d.id === tabName);
        if (data) {
            data.scrollPos = pos;
        }
    }

    resultSetHasData = (id: string) => {
        let state: AppState = store.getState();
        let data = state.tabData.find(d => d.id === id);
        return data && data.rsInfo && data.rsInfo.results && data.rsInfo.results.length > 0;
    }

    /* This function manages persisting the scroll position when switching
    from one tab to another, to automatically restore the scroll position that was
    last scroll position on any given tab */
    tabChanging = (prevTab: string, newTab: string, state: AppState): void => {

        /* Don't run any code here if we aren't actually changing tabs */
        if (prevTab && newTab && prevTab === newTab) {
            return;
        }

        // Log.log("Changing from tab: " + prevTab + " to " + newTab);
        PubSub.pub(C.PUBSUB_tabChanging, newTab);
    }
}

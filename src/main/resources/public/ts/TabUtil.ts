import { dispatch, getAppState } from "./AppContext";
import { AppState } from "./AppState";
import { AppTab } from "./comp/AppTab";
import { Constants as C } from "./Constants";
import { TabIntf } from "./intf/TabIntf";
import { PubSub } from "./PubSub";
import { S } from "./Singletons";
import { DocumentTab } from "./tabs/data/DocumentTab";
import { FeedTab } from "./tabs/data/FeedTab";
import { FollowersTab } from "./tabs/data/FollowersTab";
import { FollowingTab } from "./tabs/data/FollowingTab";
import { IPFSTab } from "./tabs/data/IPFSTab";
import { MainTab } from "./tabs/data/MainTab";
import { SearchTab } from "./tabs/data/SearchTab";
import { ServerInfoTab } from "./tabs/data/ServerInfoTab";
import { SharesTab } from "./tabs/data/SharesTab";
import { ThreadTab } from "./tabs/data/ThreadTab";
import { TimelineTab } from "./tabs/data/TimelineTab";
import { TrendingTab } from "./tabs/data/TrendingTab";

export class TabUtil {
    selectTab = (tabName: string) => {
        /* if tab is already active no need to update state now

        SOME codepaths like (openNode) are currently relying on selectTab
        to cause the dispatch/update, even when tab isn't changing, so need
        to find all those before we can optimize here to ignore setting to same tab.
        */
        // if (state.activeTab==tabName) return;
        dispatch("SelectTab", s => {
            if (tabName === C.TAB_MAIN && !s.node) {
                S.nav.navHome(s);
            }
            else {
                // todo-1: there are lots of places we set 'activeTab = ?' and we need to combine it all into a function
                // that does JUST these two lines
                this.tabChanging(s.activeTab, tabName, s);
                s.activeTab = S.quanta.activeTab = tabName;
            }
            return s;
        });
    }

    /* Does a select tab that's safe within a dispatch (i.e. doesn't itself dispatch) */
    selectTabStateOnly = (tabName: string, state: AppState) => {
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

    createAppTabs = () => {
        dispatch("initTabs", s => {
            s.tabData = [
                new MainTab(),
                new DocumentTab(),
                new SearchTab(),
                new SharesTab(),
                new TimelineTab(),
                new FollowersTab(),
                new FollowingTab(),
                new FeedTab(),

                // DO NOT DELETE
                // The IPSMView will be repurposed as a server event log viewer
                // {
                //     name: "IPSM Console",
                //     id: C.TAB_IPSM,
                //     isVisible: () => {
                //         let state = getAppState();
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

                new TrendingTab(),
                new ThreadTab(),
                new ServerInfoTab(),
                new IPFSTab()

                // this is throwing a react error, but we don't need this now anyaay
                // {
                //     name: "Log",
                //     id: C.TAB_LOG,
                //     isVisible: () => {
                //         // this function needs to get the state itself.
                //         let state = getAppState();
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

    getActiveTabComp = (state: AppState): AppTab => {
        if (!state.tabData) return null;
        const data = state.tabData.find(d => d.id === state.activeTab);
        return data ? data.inst : null;
    }

    getAppTabInst = (state: AppState, tabId: string): AppTab => {
        if (!state.tabData) return null;
        const data = state.tabData.find(d => d.id === tabId);
        return data ? data.inst : null;
    }

    getAppTabData = (state: AppState, tabId: string): TabIntf => {
        if (!state.tabData) return null;
        return state.tabData.find(d => d.id === tabId);
    }

    tabScroll = (state: AppState, tabName: string, pos: number) => {
        if (C.DEBUG_SCROLLING) {
            console.log("Scrolling tab " + tabName + " to offset " + pos);
        }
        const data = state.tabData.find(d => d.id === tabName);
        if (data) {
            data.scrollPos = pos;
        }
    }

    // WARNING: This won't apply to (or work) for feed view which has different prop than 'results'
    resultSetHasData = (id: string) => {
        const state = getAppState();
        const data = state.tabData.find(d => d.id === id);
        return data?.props?.results?.length > 0;
    }

    /* This function manages persisting the scroll position when switching
    from one tab to another, to automatically restore the scroll position that was
    last scroll position on any given tab */
    tabChanging = (prevTab: string, newTab: string, state: AppState) => {

        /* Don't run any code here if we aren't actually changing tabs */
        if (prevTab && newTab && prevTab === newTab) {
            return;
        }

        // console.log("Sending tabChange event: " + newTab);

        // Log.log("Changing from tab: " + prevTab + " to " + newTab);
        PubSub.pub(C.PUBSUB_tabChanging, newTab);
    }
}

import { dispatch, store } from "./AppRedux";
import { AppState } from "./AppState";
import { CompIntf } from "./comp/base/CompIntf";
import { Div } from "./comp/core/Div";
import { Constants as C } from "./Constants";
import { FollowersRSInfo } from "./FollowersRSInfo";
import { FollowingRSInfo } from "./FollowingRSInfo";
import { TabIntf } from "./intf/TabIntf";
import * as J from "./JavaIntf";
import { PubSub } from "./PubSub";
import { ResultSetInfo } from "./ResultSetInfo";
import { SharesRSInfo } from "./SharesRSInfo";
import { S } from "./Singletons";
import { FeedView } from "./tabs/FeedView";
import { FeedViewProps } from "./tabs/FeedViewProps";
import { FollowersResultSetView } from "./tabs/FollowersResultSetView";
import { FollowingResultSetView } from "./tabs/FollowingResultSetView";
import { MainTabComp } from "./tabs/MainTabComp";
import { SearchResultSetView } from "./tabs/SearchResultSetView";
import { ServerInfoView } from "./tabs/ServerInfoView";
import { SharedNodesResultSetView } from "./tabs/SharedNodesResultSetView";
import { ThreadView } from "./tabs/ThreadView";
import { TimelineResultSetView } from "./tabs/TimelineResultSetView";
import { TrendingView } from "./tabs/TrendingView";
import { ThreadRSInfo } from "./ThreadRSInfo";
import { TimelineRSInfo } from "./TimelineRSInfo";
import { TrendingRSInfo } from "./TrendingRSInfo";
import { ValidatedState } from "./ValidatedState";

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
                {
                    name: "Tree",
                    id: C.TAB_MAIN,
                    isVisible: () => true,
                    constructView: (data: TabIntf) => new MainTabComp(s, data),
                    getTabSubOptions: (state: AppState): Div => {
                        return !state.isAnonUser
                            ? new Div(null, { className: "tabSubOptions" }, [
                                new Div("My Root", { className: "tabSubOptionsItem", onClick: () => S.nav.navHome(state) }),
                                new Div("My Home", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode(":" + state.userName + ":home") }),
                                new Div("My Posts", { className: "tabSubOptionsItem", onClick: () => S.nav.openContentNode("~" + J.NodeType.POSTS) })
                            ]) : null;
                    },
                    rsInfo: null,
                    scrollPos: 0,
                    props: {},
                    openGraphComps: []
                },
                {
                    name: "Search",
                    id: C.TAB_SEARCH,
                    isVisible: () => this.resultSetHasData(C.TAB_SEARCH),
                    constructView: (data: TabIntf) => new SearchResultSetView(s, data),
                    getTabSubOptions: (state: AppState): Div => { return null; },
                    rsInfo: new ResultSetInfo(),
                    scrollPos: 0,
                    props: {},
                    openGraphComps: []
                },
                {
                    name: "Shared Nodes",
                    id: C.TAB_SHARES,
                    isVisible: () => this.resultSetHasData(C.TAB_SHARES),
                    constructView: (data: TabIntf) => new SharedNodesResultSetView<SharesRSInfo>(s, data),
                    getTabSubOptions: (state: AppState): Div => { return null; },
                    rsInfo: new SharesRSInfo(),
                    scrollPos: 0,
                    props: {},
                    openGraphComps: []
                },
                {
                    name: "Timeline",
                    id: C.TAB_TIMELINE,
                    isVisible: () => this.resultSetHasData(C.TAB_TIMELINE),
                    constructView: (data: TabIntf) => new TimelineResultSetView<TimelineRSInfo>(s, data),
                    getTabSubOptions: (state: AppState): Div => { return null; },
                    rsInfo: new TimelineRSInfo(),
                    scrollPos: 0,
                    props: {},
                    openGraphComps: []
                },
                {
                    name: "Followers",
                    id: C.TAB_FOLLOWERS,
                    isVisible: () => this.resultSetHasData(C.TAB_FOLLOWERS),
                    constructView: (data: TabIntf) => new FollowersResultSetView<FollowersRSInfo>(s, data),
                    getTabSubOptions: (state: AppState): Div => { return null; },
                    rsInfo: new FollowersRSInfo(),
                    scrollPos: 0,
                    props: {},
                    openGraphComps: []
                },
                {
                    name: "Following",
                    id: C.TAB_FOLLOWING,
                    isVisible: () => this.resultSetHasData(C.TAB_FOLLOWING),
                    constructView: (data: TabIntf) => new FollowingResultSetView<FollowingRSInfo>(s, data),
                    getTabSubOptions: (state: AppState): Div => { return null; },
                    rsInfo: new FollowingRSInfo(),
                    scrollPos: 0,
                    props: {},
                    openGraphComps: []
                },
                {
                    name: "Feed",
                    id: C.TAB_FEED,
                    isVisible: () => true,
                    constructView: (data: TabIntf<FeedViewProps>) => new FeedView(s, data),
                    getTabSubOptions: (state: AppState): Div => {
                        return !state.isAnonUser
                            ? new Div(null, { className: "tabSubOptions" }, [
                                new Div("To/From Me", { className: "tabSubOptionsItem", onClick: S.nav.messagesToFromMe }),
                                new Div("To Me", { className: "tabSubOptionsItem", onClick: S.nav.messagesToMe }),
                                new Div("From Me", { className: "tabSubOptionsItem", onClick: S.nav.messagesFromMe }),
                                new Div("From Friends", { className: "tabSubOptionsItem", onClick: S.nav.messagesFromFriends }),
                                // We need to make this a configurable option.
                                // new MenuItem("From Local Users", S.nav.messagesLocal),
                                new Div("Public Fediverse", { className: "tabSubOptionsItem", onClick: S.nav.messagesFediverse })
                            ]) : null;
                    },
                    rsInfo: null,
                    scrollPos: 0,
                    props: {
                        page: 0,
                        refreshCounter: 0,
                        autoRefresh: true,
                        searchTextState: new ValidatedState<any>(),

                        feedFilterFriends: false,
                        feedFilterToMe: false,
                        feedFilterFromMe: false,
                        feedFilterToUser: null,
                        feedFilterToPublic: true,
                        feedFilterLocalServer: false,

                        /* If we're presenting a specific node as the root of our "Feed" view this holds it's id, otherwise
                         for any non-node specific feed query this stays null. */
                        feedFilterRootNode: null,

                        feedDirty: false,
                        feedLoading: false,
                        feedResults: null,
                        feedEndReached: false
                    },
                    openGraphComps: []
                },
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
                {
                    name: "Trending",
                    id: C.TAB_TRENDING,
                    isVisible: () => true,
                    constructView: (data: TabIntf) => new TrendingView(s, data),
                    getTabSubOptions: (state: AppState): Div => {
                        return new Div(null, { className: "tabSubOptions" }, [
                            new Div("Hashtags", { className: "tabSubOptionsItem", onClick: S.nav.showTrendingHashtags }),
                            new Div("Mentions", { className: "tabSubOptionsItem", onClick: S.nav.showTrendingMentions }),
                            new Div("Words", { className: "tabSubOptionsItem", onClick: S.nav.showTrendingWords })
                        ]);
                    },
                    rsInfo: new TrendingRSInfo(),
                    scrollPos: 0,

                    // supports props.filter = hashtags, users, words
                    props: {},
                    openGraphComps: []
                },
                {
                    name: "Thread",
                    id: C.TAB_THREAD,
                    isVisible: () => {
                        let state: AppState = store.getState();
                        return !!state.threadViewNodeId;
                    },
                    constructView: (data: TabIntf) => new ThreadView(s, data),
                    getTabSubOptions: (state: AppState): Div => { return null; },
                    rsInfo: new ThreadRSInfo(),
                    scrollPos: 0,
                    props: {},
                    openGraphComps: []
                },
                {
                    name: "Server Info",
                    id: C.TAB_SERVERINFO,
                    isVisible: () => {
                        let state: AppState = store.getState();
                        return !!state.serverInfoText;
                    },
                    constructView: (data: TabIntf) => new ServerInfoView(s, data),
                    getTabSubOptions: (state: AppState): Div => { return null; },
                    rsInfo: null,
                    scrollPos: 0,
                    props: {},
                    openGraphComps: []
                }

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

    resultSetHasData = (id: string) => {
        let state: AppState = store.getState();
        let data = state.tabData.find(d => d.id === id);
        return data && data.rsInfo && data.rsInfo.results && data.rsInfo.results.length > 0;
    }
}

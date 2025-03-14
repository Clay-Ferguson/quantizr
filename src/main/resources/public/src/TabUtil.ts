import { dispatch, getAs, promiseDispatch } from "./AppContext";
import { AppState } from "./AppState";
import { AppTab } from "./comp/AppTab";
import { Constants as C } from "./Constants";
import { TabBase } from "./intf/TabBase";
import { S } from "./Singletons";
import { AdminTab } from "./tabs/data/AdminTab";
import { DocumentTab } from "./tabs/data/DocumentTab";
import { FeedTab } from "./tabs/data/FeedTab";
import { FollowersTab } from "./tabs/data/FollowersTab";
import { FollowingTab } from "./tabs/data/FollowingTab";
import { GraphTab } from "./tabs/data/GraphTab";
import { MainTab } from "./tabs/data/MainTab";
import { RepliesTab } from "./tabs/data/RepliesTab";
import { RSSTab } from "./tabs/data/RSSTab";
import { SearchTab } from "./tabs/data/SearchTab";
import { ServerInfoTab } from "./tabs/data/ServerInfoTab";
import { SettingsTab } from "./tabs/data/SettingsTab";
import { SharesTab } from "./tabs/data/SharesTab";
import { ThreadTab } from "./tabs/data/ThreadTab";
import { TimelineTab } from "./tabs/data/TimelineTab";
import { StatisticsTab } from "./tabs/data/StatisticsTab";
import { TTSTab } from "./tabs/data/TTSTab";
import { AudioPlayerTab } from "./tabs/data/AudioPlayerTab";

export class TabUtil {
    selectTab(tabName: string) {
        if (!tabName) return;
        /* if tab is already active no need to update state now

        SOME codepaths like (openNode) are currently relying on selectTab to cause the
        dispatch/update, even when tab isn't changing, so need to find all those before we can
        optimize here to ignore setting to same tab.
        */
        dispatch("SelectTab", s => {
            if (tabName === C.TAB_MAIN && !s.node) {
                S.nav._navToMyAccntRoot();
            }
            else {
                this.tabChanging(s.activeTab, tabName);
                s.activeTab = tabName;
            }
        });
    }

    makeDomIdForNode(tabData: TabBase<any>, id: string) {
        return tabData.id + id;
    }

    /* Does a select tab that's safe within a dispatch (i.e. doesn't itself dispatch) */
    selectTabStateOnly(tabName: string) {
        const ast = getAs();
        if (tabName === C.TAB_MAIN && !ast.node) {

            // we need to run immediately but in a timer so it doesn't happen in this call stack and
            // trigger an error that we did a dispatch in a dispatch.
            setTimeout(() => {
                S.nav._navToMyAccntRoot();
            }, 1);
        }
        else {
            this.tabChanging(ast.activeTab, tabName);
            dispatch("SetActiveTab", s => s.activeTab = tabName);
        }
    }

    async createAppTabs() {
        await promiseDispatch("initTabs", s => {
            s.tabData = [];
            s.tabData.push(new GraphTab());
            s.tabData.push(new MainTab());
            s.tabData.push(new DocumentTab());
            s.tabData.push(new SearchTab());
            s.tabData.push(new SharesTab());
            s.tabData.push(new TimelineTab());
            s.tabData.push(new FollowersTab());
            s.tabData.push(new FollowingTab());
            if (S.quanta.config?.multiUserEnabled) {
                s.tabData.push(new FeedTab());
            }
            s.tabData.push(new RepliesTab());
            s.tabData.push(new ThreadTab());
            s.tabData.push(new StatisticsTab());
            s.tabData.push(new ServerInfoTab());
            s.tabData.push(new TTSTab());
            s.tabData.push(new RSSTab());
            s.tabData.push(new SettingsTab());
            s.tabData.push(new AudioPlayerTab());
            s.tabData.push(new AdminTab());

            // this is throwing a react error, but we don't need this now anyaay
            // {
            //     name: "Log",
            //     id: C.TAB_LOG,
            //     isVisible: () => {
            //         // this function needs to get the state itself.
            //         let ast = getAst();
            //         return ast.isAdminUser;
            //     },
            //     constructView: (data: TabIntf) => new LogView(data),
            //     rsInfo: null,
            //     props: {}
            // }
        });
    }

    getActiveTabComp(): AppTab {
        const ast = getAs();
        if (!ast.tabData) return null;
        const data = ast.tabData.find(d => d.id === ast.activeTab);
        return data ? data.inst : null;
    }

    // ast param is important because sometimes we do pass in an 'ast' that's not 'committed' yet
    // for this method to use, and in that case we can't call getAs() to get state
    getAppTabData(tabId: string, ast: AppState = null): TabBase {
        ast = ast || getAs();
        if (!ast.tabData) return null;
        return ast.tabData.find(d => d.id === tabId);
    }

    tabScroll(tabName: string, pos: number) {
        if (C.DEBUG_SCROLLING) {
            console.log("Scrolling tab " + tabName + " to offset " + pos);
        }
        const data = getAs().tabData.find(d => d.id === tabName);
        if (data) {
            data.scrollPos = pos;
        }
    }

    // WARNING: This won't apply to (or work) for feed view which has different prop than 'results'
    resultSetHasData(id: string) {
        const ast = getAs();
        const data = ast.tabData.find(d => d.id === id);
        return data?.props?.results?.length > 0;
    }

    tabChanging(prevTab: string, newTab: string) {
        /* Don't run any code here if we aren't actually changing tabs */
        if (prevTab && newTab && prevTab === newTab) {
            return;
        }
        const data = getAs().tabData.find(d => d.id === newTab);
        if (data) {
            data.onActivate();
        }
    }
}

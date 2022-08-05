import { AppState } from "../../AppState";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { ValidatedState } from "../../ValidatedState";
import { FeedView } from "../FeedView";
import { FeedViewProps } from "../FeedViewProps";

export class FeedViewData implements TabIntf {
    name = "Feed";
    tooltip = "Reverse-chronological list of Fediverse posts";
    id = C.TAB_FEED;
    rsInfo: any = null;
    scrollPos = 0;
    props = {
        page: 0,
        refreshCounter: 0,
        autoRefresh: true,
        searchTextState: new ValidatedState<any>(),
        feedFilterFriends: false,
        feedFilterToMe: false,
        feedFilterFromMe: false,
        feedFilterToUser: null as any, // todo-0: why is 'as any' needed
        feedFilterToPublic: true,
        feedFilterLocalServer: false,
        applyAdminBlocks: true,

        /* If we're presenting a specific node as the root of our "Feed" view this holds it's id, otherwise
         for any non-node specific feed query this stays null. */
        feedFilterRootNode: null as any, // todo-0: why is 'as any' needed

        feedDirty: false,
        feedLoading: false,
        feedResults: null as any, // todo-0: why is 'as any' needed
        feedEndReached: false
    };

    openGraphComps: OpenGraphPanel[] = [];

    isVisible = (state: AppState) => true;
    constructView = (data: TabIntf<FeedViewProps>) => new FeedView(data);
    getTabSubOptions = (state: AppState): Div => {
        if (this.props?.feedFilterRootNode) {
            return !state.isAnonUser
                ? new Div(null, { className: "tabSubOptions" }, [
                    // we close chat by swithing user back to the Fediverse view.
                    new AppNavLink("Close Chat", S.nav.messagesFediverse)
                ]) : null;
        }
        else {
            return new Div(null, { className: "tabSubOptions" }, [
                state.isAnonUser ? null : new AppNavLink("To/From Me", S.nav.messagesToFromMe),
                state.isAnonUser ? null : new AppNavLink("To Me", S.nav.messagesToMe),
                state.isAnonUser ? null : new AppNavLink("From Me", S.nav.messagesFromMe),
                state.isAnonUser ? null : new AppNavLink("From Friends", S.nav.messagesFromFriends),
                // We need to make this a configurable option.
                // new MenuItem("From Local Users", S.nav.messagesLocal),
                new AppNavLink("Federated", S.nav.messagesFediverse)
            ]);
        }
    };
}

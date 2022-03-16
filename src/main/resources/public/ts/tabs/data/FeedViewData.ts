import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { S } from "../../Singletons";
import { ValidatedState } from "../../ValidatedState";
import { FeedView } from "../FeedView";
import { FeedViewProps } from "../FeedViewProps";

export class FeedViewData implements TabIntf {
    name = "Feed";
    id = C.TAB_FEED;
    rsInfo = null;
    scrollPos = 0;
    props = {
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
    };

    openGraphComps = [];

    isVisible = () => true;
    constructView = (data: TabIntf<FeedViewProps>) => new FeedView(data);
    getTabSubOptions = (state: AppState): Div => {
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
    };
}

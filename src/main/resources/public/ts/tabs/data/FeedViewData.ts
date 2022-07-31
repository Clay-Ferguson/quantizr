import { AppState } from "../../AppState";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { PubSub } from "../../PubSub";
import { S } from "../../Singletons";
import { ValidatedState } from "../../ValidatedState";
import { FeedView } from "../FeedView";
import { FeedViewProps } from "../FeedViewProps";

export class FeedViewData implements TabIntf {
    name = "Feed";
    tooltip = "Reverse-chronological list of Fediverse posts";
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
        applyAdminBlocks: true,

        /* If we're presenting a specific node as the root of our "Feed" view this holds it's id, otherwise
         for any non-node specific feed query this stays null. */
        feedFilterRootNode: null,

        feedDirty: false,
        feedLoading: false,
        feedResults: null,
        feedEndReached: false
    };

    openGraphComps = [];

    isVisible = (state: AppState) => true;
    constructView = (data: TabIntf<FeedViewProps>) => new FeedView(data);
    getTabSubOptions = (state: AppState): Div => {

        // todo-0: Everywhere we have the 'tabSubOptionsItem' in the code those links really need 
        // a custom Component that just takes the text, and the function parameters.
        let itemClass = state.mobileMode ? "tabSubOptionsItemMobile" : "tabSubOptionsItem";

        if (this.props?.feedFilterRootNode) {
            return !state.isAnonUser
                ? new Div(null, { className: "tabSubOptions" }, [
                    // we close chat by swithing user back to the Fediverse view.
                    new Div("Close Chat", {
                        className: itemClass, onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel);
                            S.nav.messagesFediverse();
                        }
                    })
                ]) : null;
        }
        else {
            return !state.isAnonUser
                ? new Div(null, { className: "tabSubOptions" }, [
                    new Div("To/From Me", {
                        className: itemClass, onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel);
                            S.nav.messagesToFromMe();
                        }
                    }),
                    new Div("To Me", {
                        className: itemClass, onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel);
                            S.nav.messagesToMe();
                        }
                    }),
                    new Div("From Me", {
                        className: itemClass, onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel);
                            S.nav.messagesFromMe();
                        }
                    }),
                    new Div("From Friends", {
                        className: itemClass, onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel);
                            S.nav.messagesFromFriends();
                        }
                    }),
                    // We need to make this a configurable option.
                    // new MenuItem("From Local Users", S.nav.messagesLocal),
                    new Div("Federated", {
                        className: itemClass, onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel);
                            S.nav.messagesFediverse();
                        }
                    })
                ]) : null;
        }
    };
}

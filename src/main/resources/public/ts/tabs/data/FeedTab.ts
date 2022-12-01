import { AppState } from "../../AppState";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { FeedView } from "../FeedView";
import { FeedViewProps } from "../FeedViewProps";

export class FeedTab implements TabIntf<FeedViewProps> {
    name = "Feed";
    tooltip = "Reverse-chronological list of Fediverse posts";
    id = C.TAB_FEED;
    scrollPos = 0;
    props = new FeedViewProps();
    openGraphComps: OpenGraphPanel[] = [];
    topmostVisibleElmId: string = null;

    static inst: FeedTab = null;
    constructor() {
        FeedTab.inst = this;
    }

    isVisible = (ast: AppState) => true;
    constructView = (data: TabIntf<FeedViewProps>) => new FeedView(data);

    findNode = (ast: AppState, nodeId: string): J.NodeInfo => {
        return S.util.searchNodeArray(this.props.feedResults, nodeId);
    }

    nodeDeleted = (ast: AppState, nodeId: string): void => {
        this.props.feedResults = this.props.feedResults?.filter(n => nodeId !== n.id);
    }

    replaceNode = (ast: AppState, newNode: J.NodeInfo): void => {
        this.props.feedResults = this.props.feedResults?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }

    getTabSubOptions = (ast: AppState): Div => {
        if (this.props?.feedFilterRootNode) {
            return !ast.isAnonUser
                ? new Div(null, { className: "tabSubOptions" }, [
                    // we close chat by swithing user back to the Fediverse view.
                    new AppNavLink("Close Chat", S.nav.messagesFediverse)
                ]) : null;
        }
        else {
            return new Div(null, { className: "tabSubOptions" }, [
                ast.isAnonUser ? null : new AppNavLink("To/From Me", S.nav.messagesToFromMe),
                ast.isAnonUser ? null : new AppNavLink("To Me", S.nav.messagesToMe),
                ast.isAnonUser ? null : new AppNavLink("From Me", S.nav.messagesFromMe),
                ast.isAnonUser ? null : new AppNavLink("From Friends", S.nav.messagesFromFriends),
                // todo-1: evntually we will make available to all users
                ast.isAdminUser ? new AppNavLink("Local Users", S.nav.messagesLocal) : null,
                new AppNavLink("Federated", S.nav.messagesFediverse)
            ]);
        }
    };
}

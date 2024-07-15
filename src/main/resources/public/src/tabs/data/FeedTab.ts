import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { OpenGraphPanel } from "../../comp/OpenGraphPanel";
import { Constants as C } from "../../Constants";
import { TabIntf } from "../../intf/TabIntf";
import { NodeInfo } from "../../JavaIntf";
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

    isVisible = () => !getAs().isAnonUser || getAs().isAdminUser;
    constructView = (data: TabIntf<FeedViewProps>) => new FeedView(data);

    findNode = (nodeId: string): NodeInfo => {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    findNodeByPath = (_path: string): NodeInfo => {
        return null;
    }

    nodeDeleted = (_ust: AppState, nodeId: string): void => {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode = (_ust: AppState, newNode: NodeInfo): void => {
        this.props.results = this.props.results?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }

    processNode = (_ust: AppState, func: (node: NodeInfo) => void): void => {
        this.props.results?.forEach(n => func(n));
    }

    getTabSubOptions = (): Div => {
        const ast = getAs();

        return new Div(null, { className: "tabSubOptions" }, [
            ast.isAdminUser ? new AppNavLink("Public Posts", S.nav.publicPosts) : null,

            ast.isAnonUser ? null : new AppNavLink("To/From Me", S.nav.messagesToFromMe),
            ast.isAnonUser ? null : new AppNavLink("To Me", S.nav.messagesToMe),
            ast.isAnonUser ? null : new AppNavLink("From Me", S.nav.messagesFromMe),
            ast.isAnonUser ? null : new AppNavLink("From Follows", S.nav.messagesFromFriends),
        ]);
    };
}

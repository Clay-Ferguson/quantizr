import { getAs } from "../../AppContext";
import { AppState } from "../../AppState";
import { AppNavLink } from "../../comp/core/AppNavLink";
import { Div } from "../../comp/core/Div";
import { Constants as C } from "../../Constants";
import { TabBase } from "../../intf/TabBase";
import { NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { FeedView } from "../FeedView";
import { FeedViewProps } from "../FeedViewProps";

export class FeedTab extends TabBase<FeedViewProps> {
    name = "Feed";
    tooltip = "Reverse-chronological list of posts";
    id = C.TAB_FEED;
    props = new FeedViewProps();
    static URL_PARAM = "feed";

    static inst: FeedTab = null;
    constructor() {
        super();
        FeedTab.inst = this;
    }

    isVisible() {
        return !getAs().isAnonUser || getAs().isAdminUser;
    }

    static selectIfOpened(): boolean {
        if (FeedTab.inst.isVisible()) {
            S.tabUtil.selectTab(C.TAB_FEED);
            return true;
        }
        return false;
    }

    constructView(data: TabBase<FeedViewProps>) {
        return new FeedView(data);
    }

    findNode(nodeId: string): NodeInfo {
        return S.util.searchNodeArray(this.props.results, nodeId);
    }

    nodeDeleted(_ust: AppState, nodeId: string): void {
        this.props.results = this.props.results?.filter(n => nodeId !== n.id);
    }

    replaceNode(_ust: AppState, newNode: NodeInfo): void {
        this.props.results = this.props.results?.map(n => {
            return n?.id === newNode?.id ? newNode : n;
        });
    }

    processNode(_ust: AppState, func: (node: NodeInfo) => void): void {
        this.props.results?.forEach(n => func(n));
    }

    getTabSubOptions(): Div {
        const ast = getAs();

        return new Div(null, { className: "tabSubOptions" }, [
            ast.isAdminUser ? new AppNavLink("Public Posts", S.nav._publicPosts) : null,

            ast.isAnonUser ? null : new AppNavLink("To/From Me", S.nav._messagesToFromMe),
            ast.isAnonUser ? null : new AppNavLink("To Me", S.nav._messagesToMe),
            ast.isAnonUser ? null : new AppNavLink("From Me", S.nav._messagesFromMe),
            ast.isAnonUser ? null : new AppNavLink("From Follows", S.nav._messagesFromFriends),
        ]);
    }
}

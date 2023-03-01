import { dispatch } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { Div } from "../comp/core/Div";
import { TabIntf } from "../intf/TabIntf";
import { NodeActionType } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";
import { Constants as C } from "../Constants";
import { S } from "../Singletons";

export class RssType extends TypeBase {

    constructor() {
        super(J.NodeType.RSS_FEED, "RSS Feed", "fa-rss", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo): boolean {
        switch (action) {
            case NodeActionType.upload:
                return false;
            default:
                return true;
        }
    }

    getEditLabelForProp(propName: string): string {
        if (propName === J.NodeProp.RSS_FEED_SRC) {
            return "RSS Feed URLs (one per line)";
        }
        return propName;
    }

    getEditorRowsForProp(propName: string): number {
        if (propName === J.NodeProp.RSS_FEED_SRC) {
            return 10;
        }
        return 1;
    }

    getAllowPropertyAdd(): boolean {
        return false;
    }

    getAllowContentEdit(): boolean {
        return true;
    }

    getCustomProperties(): string[] {
        return [J.NodeProp.RSS_FEED_SRC];
    }

    allowPropertyEdit(propName: string): boolean {
        return propName === J.NodeProp.RSS_FEED_SRC;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.RSS_FEED_SRC);
    }

    super_render = this.render;
    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, isLinkedNode: boolean): Comp => {
        const baseComp = this.super_render(node, tabData, rowStyling, isTreeView, isLinkedNode);
        return new Div(null, null, [
            baseComp,
            new Button("View Feed", () => {
                dispatch("LoadingFeed", s => {
                    s.rssNode = node;
                    s.activeTab = C.TAB_RSS;
                    S.domUtil.focusId(C.TAB_RSS);
                    S.tabUtil.tabScroll(C.TAB_RSS, 0);
                });
            }, null, "btn-primary marginLeft marginBottom")
        ]);
    }
}

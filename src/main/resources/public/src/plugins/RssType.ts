import { dispatch } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { Div } from "../comp/core/Div";
import { Constants as C } from "../Constants";
import { EditorOptions } from "../Interfaces";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class RssType extends TypeBase {

    constructor() {
        super(J.NodeType.RSS_FEED, "RSS Feed", "fa-rss", true);
    }

    override getEditLabelForProp(_node: NodeInfo, propName: string): string {
        if (propName === J.NodeProp.RSS_FEED_SRC) {
            return "RSS Feed URLs (one per line)";
        }
        return propName;
    }

    override getEditorRowsForProp(propName: string): number {
        if (propName === J.NodeProp.RSS_FEED_SRC) {
            return 10;
        }
        return 1;
    }

    override ensureDefaultProperties(node: NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.RSS_FEED_SRC);
    }

    override getEditorOptions(): EditorOptions {
        return {
            tags: true,
            nodeName: true,
            priority: true,
            wordWrap: true,
            encrypt: true,
        };
    }

    override getAutoExpandProps(_node: NodeInfo): boolean {
        return true;
    }

    override render(node: NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean): Comp {
        const baseComp = super.render(node, tabData, rowStyling, isTreeView);
        return new Div(null, null, [
            new Button("View Feed", () => {
                dispatch("LoadingFeed", s => {
                    s.rssNode = node;
                    s.activeTab = C.TAB_RSS;
                    S.domUtil.focusId(C.TAB_RSS);
                    S.tabUtil.tabScroll(C.TAB_RSS, 0);
                });
            }, null, "btn-primary float-end ui-rss-view-feed-btn"),
            baseComp
        ]);
    }
}

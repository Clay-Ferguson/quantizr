import { EditorOptions } from "../Interfaces";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class AIQueryType extends TypeBase {

    constructor() {
        super(J.NodeType.AI_QUERY, "AI Query", "fa-question-circle", true);
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

    // override render(node: NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean): Comp {
    //     const baseComp = super.render(node, tabData, rowStyling, isTreeView);
    //     return new Div(null, null, [
    //         new Button("View Feed", () => {
    //             dispatch("LoadingFeed", s => {
    //                 s.rssNode = node;
    //                 s.activeTab = C.TAB_RSS;
    //                 S.domUtil.focusId(C.TAB_RSS);
    //                 S.tabUtil.tabScroll(C.TAB_RSS, 0);
    //             });
    //         }, null, "-primary tw-float-right ui-rss-view-feed-btn"),
    //         baseComp
    //     ]);
    // }
}

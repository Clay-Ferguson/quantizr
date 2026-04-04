import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { Div } from "../comp/core/Div";
import { NodeCompMarkdown } from "../comp/node/NodeCompMarkdown";
import { TabBase } from "../intf/TabBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class BookmarkType extends TypeBase {
    constructor() {
        super(J.NodeType.BOOKMARK, "Bookmark", "fa-bookmark", false);
    }

    override getAllowRowHeader(): boolean {
        return false;
    }

    override render = (node: NodeInfo, tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        const audioUrl = S.props.getPropStr(J.NodeProp.AUDIO_URL, node);
        return new Div(null, null, [
            new NodeCompMarkdown(node, null, tabData, null),
            audioUrl ? new Button("Play Audio", () => S.nav.showAudioPlayerTab(node.id, audioUrl), null, "-primary ml-3") : null
        ]);
    }
}

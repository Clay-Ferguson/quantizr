import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { Div } from "../comp/core/Div";
import { NodeCompMarkdown } from "../comp/node/NodeCompMarkdown";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { TabIntf } from "../intf/TabIntf";
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

    override render = (node: NodeInfo, tabData: TabIntf<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        const audioUrl = S.props.getPropStr(J.NodeProp.AUDIO_URL, node);
        return new Div(null, null, [
            new NodeCompMarkdown(node, null, tabData, null),
            audioUrl ? new Button("Play Audio", () => {
                new AudioPlayerDlg("", "Audio: " + audioUrl, null, audioUrl, 0, false).open();
            }, null, "btn-primary marginLeft") : null
        ]);
    }
}

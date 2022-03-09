import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { Div } from "../comp/core/Div";
import { NodeCompMarkdown } from "../comp/node/NodeCompMarkdown";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { TabDataIntf } from "../intf/TabDataIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class BookmarkTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.BOOKMARK, "Bookmark", "fa-bookmark", false);
    }

    getAllowRowHeader(): boolean {
        return false;
    }

    render(node: J.NodeInfo, tabData: TabDataIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        let audioUrl = S.props.getPropStr(J.NodeProp.AUDIO_URL, node);
        let comp: NodeCompMarkdown = new NodeCompMarkdown(node, state);
        return new Div(null, null, [
            comp,
            audioUrl ? new Button("Play Audio", () => {
                let dlg = new AudioPlayerDlg("", "Audio: " + audioUrl, null, audioUrl, 0, state);
                dlg.open();
            }, null, "btn-primary marginLeft") : null
        ]);
    }
}

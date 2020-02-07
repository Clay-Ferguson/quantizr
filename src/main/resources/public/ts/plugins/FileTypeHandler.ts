import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Anchor } from "../widget/Anchor";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { Img } from "../widget/Img";
import { Button } from "../widget/Button";
import { AudioPlayerDlg } from "../dlg/AudioPlayerDlg";
import { VideoPlayerDlg } from "../dlg/VideoPlayerDlg";
import { Heading } from "../widget/Heading";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
import { Div } from "../widget/Div";
import { Pre } from "../widget/Pre";
import { CoreTypesPlugin } from "./CoreTypesPlugin";
import { Comp } from "../widget/base/Comp";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FileTypeHandler implements TypeHandlerIntf {
    constructor(private plugin: CoreTypesPlugin) {
    }

    render = (node: J.NodeInfo, rowStyling: boolean): Comp => {
        let ret: Comp[] = [];

        let fsLink = S.props.getNodePropertyVal("fs:link", node);
        console.log("fsLink=" + fsLink);
        if (fsLink) {
            let displayName = node.name;
            let hostAndPort: string = S.util.getHostAndPort();
            let dataUrl = hostAndPort + "/filesys/" + node.id;

            if (S.util.isAudioFileName(displayName)) {
                let playButton = new Button("Play Audio", () => {
                    new AudioPlayerDlg(dataUrl, displayName).open();
                });
                ret.push(playButton);
            }
            else if (S.util.isVideoFileName(displayName)) {
                let playButton = new Button("Play Video", () => {
                    new VideoPlayerDlg({
                        "sourceUrl": dataUrl,
                    }).open();
                });
                ret.push(new Heading(3, displayName));

                ret.push(playButton);
            }
            else if (displayName.toLowerCase().endsWith(".md")) {
                let markdownDiv = S.render.renderMarkdown(rowStyling, node, {});

                let collapsiblePanel = new CollapsiblePanel(displayName, null, [markdownDiv], true);
                ret.push(collapsiblePanel);
            }
            else if (S.util.isEditableFile(displayName)) {
                let contentDiv = new Pre(node.content, {
                    style: {margin: "15px"}
                });

                let collapsiblePanel = new CollapsiblePanel(displayName, null, [contentDiv], true);
                ret.push(collapsiblePanel);
            }
            else if (S.util.isImageFileName(displayName)) {
                let fileName = new Heading(4, displayName, {
                    style: "margin: 15px;"
                });

                let img = new Img({
                    "src": dataUrl,
                    "width": "300px"
                });

                let anchor = new Anchor(dataUrl + "?disp=inline", null, {
                    "target": "_blank",
                    "style": { margin: "15px" }
                }, [img]);

                ret.push(fileName)
                ret.push(anchor);
            }
            else {
                let anchor = new Anchor(dataUrl + "?disp=inline", displayName, {
                    "target": "_blank",
                    "style": { marginLeft: '15px' }
                });
                ret.push(anchor);
            }
        }
        else {
            ret.push(new Div("fs:link property missing."));
        }
        return new Div(null, null, ret);
    }

    orderProps(node: J.NodeInfo, _props: J.PropertyInfo[]): J.PropertyInfo[] {
        return _props;
    }

    getIconClass(node: J.NodeInfo): string {
        //https://www.w3schools.com/icons/fontawesome_icons_webapp.asp
        return "fa fa-file fa-lg";
    }

    allowAction(action: string): boolean {
        return true;
    }
}


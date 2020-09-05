import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Anchor } from "../widget/Anchor";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Header } from "../widget/Header";
import { RadioButton } from "../widget/RadioButton";
import { RadioButtonGroup } from "../widget/RadioButtonGroup";
import { VerticalLayout } from "../widget/VerticalLayout";
import { MessageDlg } from "./MessageDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ExportDlg extends DialogBase {

    constructor(state: AppState) {
        super("Export", null, false, state);
        this.mergeState({ exportType: "zip" });
    }

    renderDlg(): CompIntf[] {
        return [
            new Header("Export node content to file..."),
            new RadioButtonGroup([
                new RadioButton("ZIP", false, "exportTypeGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ exportType: "zip" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().exportType == "zip";
                    }
                }),
                new RadioButton("TAR", false, "exportTypeGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ exportType: "tar" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().exportType == "tar";
                    }
                }),
                new RadioButton("TAR.GZ", false, "exportTypeGroup", null, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.mergeState({ exportType: "tar.gz" });
                        }
                    },
                    getValue: (): boolean => {
                        return this.getState().exportType == "tar.gz";
                    }
                }),

                // had to disable PDF, because PDFBox hangs in Java, and until they fix that bug
                // there's nothing i can do other than ditch PDF box completely, which i'm not ready to do yet.
                // this.pdfRadioButton = new RadioButton("PDF", false),
            ]),
            new ButtonBar([
                new Button("Export", this.exportNodes, null, "btn-primary"),
                new Button("Close", () => {
                    this.close();
                })
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    exportNodes = (): void => {
        let state = this.getState();
        let highlightNode = S.meta64.getHighlightedNode(this.appState);
        if (highlightNode) {

            S.util.ajax<J.ExportRequest, J.ExportResponse>("export", {
                nodeId: highlightNode.id,
                exportExt: state.exportType,
            }, (res: J.ExportResponse) => {
                this.exportResponse(res);
            });
        }
        this.close();
    }

    exportResponse = (res: J.ExportResponse): void => {
        let hostAndPort: string = S.util.getHostAndPort();
        let downloadLink = hostAndPort + "/file/" + res.fileName + "?disp=attachment";
        if (S.util.checkSuccess("Export", res)) {
            new MessageDlg(
                "Export successful.<p>Use the download link below now, to get the file.",
                "Export",
                null,
                new VerticalLayout([
                    //new Anchor(hostAndPort + "/file/" + res.fileName + "?disp=inline", "Raw View", { "target": "_blank" }),
                    //new Anchor(hostAndPort + "/view/" + res.fileName, "Formatted View", { "target": "_blank" }),
                    new Anchor(downloadLink, "Download: " + downloadLink, null)
                ]), false, 0, this.appState
            ).open();

            S.view.scrollToSelectedNode(this.appState);
        }
    }
}

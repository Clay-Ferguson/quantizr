import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { MessageDlg } from "./MessageDlg";
import { Header } from "../widget/Header";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { RadioButton } from "../widget/RadioButton";
import { RadioButtonGroup } from "../widget/RadioButtonGroup";
import { Anchor } from "../widget/Anchor";
import { VerticalLayout } from "../widget/VerticalLayout";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ExportDlg extends DialogBase {

    zipRadioButton: RadioButton;
    tarRadioButton: RadioButton;
    tarGzRadioButton: RadioButton;
    pdfRadioButton: RadioButton;

    constructor(state: AppState) {
        super("Export", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Header("Export node content to file..."),
            new RadioButtonGroup([
                this.zipRadioButton = new RadioButton("ZIP", false, "exportTypeGroup"),
                this.tarRadioButton = new RadioButton("TAR", false, "exportTypeGroup"),
                this.tarGzRadioButton = new RadioButton("TAR.GZ", false, "exportTypeGroup"),

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

    exportNodes = (): void => {
        let highlightNode = S.meta64.getHighlightedNode(this.appState);
        if (highlightNode) {

            let format = this.getSelectedFormat();

            S.util.ajax<J.ExportRequest, J.ExportResponse>("export", {
                nodeId: highlightNode.id,
                exportExt: format
            }, (res: J.ExportResponse) => {
                this.exportResponse(res);
            });
        }
        this.close();
    }

    getSelectedFormat = (): string => {
        let ret = "zip";

        if (this.zipRadioButton.getChecked()) {
            ret = "zip";
        }
        else if (this.tarRadioButton.getChecked()) {
            ret = "tar";
        }
        else if (this.tarGzRadioButton.getChecked()) {
            ret = "tar.gz";
        }
        else if (this.pdfRadioButton.getChecked()) {
            ret = "pdf";
        }
        return ret;
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

            S.meta64.selectTab("mainTab");
            S.view.scrollToSelectedNode(this.appState);
        }
    }
}

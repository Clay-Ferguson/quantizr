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
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ExportDlg extends DialogBase {

    zipRadioButton: RadioButton;
    tarRadioButton: RadioButton;
    tarGzRadioButton: RadioButton;
    mdRadioButton: RadioButton;
    jsonRadioButton: RadioButton;
    pdfRadioButton: RadioButton;

    constructor() {
        super("Export");
       
        this.setChildren([
            new Header("Export node content to file..."),
            new RadioButtonGroup([
                this.zipRadioButton = new RadioButton("ZIP", false, "exportTypeGroup"),
                this.tarRadioButton = new RadioButton("TAR", false, "exportTypeGroup"),
                this.tarGzRadioButton = new RadioButton("TAR.GZ", false, "exportTypeGroup"),
                this.mdRadioButton = new RadioButton("MD (Markdown)", false, "exportTypeGroup"),
                this.jsonRadioButton = new RadioButton("JSON", false, "exportTypesGroup"),
                // had to disable PDF, because PDFBox hangs in Java, and until they fix that bug
                // there's nothing i can do other than ditch PDF box completely, which i'm not ready to do yet.
                // this.pdfRadioButton = new RadioButton("PDF", false),
            ]),
            new ButtonBar([
                new Button("Export", this.exportNodes, null, "primary"),
                new Button("Close", () => {
                    this.close();
                })
            ])
        ]);
    }

    exportNodes = (): void => {
        let highlightNode = S.meta64.getHighlightedNode();
        if (highlightNode) {

            let format = this.getSelectedFormat();

            S.util.ajax<J.ExportRequest, J.ExportResponse>("export", {
                "nodeId": highlightNode.id,
                "exportExt": format
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
        else if (this.mdRadioButton.getChecked()) {
            ret = "md";
        }
        else if (this.jsonRadioButton.getChecked()) {
            ret = "json";
        }
        else if (this.pdfRadioButton.getChecked()) {
            ret = "pdf";
        }
        return ret;
    }

    exportResponse = (res: J.ExportResponse): void => {
        let hostAndPort: string = S.util.getHostAndPort();
        if (S.util.checkSuccess("Export", res)) {
            new MessageDlg(
                "Export successful.",
                "Export",
                null,
                new VerticalLayout([
                    new Anchor(hostAndPort + "/file/" + res.fileName + "?disp=inline", "Raw View", { "target": "_blank" }),
                    //new Anchor(hostAndPort + "/view/" + res.fileName, "Formatted View", { "target": "_blank" }),
                    new Anchor(hostAndPort + "/file/" + res.fileName + "?disp=attachment", "Download", null)
                ])
            ).open();

            S.meta64.selectTab("mainTab");
            S.view.scrollToSelectedNode();
        }
    }
}

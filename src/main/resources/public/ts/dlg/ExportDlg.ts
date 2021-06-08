import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { Anchor } from "../widget/Anchor";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { Div } from "../widget/Div";
import { RadioButton } from "../widget/RadioButton";
import { RadioButtonGroup } from "../widget/RadioButtonGroup";
import { TextField } from "../widget/TextField";
import { VerticalLayout } from "../widget/VerticalLayout";
import { MessageDlg } from "./MessageDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ExportDlg extends DialogBase {

    fileNameState: ValidatedState<any> = new ValidatedState<any>();
    saveToIpfsState: CompValueHolder<boolean> = new CompValueHolder<boolean>(this, "toIpfs");

    constructor(state: AppState, private node: NodeInfo) {
        super("Export", null, false, state);
        this.mergeState({
            exportType: "zip"
            // toIpfs: false <--- set by 'saveToIpfsState'
        });
        this.fileNameState.setValue(node.name);
    }

    renderDlg(): CompIntf[] {
        return [
            new TextField("Export File Name (without extension)", false, null, null, false, this.fileNameState),
            new RadioButtonGroup([
                this.createRadioButton("ZIP", "zip"),
                this.createRadioButton("TAR", "tar"),
                this.createRadioButton("TAR.GZ", "tar.gz"),
                this.createRadioButton("Markdown", "md"),
                this.createRadioButton("PDF", "pdf"),
                this.createRadioButton("HTML", "html")
            ], "radioButtonsBar"),
            new Div(null, null, [
                new Checkbox("Save to IPFS", null, this.saveToIpfsState)
            ]),
            new ButtonBar([
                new Button("Export", this.exportNodes, null, "btn-primary"),
                new Button("Close", this.close)
            ], null, "marginTop")
        ];
    }

    createRadioButton = (name: string, exportType: string) => {
        return new RadioButton(name, false, "exportTypeGroup", null, {
            setValue: (checked: boolean): void => {
                if (checked) {
                    this.mergeState({ exportType });
                }
            },
            getValue: (): boolean => {
                return this.getState().exportType === exportType;
            }
        });
    }

    exportNodes = (): void => {
        let state = this.getState();

        S.util.ajax<J.ExportRequest, J.ExportResponse>("export", {
            nodeId: this.node.id,
            exportExt: state.exportType,
            fileName: this.fileNameState.getValue(),
            toIpfs: state.toIpfs
        }, (res: J.ExportResponse) => {
            this.exportResponse(res);
        });

        this.close();
    }

    exportResponse = (res: J.ExportResponse): void => {
        let hostAndPort: string = S.util.getHostAndPort();
        /* the 'v' arg is for cachebusting. Browser won't download same file once cached, but eventually
        the plan is to have the export return the actual md5 of the export for use here */

        let downloadLink = hostAndPort + "/file/" + res.fileName + "?disp=attachment&v=" + (new Date().getTime());

        if (S.util.checkSuccess("Export", res)) {
            new MessageDlg(
                "Export successful.<p>Use the download link below now, to get the file.",
                "Export",
                null,
                new VerticalLayout([
                    // new Anchor(hostAndPort + "/file/" + res.fileName + "?disp=inline", "Raw View", { "target": "_blank" }),
                    // new Anchor(hostAndPort + "/view/" + res.fileName, "Formatted View", { "target": "_blank" }),
                    !res.ipfsCid ? new Anchor(downloadLink, "Download: " + downloadLink, null) : null,
                    res.ipfsCid ? new Div("IPFS CID: " + res.ipfsCid, {
                        className: "ipfsCidText",
                        title: "Click -> Copy to clipboard",
                        onClick: () => {
                            S.util.copyToClipboard(res.ipfsCid);
                            S.util.flashMessage("Copied to Clipboard: " + res.ipfsCid, "Clipboard", true);
                        }
                    }) : null,
                    res.ipfsMime ? new Div("mime type: " + res.ipfsMime) : null
                ]), false, 0, this.appState
            ).open();

            S.view.scrollToSelectedNode(this.appState);
        }
    }
}

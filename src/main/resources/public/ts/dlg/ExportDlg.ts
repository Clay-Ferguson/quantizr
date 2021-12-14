import { AppState } from "../AppState";
import { Anchor } from "../comp/core/Anchor";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { RadioButton } from "../comp/core/RadioButton";
import { RadioButtonGroup } from "../comp/core/RadioButtonGroup";
import { TextField } from "../comp/core/TextField";
import { VerticalLayout } from "../comp/core/VerticalLayout";
import { CompValueHolder } from "../CompValueHolder";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { MessageDlg } from "./MessageDlg";

interface LS {
    exportType: string;
    toIpfs?: boolean;
}

export class ExportDlg extends DialogBase {

    fileNameState: ValidatedState<any> = new ValidatedState<any>();
    saveToIpfsState: CompValueHolder<boolean> = new CompValueHolder<boolean>(this, "toIpfs");

    constructor(state: AppState, private node: NodeInfo) {
        super("Export", null, false, state);
        this.mergeState<LS>({
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
            ], "radioButtonsBar marginTop"),
            new Div(null, null, [
                new Checkbox("Save to IPFS", null, this.saveToIpfsState)
            ])
        ];
    }

    createRadioButton = (name: string, exportType: string) => {
        return new RadioButton(name, false, "exportTypeGroup", null, {
            setValue: (checked: boolean): void => {
                if (checked) {
                    this.mergeState<LS>({ exportType });
                }
            },
            getValue: (): boolean => {
                return this.getState<LS>().exportType === exportType;
            }
        });
    }

    exportNodes = async (): Promise<void> => {
        let state = this.getState<LS>();
        let res: J.ExportResponse = await S.util.ajax<J.ExportRequest, J.ExportResponse>("export", {
            nodeId: this.node.id,
            exportExt: state.exportType,
            fileName: this.fileNameState.getValue(),
            toIpfs: state.toIpfs
        });
        this.exportResponse(res);
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
                ]), false, 0, null, this.appState
            ).open();

            S.view.scrollToNode(this.appState);
        }
    }

    renderButtons(): CompIntf {
        return new ButtonBar([
            new Button("Export", this.exportNodes, null, "btn-primary"),
            new Button("Close", this.close)
        ], "marginTop");
    }
}

import { getAppState } from "../AppContext";
import { CompIntf } from "../comp/base/CompIntf";
import { Anchor } from "../comp/core/Anchor";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { RadioButton } from "../comp/core/RadioButton";
import { RadioButtonGroup } from "../comp/core/RadioButtonGroup";
import { Span } from "../comp/core/Span";
import { TextField } from "../comp/core/TextField";
import { VerticalLayout } from "../comp/core/VerticalLayout";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Value } from "../Value";
import { MessageDlg } from "./MessageDlg";

interface LS { // Local State
    exportType: string;
    toIpfs?: boolean;
    includeToc?: boolean;
}

export class ExportDlg extends DialogBase {

    fileNameState: Validator = new Validator();
    saveToIpfsState: Value<boolean> = new Value<boolean>(this, "toIpfs");

    constructor(private node: NodeInfo) {
        super("Export Node");
        this.mergeState<LS>({
            exportType: "zip",
            includeToc: true
            // toIpfs: false <--- set by 'saveToIpfsState'
        });
        this.fileNameState.setValue(node.name);
    }

    renderDlg(): CompIntf[] {
        const appState = getAppState();
        return [
            new TextField({ label: "Export File Name (without extension)", val: this.fileNameState }),
            new Heading(5, "Type of File to Export", { className: "bigMarginTop" }),
            new RadioButtonGroup([
                this.radioButton("ZIP", "zip"),
                this.radioButton("TAR", "tar"),
                this.radioButton("TAR.GZ", "tar.gz"),
                this.radioButton("Markdown", "md"),
                this.radioButton("PDF", "pdf"),
                this.radioButton("HTML", "html")
            ], "radioButtonsBar marginTop"),
            this.getState<LS>().exportType === "pdf" ? this.makePdfOptions() : null,
            appState.config.ipfsEnabled ? new Div(null, null, [
                new Checkbox("Save to IPFS", null, this.saveToIpfsState)
            ]) : null,
            new ButtonBar([
                new Button("Export", this.exportNodes, null, "btn-primary"),
                new Button("Close", this.close, null, "btn-secondary float-end")
            ], "marginTop")
        ];
    }

    makePdfOptions = (): Div => {
        return new Div(null, { className: "bigMarginBottom" }, [
            new Heading(5, "PDF Options"),
            new Checkbox("Include Table of Contents (using Markdown Headings)", null, {
                setValue: (checked: boolean) => this.getState<LS>().includeToc = checked,
                getValue: (): boolean => this.getState<LS>().includeToc
            })
        ]);
    }

    radioButton = (name: string, exportType: string) => {
        return new Span(null, null, [
            new RadioButton(name, false, "exportTypeGroup", null, {
                setValue: (checked: boolean) => {
                    if (checked) {
                        this.mergeState<LS>({ exportType });
                    }
                },
                getValue: (): boolean => this.getState<LS>().exportType === exportType
            }, "form-check-inline marginRight")
        ]);
    }

    exportNodes = async () => {
        const state = this.getState<LS>();
        const res = await S.rpcUtil.rpc<J.ExportRequest, J.ExportResponse>("export", {
            nodeId: this.node.id,
            exportExt: state.exportType,
            fileName: this.fileNameState.getValue(),
            toIpfs: state.toIpfs,
            includeToc: state.includeToc
        });
        this.exportResponse(res);
        this.close();
    }

    exportResponse = (res: J.ExportResponse) => {
        const hostAndPort: string = S.util.getHostAndPort();
        /* the 'v' arg is for cachebusting. Browser won't download same file once cached, but eventually
        the plan is to have the export return the actual md5 of the export for use here */

        // disp=inline (is the other)
        const downloadLink = hostAndPort + "/file/" + res.fileName + "?disp=attachment&v=" + (new Date().getTime()) + "&token=" + S.quanta.authToken;

        // todo-3: Currently only PDF exports are saveable to IPFS MFS, and there is an inconsistency here, becasue we DO want ALL types exports to
        // be able to go to MFS, and it would be pretty easy to do what the PDFs are doing (recarding save to MFS) for all other types of exports.
        const ipfsMessage = (res.ipfsCid && res.ipfsCid.endsWith(".pdf")) ? " You can also use the `IPFS Explorer` to view the IPFS copy of the file." : "";

        if (S.util.checkSuccess("Export", res)) {
            new MessageDlg(
                "Export successful.<p>Use the download link below now, to get the file." + ipfsMessage,
                "Export",
                null,
                new VerticalLayout([
                    res.ipfsCid ? new Div("IPFS Location: " + res.ipfsCid, {
                        className: "ipfsCidText",
                        title: "Click -> Copy to clipboard",
                        onClick: () => {
                            S.util.copyToClipboard(res.ipfsCid);
                            S.util.flashMessage("Copied to Clipboard: " + res.ipfsCid, "Clipboard", true);
                        }
                    }) : null,
                    new Anchor(downloadLink, "Download", { target: "_blank" }),
                    res.ipfsMime ? new Div("mime type: " + res.ipfsMime) : null
                ]), false, 0, null
            ).open();

            S.view.scrollToNode(getAppState());
        }
    }
}

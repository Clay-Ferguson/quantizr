import { dispatch, getAs } from "../AppContext";
import { Comp } from "../comp/base/Comp";
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

export class ExportDlg extends DialogBase {

    fileNameState: Validator = new Validator();
    saveToIpfsState: Value<boolean> = new Value<boolean>(this, "toIpfs");

    constructor(private node: NodeInfo) {
        super("Export Node");
        this.fileNameState.setValue(node.name);
    }

    renderDlg(): Comp[] {
        const ast = getAs();
        const exportType = ast.exportSettings.exportType
        return [
            new TextField({ label: "Export File Name (without extension)", val: this.fileNameState }),
            new Heading(5, "File Type", { className: "bigMarginTop" }),
            new RadioButtonGroup([
                this.fileTypeRadioButton("ZIP", "zip"),
                this.fileTypeRadioButton("TAR", "tar"),
                this.fileTypeRadioButton("TAR.GZ", "tar.gz"),
                this.fileTypeRadioButton("PDF", "pdf")
            ], "radioButtonsBar marginTop"),

            exportType === "pdf" || ast.exportSettings.contentType == "md" ? new Checkbox("Table of Contents", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => s.exportSettings.includeToc = checked),
                getValue: (): boolean => getAs().exportSettings.includeToc
            }) : null,

            exportType === "zip" || exportType === "tar" || exportType === "tar.gz" ? this.makeArchiveOptions() : null,
            S.quanta.cfg.ipfsEnabled ? new Div(null, null, [
                new Checkbox("Save to IPFS", null, this.saveToIpfsState)
            ]) : null,

            new ButtonBar([
                new Button("Export", this.exportNodes, null, "btn-primary"),
                new Button("Close", this.close, null, "btn-secondary float-end")
            ], "marginTop")
        ];
    }

    makeArchiveOptions = (): Div => {
        const ast = getAs();
        return new Div(null, { className: "bigMarginBottom" }, [

            new Heading(5, "Files to Include", { className: "bigMarginTop" }),

            new RadioButtonGroup([
                this.contentTypeRadioButton("HTML", "html"),
                this.contentTypeRadioButton("Markdown", "md"),
                this.contentTypeRadioButton("JSON", "json")
            ], "radioButtonsBar marginTop"),

            new Heading(5, "Other Options", { className: "bigMarginTop" }),

            ast.exportSettings.contentType !== "json" ? new Checkbox("Attachments Folder", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.attOneFolder = checked; }),
                getValue: (): boolean => getAs().exportSettings.attOneFolder
            }) : null,
            ast.exportSettings.contentType === "html" ? new Checkbox("IDs", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.includeIDs = checked; }),
                getValue: (): boolean => getAs().exportSettings.includeIDs
            }) : null,
            ast.exportSettings.contentType === "html" ? new Checkbox("Divider Line", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.dividerLine = checked; }),
                getValue: (): boolean => getAs().exportSettings.dividerLine
            }) : null,
            new Checkbox("Set Headings", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.updateHeadings = checked; }),
                getValue: (): boolean => getAs().exportSettings.updateHeadings
            })
        ]);
    }

    contentTypeRadioButton = (name: string, exportType: string) => {
        return new Span(null, null, [
            new RadioButton(name, false, "contentTypeGroup", null, {
                setValue: (checked: boolean) => {
                    if (checked) {
                        dispatch("exportSetting", s => s.exportSettings.contentType = exportType);
                    }
                },
                getValue: (): boolean => getAs().exportSettings.contentType === exportType
            }, "form-check-inline marginRight")
        ]);
    }

    fileTypeRadioButton = (name: string, exportType: string) => {
        return new Span(null, null, [
            new RadioButton(name, false, "exportTypeGroup", null, {
                setValue: (checked: boolean) => {
                    if (checked) {
                        dispatch("exportSetting", s => s.exportSettings.exportType = exportType);
                    }
                },
                getValue: (): boolean => getAs().exportSettings.exportType === exportType
            }, "form-check-inline marginRight")
        ]);
    }

    exportNodes = async () => {
        const ast = getAs();
        const res = await S.rpcUtil.rpc<J.ExportRequest, J.ExportResponse>("export", {
            nodeId: this.node.id,
            exportExt: ast.exportSettings.exportType,
            fileName: this.fileNameState.getValue(),
            toIpfs: ast.exportSettings.toIpfs,
            includeToc: ast.exportSettings.includeToc,
            includeJypyter: ast.exportSettings.includeJypyter,
            attOneFolder: ast.exportSettings.attOneFolder,
            contentType: ast.exportSettings.contentType,
            includeIDs: ast.exportSettings.includeIDs,
            dividerLine: ast.exportSettings.dividerLine,
            updateHeadings: ast.exportSettings.updateHeadings
        });
        this.exportResponse(res);
        this.close();
    }

    exportResponse = (res: J.ExportResponse) => {
        const hostAndPort: string = S.util.getHostAndPort();
        /* the 'v' arg is for cachebusting. Browser won't download same file once cached, but eventually
        the plan is to have the export return the actual md5 of the export for use here */

        // disp=inline (is the other)
        // todo-1: Need more secure way to access file than this token=url, possibly by just creating a temporary token that 
        // can timeout faster than the user token times out.
        const downloadLink = hostAndPort + "/f/export/" + res.fileName + "?disp=attachment&v=" + (new Date().getTime()) + "&token=" + S.quanta.authToken;

        // todo-3: Currently only PDF exports are saveable to IPFS MFS, and there is an inconsistency here, because we DO want ALL types exports to
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

            S.view.scrollToNode();
        }
    }
}

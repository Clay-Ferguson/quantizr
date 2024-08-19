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
import { MessageDlg } from "./MessageDlg";

export class ExportDlg extends DialogBase {

    fileNameState: Validator = new Validator();

    constructor(private node: NodeInfo) {
        super("Export Node");
        this.fileNameState.setValue(node.name);
    }

    renderDlg(): Comp[] {
        const ast = getAs();
        const exportType = ast.exportSettings.exportType;

        const hasOptions = ast.exportSettings.contentType === "html" || ast.exportSettings.contentType === "md" || //
            ast.exportSettings.contentType === "pdf" || //
            (ast.exportSettings.contentType !== "md" && ast.exportSettings.contentType !== "fs");

        return [
            new TextField({ label: "Export File Name (without extension)", val: this.fileNameState }),
            new Heading(5, "File Type", { className: "bigMarginTop" }),
            new RadioButtonGroup([
                this.makeFileTypeRadioBtn("ZIP", "zip"),
                this.makeFileTypeRadioBtn("TAR", "tar"),
                this.makeFileTypeRadioBtn("TAR.GZ", "tar.gz"),
                this.makeFileTypeRadioBtn("PDF", "pdf")
            ], "radioButtonsBar marginTop"),

            exportType === "zip" || exportType === "tar" || exportType === "tar.gz" ? this.contentTypeOptions() : null,

            hasOptions ? new Heading(5, "Options", { className: "bigMarginTop" }) : null,

            ast.exportSettings.contentType === "html" ? new Checkbox("IDs", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.includeIDs = checked; }),
                getValue: (): boolean => getAs().exportSettings.includeIDs
            }) : null,
            ast.exportSettings.contentType === "html" ? new Checkbox("Divider Line", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.dividerLine = checked; }),
                getValue: (): boolean => getAs().exportSettings.dividerLine
            }) : null,
            // don't show headings option for 'md' becasue it's forced to true
            ast.exportSettings.contentType !== "md" && ast.exportSettings.contentType !== "fs" ? new Checkbox("Set Headings", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.updateHeadings = checked; }),
                getValue: (): boolean => getAs().exportSettings.updateHeadings
            }) : null,

            exportType === "pdf" || ast.exportSettings.contentType == "md" || ast.exportSettings.contentType == "html" ? new Checkbox("Table of Contents", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => s.exportSettings.includeToc = checked),
                getValue: (): boolean => getAs().exportSettings.includeToc
            }) : null,

            ast.exportSettings.contentType == "md" ? new Checkbox("Include Metadata", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => s.exportSettings.includeMetaComments = checked),
                getValue: (): boolean => getAs().exportSettings.includeMetaComments
            }) : null,

            new ButtonBar([
                new Button("Export", this.exportNodes, null, "btn-primary"),
                new Button("Close", this.close, null, "btn-secondary float-end")
            ], "marginTop")
        ];
    }

    contentTypeOptions = (): Div => {
        return new Div(null, { className: "bigMarginBottom" }, [

            new Heading(5, "Content Type", { className: "bigMarginTop" }),

            new RadioButtonGroup([
                this.contentTypeRadioButton("HTML", "html"),
                this.contentTypeRadioButton("Markdown", "md"),
                this.contentTypeRadioButton("JSON", "json"),
                this.contentTypeRadioButton("Files & Folders", "fs")
            ], "radioButtonsBar marginTop"),
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

    makeFileTypeRadioBtn = (name: string, exportType: string) => {
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
            includeToc: ast.exportSettings.includeToc,
            includeMetaComments: ast.exportSettings.includeMetaComments,
            contentType: ast.exportSettings.contentType,
            includeIDs: ast.exportSettings.includeIDs,
            dividerLine: ast.exportSettings.dividerLine,
            updateHeadings: ast.exportSettings.updateHeadings,
            threadAsPDF: false
        });
        this.exportResponse(res);
        this.close();
    }

    exportResponse = (res: J.ExportResponse) => {
        /* the 'v' arg is for cachebusting. Browser won't download same file once cached, but
        eventually the plan is to have the export return the actual md5 of the export for use here
        */
        // disp=inline (is the other)
        const downloadLink = S.util.getHostAndPort() + "/f/export/" + res.fileName + "?disp=attachment&v=" + (new Date().getTime()) + "&token=" + S.quanta.authToken;

        if (S.util.checkSuccess("Export", res)) {
            new MessageDlg(
                "Export successful.<p>Use the download link below now, to get the file.",
                "Export",
                null,
                new VerticalLayout([
                    new Anchor(downloadLink, "Download", { target: "_blank" }),
                ]), false, 0, null
            ).open();

            S.view.scrollToNode();
        }
    }
}

import { dispatch, getAs } from "../AppContext";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { RadioButton } from "../comp/core/RadioButton";
import { RadioButtonGroup } from "../comp/core/RadioButtonGroup";
import { Span } from "../comp/core/Span";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";

export class ExportDlg extends DialogBase {

    fileNameState: Validator = new Validator();
    res: J.ExportResponse = null;

    constructor(defaultName: string, private nodeId: string, public exportingThread: boolean) {
        super("Export Node");
        this.fileNameState.setValue(defaultName);
    }

    renderDlg(): Comp[] {
        const ast = getAs();

        const hasOptions = ast.exportSettings.contentType === "html" || ast.exportSettings.contentType === "md" || //
            ast.exportSettings.contentType === "pdf" || //
            (ast.exportSettings.contentType !== "md" && ast.exportSettings.contentType !== "fs");

        const children: Comp[] = [];

        if (!this.exportingThread) {
            children.push(new TextField({ label: "Export File Name (without extension)", val: this.fileNameState }));
            children.push(new Heading(5, "File Type", { className: "mt-6" }));
            children.push(new RadioButtonGroup([
                this.makeFileTypeRadioBtn("ZIP", "zip"),
                this.makeFileTypeRadioBtn("TAR", "tar"),
                this.makeFileTypeRadioBtn("TAR.GZ", "tar.gz"),
                this.makeFileTypeRadioBtn("PDF", "pdf")
            ], "radioButtonsBar mt-3"));

            if (ast.exportSettings.exportType === "zip" || ast.exportSettings.exportType === "tar" || ast.exportSettings.exportType === "tar.gz") children.push(this.contentTypeOptions());
        }

        if (hasOptions) children.push(new Heading(5, "Options", { className: "mt-6" }));

        if (this.exportingThread || ast.exportSettings.contentType === "html") children.push(new Checkbox("IDs", null, {
            setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.includeIDs = checked; }),
            getValue: (): boolean => getAs().exportSettings.includeIDs
        }));

        if (this.exportingThread || ast.exportSettings.contentType === "html" || ast.exportSettings.exportType == "pdf") children.push(new Checkbox("Divider Line", null, {
            setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.dividerLine = checked; }),
            getValue: (): boolean => getAs().exportSettings.dividerLine
        }));

        if (!this.exportingThread) {
            // don't show headings option for 'md' becasue it's forced to true
            if (ast.exportSettings.contentType !== "md" && ast.exportSettings.contentType !== "fs") children.push(new Checkbox("Set Headings", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => { s.exportSettings.updateHeadings = checked; }),
                getValue: (): boolean => getAs().exportSettings.updateHeadings
            }));

            if (ast.exportSettings.exportType === "pdf" || ast.exportSettings.contentType == "md" || ast.exportSettings.contentType == "html") children.push(new Checkbox("Table of Contents", null, {
                setValue: (checked: boolean) => dispatch("exportSetting", s => s.exportSettings.includeToc = checked),
                getValue: (): boolean => getAs().exportSettings.includeToc
            }));
        }

        if (!this.exportingThread && ast.exportSettings.contentType == "md" && ast.exportSettings.exportType !== "pdf") children.push(new Checkbox("Metadata", null, {
            setValue: (checked: boolean) => dispatch("exportSetting", s => s.exportSettings.includeMetaComments = checked),
            getValue: (): boolean => getAs().exportSettings.includeMetaComments
        }));

        if (this.exportingThread || ast.exportSettings.exportType === "pdf") children.push(new Checkbox("Owner Names", null, {
            setValue: (checked: boolean) => dispatch("exportSetting", s => s.exportSettings.includeOwners = checked),
            getValue: (): boolean => getAs().exportSettings.includeOwners
        }));

        children.push(new ButtonBar([
            new Button("Export", this._exportNodes, null, "-primary"),
            new Button("Close", this._close, null, "float-right")
        ], "mt-3"));

        return children;
    }

    contentTypeOptions(): Div {
        return new Div(null, { className: "mb-6" }, [
            new Heading(5, "Content Type", { className: "mt-6" }),

            new RadioButtonGroup([
                this.contentTypeRadioButton("HTML", "html"),
                this.contentTypeRadioButton("Markdown", "md"),
                this.contentTypeRadioButton("JSON", "json"),
                this.contentTypeRadioButton("Files & Folders", "fs")
            ], "radioButtonsBar mt-3"),
        ]);
    }

    contentTypeRadioButton(name: string, exportType: string) {
        return new Span(null, null, [
            new RadioButton(name, false, "contentTypeGroup", null, {
                setValue: (checked: boolean) => {
                    if (checked) {
                        dispatch("exportSetting", s => s.exportSettings.contentType = exportType);
                    }
                },
                getValue: (): boolean => getAs().exportSettings.contentType === exportType
            }, "mr-3 inlineBlock")
        ]);
    }

    makeFileTypeRadioBtn(name: string, exportType: string) {
        return new Span(null, null, [
            new RadioButton(name, false, "exportTypeGroup", null, {
                setValue: (checked: boolean) => {
                    if (checked) {
                        dispatch("exportSetting", s => s.exportSettings.exportType = exportType);
                    }
                },
                getValue: (): boolean => getAs().exportSettings.exportType === exportType
            }, "mr-3 inlineBlock")
        ]);
    }

    _exportNodes = async () => {
        const ast = getAs();
        if (this.exportingThread) {
            this.res = await S.rpcUtil.rpc<J.ExportRequest, J.ExportResponse>("export", {
                nodeId: getAs().threadViewFromNodeId,
                exportExt: "pdf",
                fileName: "thread-view",
                includeToc: false,
                includeMetaComments: false,
                contentType: "md", // unused for PDF export right?
                includeIDs: ast.exportSettings.includeIDs,
                dividerLine: ast.exportSettings.dividerLine,
                updateHeadings: false,
                threadAsPDF: true,
                includeOwners: ast.exportSettings.includeOwners
            });
        }
        else {
            this.res = await S.rpcUtil.rpc<J.ExportRequest, J.ExportResponse>("export", {
                nodeId: this.nodeId,
                exportExt: ast.exportSettings.exportType,
                fileName: this.fileNameState.getValue(),
                includeToc: ast.exportSettings.includeToc,
                includeMetaComments: ast.exportSettings.includeMetaComments,
                contentType: ast.exportSettings.contentType,
                includeIDs: ast.exportSettings.includeIDs,
                dividerLine: ast.exportSettings.dividerLine,
                updateHeadings: ast.exportSettings.updateHeadings,
                threadAsPDF: false,
                includeOwners: ast.exportSettings.includeOwners
            });
        }
        this.close();
    }
}

import { dispatch, getAs } from "../../AppContext";
import { Selection } from "../../comp/core/Selection";
import { ConfirmDlg } from "../../dlg/ConfirmDlg";
import { EditNodeDlg, LS as EditNodeDlgState } from "../../dlg/EditNodeDlg";
import { ValueIntf } from "../../Interfaces";
import { Attachment, NodeInfo } from "../../JavaIntf";
import { S } from "../../Singletons";
import { Tailwind } from "../../Tailwind";
import { Validator, ValidatorRuleName } from "../../Validator";
import { Comp } from "../base/Comp";
import { NodeCompBinary } from "../node/NodeCompBinary";
import { Button } from "./Button";
import { ButtonBar } from "./ButtonBar";
import { Checkbox } from "./Checkbox";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { Div } from "./Div";
import { FlexRowLayout } from "./FlexRowLayout";
import { Icon } from "./Icon";
import { Span } from "./Span";
import { TextField } from "./TextField";

export class EditAttachmentsPanel extends Comp {

    constructor(private node: NodeInfo, private dlg: EditNodeDlg) {
        super({ className: "binaryEditorSection" });
    }

    override preRender(): boolean | null {
        const ast = getAs();
        if (!this.node.attachments && !ast.cutAttachments) return null;
        this.children = [];
        let isFirst = true;
        const atts = this.dlg.getState<EditNodeDlgState>().selectedAttachments;

        if (atts?.size > 0 || ast.cutAttachmentsFromId) {
            this.addChild(new ButtonBar([
                new Span(null, { className: "alignBottom" }),
                atts?.size > 0 ? new Button("", this.dlg.utl._deleteUploads, {
                    title: "Delete selected Attachments"
                }, null, "fa-trash fa-lg") : null,
                !ast.cutAttachmentsFromId ? new Button(null, this.dlg.utl._cutUploads, {
                    title: "Cut selected Attachments"
                }, null, "fa-cut fa-lg") : null,
                ast.cutAttachmentsFromId ? new Button("Undo Cut", S.nodeUtil._clearCut, { className: "clickable marginLeft" }) : null,
                ast.cutAttachmentsFromId && ast.editNode.id != ast.cutAttachmentsFromId ? //
                    new Button("Paste", () => S.nodeUtil.paste(this.dlg), {
                        className: "clickable marginLeft"
                    }) : null
            ], "attachmentButtonBar"));
        }

        if (this.node.attachments) {
            S.props.getOrderedAtts(this.node).forEach(att => {
                if (S.nodeUtil.isCutAttachment(att, ast.editNode.id)) return;
                this.addChild(this.makeAttPanel(att, isFirst));
                isFirst = false;
            });
        }
        return true;
    }

    makeAttPanel(att: Attachment, isFirst: boolean): Div {
        const ast = getAs();
        if (!att) return null;
        const key = (att as any).key;

        const attCheckbox = new Checkbox(null, null, {
            setValue: (checked: boolean) => {
                const state = this.dlg.getState<EditNodeDlgState>();
                if (checked) {
                    state.selectedAttachments.add((att as any).key);
                }
                else {
                    state.selectedAttachments.delete((att as any).key);
                }
                this.dlg.mergeState<EditNodeDlgState>({});
            },
            getValue: (): boolean => this.dlg.getState<EditNodeDlgState>().selectedAttachments.has((att as any).key)
        }, "delAttCheckbox");

        const imgSizeSelection = S.props.hasImage(ast.editNode, key)
            ? this.createImgSizeSelection("Width", "widthDropDown", //
                {
                    setValue: (val: string): void => {
                        const att: Attachment = S.props.getAttachment(key, ast.editNode);
                        if (att) {
                            att.cssSize = val;
                            if (isFirst) {
                                this.askMakeAllSameSize(ast.editNode, val);
                            }
                            this.dlg.binaryDirty = true;
                        }
                    },
                    getValue: (): string => {
                        const att: Attachment = S.props.getAttachment(key, ast.editNode);
                        return att && att.cssSize;
                    }
                }) : null;

        const imgPositionSelection = S.props.hasImage(ast.editNode, key)
            ? this.createImgPositionSelection("Position", "positionDropDown", //
                {
                    setValue: (val: string): void => {
                        const att: Attachment = S.props.getAttachment(key, ast.editNode);
                        if (att) {
                            att.position = val === "auto" ? null : val;
                            this.dlg.binaryDirty = true;
                        }
                        this.dlg.mergeState({});
                    },
                    getValue: (): string => {
                        const att: Attachment = S.props.getAttachment(key, ast.editNode);
                        let ret = att && att.position;
                        if (!ret) ret = "auto";
                        return ret;
                    }
                }) : null;

        let fileNameFieldState: Validator = this.dlg.attFileNames.get((att as any).key);
        if (!fileNameFieldState) {
            fileNameFieldState = new Validator(att.fileName, [{ name: ValidatorRuleName.REQUIRED }]);
            this.dlg.attFileNames.set((att as any).key, fileNameFieldState);
        }

        const fileNameField = new TextField({
            labelClass: "txtFieldLabelShort",
            outterClass: "fileNameField marginLeft",
            label: "File Name",
            val: fileNameFieldState
        });

        const list: Attachment[] = S.props.getOrderedAtts(ast.editNode);
        const firstAttachment = list != null && list[0].ordinal === att.ordinal;
        const lastAttachment = list != null && list[list.length - 1].ordinal === att.ordinal;

        const topBinRow = new FlexRowLayout([
            attCheckbox,
            new NodeCompBinary(ast.editNode, key, true, false, true, null),
            imgSizeSelection,
            imgPositionSelection,
            fileNameField,
            new Div(null, null, [
                !firstAttachment ? new Icon({
                    className: "fa fa-lg fa-arrow-up clickable marginLeft",
                    title: "Move Attachment Up",
                    onClick: () => this.moveAttUp(att, ast.editNode)
                }) : null,
                !lastAttachment ? new Icon({
                    className: "fa fa-lg fa-arrow-down clickable marginLeft",
                    title: "Move Attachment Down",
                    onClick: () => this.moveAttDown(att, ast.editNode)
                }) : null
            ])
        ]);

        let fileNameTagTip = null;
        if (att.position === "ft") {
            const content = this.dlg?.contentEditor?.getValue() || ast.editNode.content;
            const fileName = fileNameFieldState.getValue();

            // if fileName tag not already in the content give the user help inserting it.
            if (content.indexOf(`{{${fileName}}}`) === -1) {
                fileNameTagTip = new Div(`Insert {{${fileName}}} in text`, {
                    title: "Click to insert File Tag",
                    className: "clickable smallMarginTop",
                    onClick: () => {
                        this.dlg?.contentEditor?.insertTextAtCursor(`{{${fileName}}}`);
                    }
                });
            }
        }

        const aiPrompt = att.aiPrompt ? new CollapsiblePanel("Show AI Prompt", "Hide AI Prompt", null,
            [new Div(att.aiPrompt, { className: "smallMarginTop marginLeft" })], true, (exp: boolean) => {
                dispatch("ExpandAIPrompt", s => s.aiPromptsExpanded = exp);
            }, getAs().aiPromptsExpanded, null, "smallMarginTop", "smallMarginTop") : null;

        return new Div(null, { className: "binaryEditorItem" }, [
            topBinRow, fileNameTagTip, aiPrompt
        ]);
    }

    async askMakeAllSameSize(node: NodeInfo, val: string): Promise<void> {
        setTimeout(() => {
            const attachments = S.props.getOrderedAtts(node);
            if (attachments?.length > 1) {
                const dlg = new ConfirmDlg("Display all images at " + (val === "0" ? "their actual" : val) + " width?", "All Images?",
                    "", Tailwind.alertInfo);
                dlg.open().then(() => {
                    if (dlg.yes) {
                        if (!this.node.attachments) return null;
                        attachments.forEach(att => { att.cssSize = val; });
                        // trick to force screen render
                        this.dlg.mergeState({});
                    }
                });
            }
            return null;
        }, 250);
    }

    moveAttDown(att: Attachment, node: NodeInfo) {
        const list: Attachment[] = S.props.getOrderedAtts(node);
        if (!list) return;
        let idx: number = 0;
        let setNext: number = -1;
        for (const a of list) {
            const aObj: Attachment = node.attachments[(a as any).key];
            if (setNext !== -1) {
                aObj.ordinal = setNext;
                setNext = -1;
            }
            else if (a.ordinal === att.ordinal) {
                aObj.ordinal = idx + 1;
                setNext = idx;
            }
            else {
                aObj.ordinal = idx;
            }
            idx++;
        }

        this.dlg.binaryDirty = true;
        dispatch("attachmentMoveUp", _s => { });
    }

    moveAttUp(att: Attachment, node: NodeInfo) {
        const list: Attachment[] = S.props.getOrderedAtts(node);
        if (!list) return;
        let idx: number = 0;
        let lastA = null;
        for (const a of list) {
            const aObj: Attachment = node.attachments[(a as any).key];
            if (a.ordinal === att.ordinal) {
                aObj.ordinal = idx - 1;
                if (lastA) {
                    lastA.o = idx;
                }
            }
            else {
                aObj.ordinal = idx;
            }
            idx++;
            lastA = a;
        }

        this.dlg.binaryDirty = true;
        dispatch("attachmentMoveUp", _s => { });
    }

    createImgSizeSelection(label: string, extraClasses: string, valueIntf: ValueIntf): Selection {
        const options = [
            { key: "0", val: "Actual" },
            { key: "20%", val: "20%" },
            { key: "25%", val: "25%" },
            { key: "33%", val: "33%" },
            { key: "50%", val: "50%" },
            { key: "75%", val: "75%" },
            { key: "100%", val: "100%" },
            { key: "50px", val: "50px" },
            { key: "100px", val: "100px" },
            { key: "200px", val: "200px" },
            { key: "400px", val: "400px" },
            { key: "800px", val: "800px" },
            { key: "1000px", val: "1000px" }
        ];

        return new Selection(null, label, options, null, extraClasses, valueIntf);
    }

    createImgPositionSelection(label: string, extraClasses: string, valueIntf: ValueIntf): Selection {
        const options = [
            { key: "auto", val: "Auto" },
            { key: "c", val: "Center" },
            { key: "ul", val: "Top Left" },
            { key: "ur", val: "Top Right" },
            { key: "ft", val: "File Tag" }
        ];

        return new Selection(null, label, options, null, extraClasses, valueIntf);
    }
}

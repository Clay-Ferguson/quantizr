import { dispatch, getAppState } from "../../AppContext";
import { Selection } from "../../comp/core/Selection";
import { ConfirmDlg } from "../../dlg/ConfirmDlg";
import { EditNodeDlg } from "../../dlg/EditNodeDlg";
import { ValueIntf } from "../../Interfaces";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";
import { Validator } from "../../Validator";
import { NodeCompBinary } from "../node/NodeCompBinary";
import { Checkbox } from "./Checkbox";
import { Div } from "./Div";
import { HorizontalLayout } from "./HorizontalLayout";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { TextField } from "./TextField";

export class EditAttachmentsPanel extends Div {

    constructor(private node: J.NodeInfo, private editorDlg: EditNodeDlg) {
        super(null, { className: "binaryEditorSection" });
        console.log("new EditAttachmentsPanel");
    }

    preRender(): void {
        if (!this.node.attachments) return null;
        this.setChildren([]);
        let isFirst = true;
        S.props.getOrderedAttachments(this.node).forEach(att => {
            this.addChild(this.makeAttachmentPanel(att, isFirst));
            isFirst = false;
        });
    }

    makeAttachmentPanel = (att: J.Attachment, isFirst: boolean): Div => {
        const appState = getAppState();
        if (!att) return null;
        const key = (att as any).key;
        const ipfsLink = att.il;
        const mime = att.m;

        let pinCheckbox = null;
        if (ipfsLink) {
            pinCheckbox = new Checkbox("Pin", { className: "ipfsPinnedCheckbox" }, {
                setValue: (checked: boolean) => {
                    if (checked) {
                        att.ir = null;
                    }
                    else {
                        att.ir = "1";
                    }
                },
                getValue: (): boolean => att.ir ? false : true
            });
        }

        const imgSizeSelection = S.props.hasImage(appState.editNode, key)
            ? this.createImgSizeSelection("Width", false, "editorDropDownInline", //
                {
                    setValue: (val: string): void => {
                        const att: J.Attachment = S.props.getAttachment(key, appState.editNode);
                        if (att) {
                            att.c = val;
                            if (isFirst) {
                                this.askMakeAllSameSize(appState.editNode, val);
                            }
                            this.editorDlg.binaryDirty = true;
                        }
                    },
                    getValue: (): string => {
                        const att: J.Attachment = S.props.getAttachment(key, appState.editNode);
                        return att && att.c;
                    }
                }) : null;

        const imgPositionSelection = S.props.hasImage(appState.editNode, key)
            ? this.createImgPositionSelection("Position", "editorDropDownInline", //
                {
                    setValue: (val: string): void => {
                        const att: J.Attachment = S.props.getAttachment(key, appState.editNode);
                        if (att) {
                            att.p = val === "auto" ? null : val;
                            this.editorDlg.binaryDirty = true;
                        }
                    },
                    getValue: (): string => {
                        const att: J.Attachment = S.props.getAttachment(key, appState.editNode);
                        let ret = att && att.p;
                        if (!ret) ret = "auto";
                        return ret;
                    }
                }) : null;

        let fileNameFieldState: Validator = this.editorDlg.attFileNames.get((att as any).key);
        if (!fileNameFieldState) {
            fileNameFieldState = new Validator(att.f);
            this.editorDlg.attFileNames.set((att as any).key, fileNameFieldState);
        }

        const fileNameField = new TextField({ labelClass: "txtFieldLabelShort", outterClass: "fileNameField", label: "File Name", val: fileNameFieldState });

        const list: J.Attachment[] = S.props.getOrderedAttachments(appState.editNode);
        const firstAttachment = list[0].o === att.o;
        const lastAttachment = list[list.length - 1].o === att.o;

        const topBinRow = new HorizontalLayout([
            new NodeCompBinary(appState.editNode, key, true, false),

            new HorizontalLayout([
                new Div(null, null, [
                    ipfsLink ? new Div("IPFS", {
                        className: "smallHeading"
                    }) : null,

                    new IconButton("fa-trash fa-lg", "", {
                        onClick: () => this.editorDlg.utl.deleteUpload(this.editorDlg, key),
                        title: "Remove this attachment"
                    }, "marginRight")
                ]),
                imgSizeSelection,
                imgPositionSelection,
                fileNameField,
                pinCheckbox,
                new Div(null, { className: "bigMarginLeft" }, [
                    !firstAttachment ? new Icon({
                        className: "fa fa-lg fa-arrow-up clickable marginLeft",
                        title: "Move Attachment Up",
                        onClick: () => this.moveAttachmentUp(att, appState.editNode)
                    }) : null,
                    !lastAttachment ? new Icon({
                        className: "fa fa-lg fa-arrow-down clickable marginLeft",
                        title: "Move Attachment Down",
                        onClick: () => this.moveAttachmentDown(att, appState.editNode)
                    }) : null
                ])
            ])

            // todo-2: this is not doing what I want but is unimportant so removing it for now.
            // ipfsLink ? new Button("IPFS Link", () => S.render.showNodeUrl(state.node, this.appState), { title: "Show the IPFS URL for the attached file." }) : null
        ], "horizontalLayoutCompCompact");

        let bottomBinRow = null;
        if (ipfsLink) {
            bottomBinRow = new Div(null, { className: "marginLeft marginBottom" }, [
                ipfsLink ? new Div(`CID: ${ipfsLink}`, {
                    className: "clickable",
                    title: "Click -> Copy to clipboard",
                    onClick: () => {
                        S.util.copyToClipboard(`ipfs://${ipfsLink}`);
                        S.util.flashMessage("Copied IPFS link to Clipboard", "Clipboard", true);
                    }
                }) : null,
                ipfsLink ? new Div(`Type: ${mime}`) : null
            ]);
        }

        return new Div(null, { className: "binaryEditorItem" }, [
            topBinRow, bottomBinRow
        ]);
    }

    askMakeAllSameSize = async (node: J.NodeInfo, val: string): Promise<void> => {
        setTimeout(async () => {
            const attachments = S.props.getOrderedAttachments(node);
            if (attachments?.length > 1) {
                const dlg = new ConfirmDlg("Display all images at " + (val === "0" ? "their actual" : val) + " width?", "All Images?",
                    "btn-info", "alert alert-info");
                await dlg.open();
                if (dlg.yes) {
                    if (!this.node.attachments) return null;
                    attachments.forEach(att => { att.c = val; });
                    // trick to force screen render
                    this.editorDlg.mergeState({});
                }
            }
            return null;
        }, 250);
    }

    moveAttachmentDown = (att: J.Attachment, node: J.NodeInfo) => {
        const list: J.Attachment[] = S.props.getOrderedAttachments(node);
        let idx: number = 0;
        let setNext: number = -1;
        for (const a of list) {
            const aObj: J.Attachment = node.attachments[(a as any).key];
            if (setNext !== -1) {
                aObj.o = setNext;
                setNext = -1;
            }
            else if (a.o === att.o) {
                aObj.o = idx + 1;
                setNext = idx;
            }
            else {
                aObj.o = idx;
            }
            idx++;
        }

        this.editorDlg.binaryDirty = true;
        dispatch("attachmentMoveUp", s => {
            return s;
        });
    }

    moveAttachmentUp = (att: J.Attachment, node: J.NodeInfo) => {
        const list: J.Attachment[] = S.props.getOrderedAttachments(node);
        let idx: number = 0;
        let lastA = null;
        for (const a of list) {
            const aObj: J.Attachment = node.attachments[(a as any).key];
            if (a.o === att.o) {
                aObj.o = idx - 1;
                if (lastA) {
                    lastA.o = idx;
                }
            }
            else {
                aObj.o = idx;
            }
            idx++;
            lastA = a;
        }

        this.editorDlg.binaryDirty = true;
        dispatch("attachmentMoveUp", s => {
            return s;
        });
    }

    // todo-0" get rid of allowNone and simplify the assignment of options to a single statement.
    createImgSizeSelection = (label: string, allowNone: boolean, extraClasses: string, valueIntf: ValueIntf): Selection => {
        let options = [];

        if (allowNone) {
            // none means we would ignore the option during rendering, slightly different from "Actual" in cases
            // where this is an override that we don't want to override with. 'none' means don't override.
            options.push({ key: "n", val: "None" });
        }

        options = options.concat([
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
        ]);

        return new Selection(null, label, options, null, extraClasses, valueIntf);
    }

    createImgPositionSelection = (label: string, extraClasses: string, valueIntf: ValueIntf): Selection => {
        const options = [
            { key: "auto", val: "Automatic" },
            { key: "c", val: "Center" },
            { key: "ul", val: "Upper Left" },
            { key: "ur", val: "Upper Right" },
            { key: "ft", val: "File Tag" }
        ];

        return new Selection(null, label, options, null, extraClasses, valueIntf);
    }

}

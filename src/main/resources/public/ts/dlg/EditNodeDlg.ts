import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { DialogBase } from "../DialogBase";
import { ConfirmDlg } from "./ConfirmDlg";
import { Button } from "../widget/Button";
import { Header } from "../widget/Header";
import { Selection } from "../widget/Selection";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { Checkbox } from "../widget/Checkbox";
import { EditPropsTable } from "../widget/EditPropsTable";
import { EditPropsTableRow } from "../widget/EditPropsTableRow";
import { Constants as C } from "../Constants";
import { PubSub } from "../PubSub";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { Singletons } from "../Singletons";
import { ChangeNodeTypeDlg } from "./ChangeNodeTypeDlg";
import { AceEditPropTextarea } from "../widget/AceEditPropTextarea";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
import { TextField } from "../widget/TextField";
import { EncryptionDlg } from "./EncryptionDlg";
import { FormInline } from "../widget/FormInline";
import { TextContent } from "../widget/TextContent";
import { Comp } from "../widget/base/Comp";
import { Textarea } from "../widget/Textarea";
import { SymKeyDataPackage } from "../intf/EncryptionIntf";
import { Icon } from "../widget/Icon";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";
import { Label } from "../widget/Label";
import { NodeCompBinary } from "../comps/NodeCompBinary";
import { UploadFromFileDropzoneDlg } from "./UploadFromFileDropzoneDlg";
import { EditPropertyDlg } from "./EditPropertyDlg"
import { LayoutRow } from "../widget/LayoutRow";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditNodeDlg extends DialogBase {
    header: Header;
    buttonBar: ButtonBar;
    propsButtonBar: ButtonBar;
    layoutSelection: Selection;
    prioritySelection: Selection;
    imgSizeSelection: Selection;
    //help: TextContent;
    propertyEditFieldContainer: Div;

    wordWrapCheckBox: Checkbox;
    inlineChildrenCheckBox: Checkbox;
    saveNodeButton: Button;
    uploadButton: Button;
    shareButton: Button;
    deleteUploadButton: Button;
    setTypeButton: Button;
    encryptionButton: Button;
    insertTimeButton: Button;
    addPropertyButton: Button;
    deletePropButton: Button;
    cancelButton: Button;

    //maps the DOM ids of dom elements the property that DOM element is editing.
    compIdToPropMap: { [key: string]: J.PropertyInfo } = {};
    propCheckBoxes: Checkbox[];

    nodeNameTextField: TextField;
    contentEditor: I.TextEditorIntf;

    static morePanelExpanded: boolean = false;

    skdp: SymKeyDataPackage;

    //if user uploads or deletes an upload we set this, to force refresh when dialog closes even if they don't click save.
    binaryDirty: boolean = false;

    constructor(node: J.NodeInfo, state: AppState) {
        super("Edit", "app-modal-content", false, state);
        this.mergeState({ node });
    }

    createLayoutSelection = (): Selection => {
        //todo-1: these columns need to auto-space and not go past allowed width of page display
        let selection: Selection = new Selection({
            defaultValue: "v"
        }, "Layout", [
            { key: "v", val: "Vertical" },
            { key: "c2", val: "2 Columns" },
            { key: "c3", val: "3 Columns" },
            { key: "c4", val: "4 Columns" }
        ], "m-2"); // "w-25 m-2");
        return selection;
    }

    createPrioritySelection = (): Selection => {
        let selection: Selection = new Selection({
            defaultValue: "0"
        }, "Priority", [
            { key: "0", val: "none" },
            { key: "1", val: "Top" },
            { key: "2", val: "High" },
            { key: "3", val: "Medium" },
            { key: "4", val: "Low" },
            { key: "5", val: "Backlog" }
        ], "m-2"); // "w-25 m-2");
        return selection;
    }

    createImgSizeSelection = (): Selection => {
        let selection: Selection = new Selection({
            defaultValue: "0"
        }, "Image Size", [
            { key: "0", val: "Actual" },
            { key: "15%", val: "15%" },
            { key: "25%", val: "25%" },
            { key: "50%", val: "50%" },
            { key: "80%", val: "80%" },
            { key: "90%", val: "90%" },
            { key: "100%", val: "100%" },
            { key: "100px", val: "100px" },
            { key: "200px", val: "200px" },
            { key: "400px", val: "400px" },
            { key: "800px", val: "800px" },
            { key: "1000px", val: "1000px" },

        ], "m-2 w-25"); // "w-25 m-2");
        return selection;
    }

    getTitleIconComp(): CompIntf {
        let state = this.getState();

        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(state.node.type);
        if (typeHandler) {
            let iconClass = typeHandler.getIconClass();
            if (iconClass) {
                return new Icon({
                    style: { marginRight: '12px', verticalAlign: 'middle' },
                    className: iconClass
                });
            }
        }
        return null;
    }

    getExtraTitleBarComps(): CompIntf[] {
        let state = this.getState();
        let comps: CompIntf[] = [];

        if (S.props.isEncrypted(state.node)) {
            comps.push(new Icon({
                style: { marginLeft: '12px', verticalAlign: 'middle' },
                className: "fa fa-lock fa-lg"
            }));
        }

        return comps;
    }

    renderDlg(): CompIntf[] {
        let state = this.getState();

        let hasAttachment: boolean = S.props.hasBinary(state.node);

        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(state.node.type);
        let customProps: string[] = null;
        if (typeHandler) {
            customProps = typeHandler.getCustomProperties();
            typeHandler.ensureDefaultProperties(state.node);
        }

        let allowContentEdit: boolean = typeHandler ? typeHandler.getAllowContentEdit() : true;

        //regardless of value, if this property is present we consider the type locked
        let typeLocked = !!S.props.getNodePropVal(J.NodeProp.TYPE_LOCK, state.node);

        //This flag can be turned on during debugging to force ALL properties to be editable. Maybe there should be some way for users
        //to dangerously opt into this also without hacking the code with this var.
        let allowEditAllProps: boolean = this.appState.isAdminUser;

        let allowUpload: boolean = typeHandler ? (state.isAdminUser || typeHandler.allowAction("upload", state.node, this.appState)) : true;
        let allowShare = true;

        let children = [
            new Form(null, [
                //this.help = new TextContent("Help content."),
                new Div(null, {
                }, [
                    this.propertyEditFieldContainer = new Div("", {
                    }),
                ]),
                this.buttonBar = new ButtonBar([
                    this.saveNodeButton = new Button("Save", () => {
                        this.saveNode();
                        this.close();
                    }, null, "btn-primary"),

                    this.uploadButton = (!hasAttachment && allowUpload) ? new Button("Upload", this.upload) : null,
                    this.shareButton = allowShare ? new Button("Share", this.share) : null,

                    //this.insertTimeButton = new Button("Ins. Time", this.insertTime),
                    this.cancelButton = new Button("Cancel", this.cancelEdit)
                ])
            ])
        ];

        let optionsBar = new Div("", null, [
            this.wordWrapCheckBox = new Checkbox("Word Wrap", true, {
                className: "marginRight",
                onChange: (evt: any) => {
                    if (this.contentEditor) {
                        this.contentEditor.setWordWrap(evt.target.checked);
                    }
                }
            }),
            this.inlineChildrenCheckBox = state.node.hasChildren ? new Checkbox("Inline Children", false) : null
        ]);

        let selectionsBar = new FormInline(null, [
            this.setTypeButton = !typeLocked ? new Button("Set Type", this.openChangeNodeTypeDlg) : null,
            this.encryptionButton = !customProps ? new Button("Encryption", this.openEncryptionDlg, null, "btn-secondary marginRight") : null,
            this.layoutSelection = state.node.hasChildren ? this.createLayoutSelection() : null,
            this.prioritySelection = this.createPrioritySelection(),
        ]);
        this.imgSizeSelection = S.props.hasImage(state.node) ? this.createImgSizeSelection() : null

        // This is the table that contains the custom editable properties inside the collapsable panel at the bottom.
        let propsTable = null;
        let mainPropsTable = null;

        //if customProps exists then the props are all added into 'editPropsTable' instead of the collapsible panel
        if (!customProps) {
            propsTable = new EditPropsTable({
                className: "edit-props-table form-group-border"
            });
            //This is the container that holds the custom properties if provided, or else the name+content textarea at the top of not
            mainPropsTable = new EditPropsTable();
        }
        else {
            //This is the container that holds the custom properties if provided, or else the name+content textarea at the top of not
            mainPropsTable = new EditPropsTable({
                className: "edit-props-table form-group-border"
            });
        }

        let propsParent: CompIntf = customProps ? mainPropsTable : propsTable;

        let isWordWrap = !S.props.getNodePropVal(J.NodeProp.NOWRAP, state.node);
        this.wordWrapCheckBox.setChecked(isWordWrap);

        if (!customProps) {
            this.nodeNameTextField = new TextField("Node Name", state.node.name);
        }

        if (allowContentEdit) {
            //We use 4 rows instead of 15 only if this is a customProps node.
            let rows = "15"
            if (customProps && !!customProps.find(p => p == "content")) {
                rows = "4";
            }

            if (!customProps || (customProps && !!customProps.find(p => p == "content"))) {
                let contentTableRow = this.makeContentEditorFormGroup(state.node, isWordWrap, rows);
                mainPropsTable.addChild(contentTableRow);
                this.contentEditor.setWordWrap(isWordWrap);
            }
        }

        this.propCheckBoxes = [];

        if (state.node.properties) {
            state.node.properties.forEach((prop: J.PropertyInfo) => {
                if (prop.name == J.NodeProp.LAYOUT) {
                    if (this.layoutSelection) {
                        this.layoutSelection.setSelection(prop.value);
                    }
                    return;
                }

                if (prop.name == J.NodeProp.PRIORITY) {
                    this.prioritySelection.setSelection(prop.value);
                    return;
                }

                if (prop.name == J.NodeProp.IMG_SIZE) {
                    if (this.imgSizeSelection) {
                        this.imgSizeSelection.setSelection(prop.value);
                    }
                    return;
                }

                if (prop.name == J.NodeProp.INLINE_CHILDREN) {
                    if (this.inlineChildrenCheckBox) {
                        this.inlineChildrenCheckBox.setChecked(true);
                    }
                    return;
                }

                if (!allowEditAllProps && !S.render.allowPropertyEdit(state.node, prop.name, this.appState)) {
                    console.log("Hiding property: " + prop.name);
                    return;
                }

                if (allowEditAllProps || (
                    !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {

                    if (!this.isGuiControlBasedProp(prop)) {
                        let allowSelection = !customProps || !customProps.find(p => p == prop.name);
                        let tableRow = this.makePropEditor(typeHandler, prop, allowSelection);
                        propsParent.addChild(tableRow);
                    }
                }
            });
        }

        if (!propsParent.childrenExist()) {
            propsParent.addChild(new TextContent("No custom properties."));
        }

        let allowPropertyAdd: boolean = typeHandler ? typeHandler.getAllowPropertyAdd() : true;

        if (allowPropertyAdd) {
            this.propsButtonBar = new ButtonBar([
                this.addPropertyButton = new Button("Add Property", this.addProperty),
                this.deletePropButton = new Button("Delete Property", this.deletePropertyButtonClick),
            ]);

            this.deletePropButton.setEnabled(false);

            propsParent.addChild(this.propsButtonBar);
        }

        let collapsiblePanel = !customProps ? new CollapsiblePanel("More...", null, [optionsBar, selectionsBar, propsTable, this.nodeNameTextField], false,
            (state: boolean) => {
                EditNodeDlg.morePanelExpanded = state;
            }, EditNodeDlg.morePanelExpanded, "float-right") : null;

        let binarySection: LayoutRow = null;
        if (hasAttachment) {
            let ipfsLink = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, state.node);

            binarySection = new LayoutRow([
                new Div(null, { className: "col-4 editBinaryContainer" }, [
                    new NodeCompBinary(state.node, true),
                ]),

                new Div(null, {
                    className: "col-8"
                }, [
                    this.imgSizeSelection,
                    new ButtonBar([
                        this.deleteUploadButton = new Button("Delete", this.deleteUpload, { title: "Delete this Attachment" }),
                        this.uploadButton = new Button("Replace", this.upload, { title: "Upload a new Attachment" }),
                        ipfsLink ? new Button("IPFS Link", () => S.render.showNodeUrl(state.node, this.appState), { title: "Show the IPFS URL for the attached file." }) : null,
                    ]),
                    ipfsLink ? new Div("Stored on IPFS (https://temporal.cloud)", { className: "marginTop" }) : null,
                ]),

            ], "binaryEditorSection")
        }

        this.propertyEditFieldContainer.setChildren([mainPropsTable, binarySection, collapsiblePanel]);
        return children;
    }

    isGuiControlBasedProp = (prop: J.PropertyInfo): boolean => {
        return !!S.props.controlBasedPropertyList.has(prop.name);
    }

    toggleShowReadOnly = (): void => {
        // alert("not yet implemented.");
        // see saveNode for how to iterate all properties, although I wonder why I didn't just use a map/set of
        // properties elements
        // instead so I don't need to parse any DOM or domIds inorder to iterate over the list of them????
    }

    addProperty = async (): Promise<void> => {
        let state = this.getState();
        let dlg = new EditPropertyDlg(state.node, this.appState);
        await dlg.open();

        if (!state.node.properties) {
            state.node.properties = [];
        }
        state.node.properties.push({
            name: dlg.name,
            value: ""
        });
        this.mergeState({ state });

        //we don't need to return an actual promise here
        return null;
    }

    insertTime = (): void => {
        if (this.contentEditor) {
            this.contentEditor.insertTextAtCursor("[" + S.util.formatDate(new Date()) + "]");
        }
    }

    openChangeNodeTypeDlg = (): void => {
        let dlg = new ChangeNodeTypeDlg(this.setNodeType, this.appState);
        dlg.open();
    }

    share = (): void => {
        let state = this.getState();
        S.share.editNodeSharing(this.appState, state.node);
    }

    upload = async (): Promise<void> => {
        let state = this.getState();

        let dlg = new UploadFromFileDropzoneDlg(state.node.id, state.node, state.toIpfs, null, false, this.appState, async () => {
            await S.attachment.refreshBinaryPropsFromServer(state.node);
            this.forceRender();
            this.binaryDirty = true;
        });
        await dlg.open();
    }

    deleteUpload = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            let state = this.getState();

            /* Note: This doesn't resolve until either user clicks no on confirmation dialog or else has clicked yes and the delete
            call has fully completed. */
            let deleted: boolean = await S.attachment.deleteAttachment(state.node, this.appState);

            if (deleted) {
                S.attachment.removeBinaryProperties(state.node);
                this.forceRender();
                this.binaryDirty = true;
            }
            resolve();
        });
    }

    openEncryptionDlg = (): void => {
        let state = this.getState();
        (async () => {
            let encrypted: boolean = S.props.isEncrypted(state.node);
            let dlg = new EncryptionDlg(encrypted, this.appState);

            /* awaits until dialog is closed */
            await dlg.open();

            if (dlg.encrypted && S.props.isPublic(state.node)) {
                S.util.showMessage("Cannot encrypt a node that is shared to public. Remove public share first.", "Warning");
                return;
            }

            /* only if the encryption setting changed do we need to anything in here */
            if (encrypted !== dlg.encrypted) {

                /* If we're turning off encryption for the node */
                if (!dlg.encrypted) {
                    /* Take what's in the editor and put
                    that into this.node.content, because it's the correct and only place the correct updated text is guaranteed to be
                    in the case where the user made some changes before disabling encryption. */
                    state.node.content = this.contentEditor.getValue();
                    S.props.setNodePropVal(J.NodeProp.ENC_KEY, state.node, null);
                }
                /* Else need to ensure node is encrypted */
                else {
                    // if we need to encrypt and the content is not currently encrypted.
                    if (!state.node.content.startsWith(J.Constant.ENC_TAG)) {
                        let content = this.contentEditor.getValue();
                        this.skdp = await S.encryption.encryptSharableString(null, content);
                        state.node.content = J.Constant.ENC_TAG + this.skdp.cipherText;
                        S.props.setNodePropVal(J.NodeProp.ENC_KEY, state.node, this.skdp.cipherKey);
                    }
                }

                this.mergeState(state);
            }
        })();
    }

    setNodeType = (newType: string): void => {
        let state = this.getState();
        state.node.type = newType;
        this.mergeState({ node: state.node });
    }

    deleteProperty(propName: string) {
        S.util.ajax<J.DeletePropertyRequest, J.DeletePropertyResponse>("deleteProperty", {
            nodeId: this.getState().node.id,
            propName: propName
        }, (res) => {
            if (S.util.checkSuccess("Delete property", res)) {
                let state = this.getState();
                S.props.deleteProp(state.node, propName);
                this.mergeState(state);
            }
        });
    }

    saveCheckboxVal = (checkbox: Checkbox, propName: string, invert: boolean = false): void => {
        let val = checkbox.getChecked() ? "1" : null;
        if (invert) {
            val = (val == "1" ? null : "1");
        }
        S.props.setNodePropVal(propName, this.getState().node, val);
    }

    saveNode = async (): Promise<void> => {
        let state = this.getState();
        return new Promise<void>(async (resolve, reject) => {
            let allowEditAllProps: boolean = this.appState.isAdminUser;

            if (state.node) {
                if (this.inlineChildrenCheckBox) {
                    this.saveCheckboxVal(this.inlineChildrenCheckBox, J.NodeProp.INLINE_CHILDREN);
                }
                this.saveCheckboxVal(this.wordWrapCheckBox, J.NodeProp.NOWRAP, true);

                /* Get state of the 'layout' dropdown */
                if (this.layoutSelection) {
                    let layout = this.layoutSelection.getSelection();
                    S.props.setNodePropVal(J.NodeProp.LAYOUT, state.node, layout);
                }

                /* Get state of the 'priority' dropdown */
                let priority = this.prioritySelection.getSelection();
                S.props.setNodePropVal(J.NodeProp.PRIORITY, state.node, priority);

                if (this.imgSizeSelection) {
                    let imgSize = this.imgSizeSelection.getSelection();
                    S.props.setNodePropVal(J.NodeProp.IMG_SIZE, state.node, imgSize);
                }
            }

            let content: string;
            if (this.contentEditor) {
                content = this.contentEditor.getValue();

                //todo-1: an optimization can be done here such that if we just ENCRYPTED the node, we use this.skpd.symKey becuase that
                //will already be available
                let cipherKey = S.props.getCryptoKey(state.node, this.appState);
                if (cipherKey) {
                    content = await S.encryption.symEncryptStringWithCipherKey(cipherKey, content);
                    content = J.Constant.ENC_TAG + content;
                }
            }

            if (this.nodeNameTextField) {
                let nodeName = this.nodeNameTextField.getValue();

                //convert any empty string to null here to be sure DB storage is least amount.
                if (!nodeName) {
                    nodeName = "";
                }

                state.node.name = nodeName;
            }

            state.node.content = content;

            //console.log("calling saveNode(). PostData=" + S.util.toJson(state.node));
            S.util.ajax<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
                node: state.node
            }, (res) => {
                S.render.fadeInId = state.node.id;
                S.edit.saveNodeResponse(state.node, res, this.appState);
            });

            resolve();
        });
    }

    makePropEditor = (typeHandler: TypeHandlerIntf, propEntry: J.PropertyInfo, allowCheckbox: boolean): EditPropsTableRow => {
        let tableRow = new EditPropsTableRow();
        let allowEditAllProps: boolean = this.appState.isAdminUser;
        //console.log("Property single-type: " + propEntry.property.name);

        let isReadOnly = S.render.isReadOnlyProperty(propEntry.name);

        let formGroup = new FormGroup();
        let propVal = propEntry.value;

        let label = typeHandler ? typeHandler.getEditLabelForProp(propEntry.name) : propEntry.name;
        let propValStr = propVal ? propVal : "";
        propValStr = S.util.escapeForAttrib(propValStr);
        // console.log("making single prop editor: prop[" + propEntry.property.name + "] val[" + propEntry.property.value
        //     + "] fieldId=" + propEntry.id);

        //todo-1: actually this is wrong to just do a Textarea when it's readonly. It might be a non-multiline item here
        //and be better with a Textfield based editor
        if (!allowEditAllProps && isReadOnly) {
            let textarea = new Textarea(label + " (read-only)", {
                readOnly: "readOnly",
                disabled: "disabled"
            }, propValStr);

            formGroup.addChild(textarea);
        }
        else {
            if (allowCheckbox) {
                let checkbox: Checkbox = new Checkbox(label, false, {
                    onClick: this.propertyCheckboxChanged
                });
                this.propCheckBoxes.push(checkbox);

                this.compIdToPropMap[checkbox.getId()] = propEntry;
                formGroup.addChild(checkbox);
            }
            else {
                formGroup.addChild(new Label(label));
            }

            let valEditor: I.TextEditorIntf = null;
            let multiLine = false;

            if (multiLine) {
                if (C.ENABLE_ACE_EDITOR) {
                    valEditor = new AceEditPropTextarea(propEntry.value, "25em", null, false);
                }
                else {
                    valEditor = new Textarea(null, {
                        rows: "20",
                    }, propEntry.value);
                    valEditor.focus();
                }
            }
            else {
                //console.log("Creating TextField for property: " + propEntry.name + " value=" + propValStr);

                valEditor = new TextField(null, null, false, null, {
                    getValue: (): string => {
                        let val = S.props.getNodePropVal(propEntry.name, this.getState().node);
                        //console.log("getValue["+propEntry.name+"]=" + val);
                        return val;
                    },
                    setValue: (val: any) => {
                        //console.log("settingValue[" + propEntry.name + "]=" + val);
                        let state = this.getState();
                        S.props.setNodePropVal(propEntry.name, this.getState().node, val);
                        this.mergeState(state);
                    }
                });
            }

            formGroup.addChild(valEditor as any as Comp);
        }

        tableRow.addChildren([formGroup]);
        return tableRow;
    }

    makeContentEditorFormGroup = (node: J.NodeInfo, isWordWrap: boolean, rows: string): FormGroup => {
        let value = node.content || "";
        let formGroup = new FormGroup();
        let encrypted = value.startsWith(J.Constant.ENC_TAG);

        value = S.util.escapeForAttrib(value);
        //console.log("making field editor for val[" + value + "]");

        if (C.ENABLE_ACE_EDITOR) {
            let aceMode = node.type == J.NodeType.PLAIN_TEXT ? "ace/mode/text" : "ace/mode/markdown";
            this.contentEditor = new AceEditPropTextarea(encrypted ? "[encrypted]" : value, "25em", aceMode, isWordWrap);

            this.contentEditor.whenElm((elm: HTMLElement) => {
                let timer = setInterval(() => {
                    if ((this.contentEditor as AceEditPropTextarea).getAceEditor()) {

                        if (encrypted) {
                            //console.log('decrypting: ' + value);
                            let cipherText = value.substring(J.Constant.ENC_TAG.length);
                            (async () => {
                                let cipherKey = S.props.getCryptoKey(node, this.appState);
                                if (cipherKey) {
                                    let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

                                    //console.log('decrypted to:' + value);
                                    (this.contentEditor as AceEditPropTextarea).setValue(clearText);
                                }
                            })();
                        }

                        clearInterval(timer);
                        (this.contentEditor as AceEditPropTextarea).getAceEditor().focus();
                    }
                }, 250);
            });
        }
        else {
            this.contentEditor = new Textarea(null, {
                rows,
                //defaultValue: encrypted ? "" : value
            }, null, {
                getValue: () => {
                    let ret = this.getState().node.content;
                    if (ret.startsWith(J.Constant.ENC_TAG)) {
                        ret = "";
                    }
                    return ret;
                },
                setValue: (val: any) => {
                    /* Ignore calls to set the encrypted string during editing. */
                    if (val.startsWith(J.Constant.ENC_TAG)) {
                        return;
                    }
                    let state = this.getState();
                    state.node.content = val;
                    this.mergeState(state);
                }
            });

            this.contentEditor.whenElm((elm: HTMLElement) => {
                if (encrypted) {
                    //console.log("decrypting: " + value);
                    let cipherText = value.substring(J.Constant.ENC_TAG.length);
                    (async () => {
                        let cipherKey = S.props.getCryptoKey(node, this.appState);
                        if (cipherKey) {
                            let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });
                            //console.log("decrypted to:" + value);
                            (this.contentEditor as Textarea).setValue(clearText);
                        }
                    })();
                }
            });

            this.contentEditor.focus();
        }

        formGroup.addChild(this.contentEditor as any as Comp);
        return formGroup;
    }

    propertyCheckboxChanged = (): void => {
        if (this.areAnyPropsChecked()) {
            this.deletePropButton.setEnabled(true);
        }
        else {
            this.deletePropButton.setEnabled(false);
        }
    }

    areAnyPropsChecked = (): boolean => {
        let ret = false;

        /* Iterate over all property checkboxes */
        this.propCheckBoxes.forEach(function (checkbox: Checkbox) {
            if (checkbox.getChecked()) {
                ret = true;
                //return false to stop iterating.
                return false;
            }
        });

        return ret;
    }

    //todo-1 modify to support multiple delete of props.
    deletePropertyButtonClick = (): void => {
        new ConfirmDlg("Delete the selected properties?", "Confirm Delete",
            () => {
                this.deleteSelectedProperties();
            }, null, null, null, this.appState
        ).open();
    }

    deleteSelectedProperties = (): void => {
        /* Iterate over all property checkboxes */
        this.propCheckBoxes.forEach(function (checkbox: Checkbox) {
            if (checkbox.getChecked()) {
                let prop: J.PropertyInfo = this.compIdToPropMap[checkbox.getId()];
                this.deleteProperty(prop.name);
            }
        }, this);
    }

    cancelEdit = (): void => {
        this.close();

        if (this.binaryDirty) {
            S.meta64.refresh(this.appState);
        }
    }
}

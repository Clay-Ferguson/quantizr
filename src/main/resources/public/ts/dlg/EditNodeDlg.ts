import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { DialogBase } from "../DialogBase";
import { EditPropertyDlg } from "./EditPropertyDlg";
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
    //help: TextContent;
    propertyEditFieldContainer: Div;

    preformattedCheckBox: Checkbox;
    wordWrapCheckBox: Checkbox;
    inlineChildrenCheckBox: Checkbox;
    saveNodeButton: Button;
    setTypeButton: Button;
    encryptionButton: Button;
    insertTimeButton: Button;
    addPropertyButton: Button;
    deletePropButton: Button;
    cancelButton: Button;

    propEntries: Array<I.PropEntry>;
    editPropertyDlgInst: any;
   
    nodeNameTextField: TextField;
    contentEditor: I.TextEditorIntf;

    static morePanelExpanded: boolean = false;

    constructor(private node: J.NodeInfo) {
        super("Edit Node", "app-modal-content", false, true);
    }

    createLayoutSelection = (): Selection => {
        //todo-1: these columns need to auto-space and not go past allowed width of page display
        let selection: Selection = new Selection(null, "Layout", [
            { key: "v", val: "Vertical", selected: true },
            { key: "c2", val: "2 Columns" },
            { key: "c3", val: "3 Columns" },
            { key: "c4", val: "4 Columns" }
        ], "m-2"); // "w-25 m-2");
        return selection;
    }

    createPrioritySelection = (): Selection => {
        let selection: Selection = new Selection(null, "Priority", [
            { key: "0", val: "none", selected: true },
            { key: "1", val: "Top" },
            { key: "2", val: "High" },
            { key: "3", val: "Medium" },
            { key: "4", val: "Low" },
            { key: "5", val: "Backlog" }
        ], "m-2"); // "w-25 m-2");
        return selection;
    }

    initTitleBarComps = (): void => {
        this.extraHeaderComps = [];

        if (S.props.isEncrypted(this.node)) {
            this.extraHeaderComps.push(new Icon("", null, {
                "style": { marginLeft: '12px', verticalAlign: 'middle' },
                className: "fa fa-lock fa-lg"
            }));
        }

        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(this.node.type);
        if (typeHandler) {
            let iconClass = typeHandler.getIconClass(this.node);
            if (iconClass) {
                this.extraHeaderComps.push(new Icon("", null, {
                    "style": { marginLeft: '12px', verticalAlign: 'middle' },
                    className: iconClass
                }));
            }
        }
    }

    initChildren = (): void => {
        this.initTitleBarComps();

        this.setChildren([
            new Form(null, [
                //this.help = new TextContent("Help content."),
                new Div(null, {
                },
                    [
                        this.propertyEditFieldContainer = new Div("", {
                        }),
                    ]
                ),
                this.buttonBar = new ButtonBar(
                    [
                        this.saveNodeButton = new Button("Save", () => {
                            this.saveNode();
                            this.close();
                        }, null, "primary"),
                        this.setTypeButton = new Button("Set Type", this.openChangeNodeTypeDlg),
                        //this.insertTimeButton = new Button("Ins. Time", this.insertTime),

                        this.encryptionButton = new Button("Encryption", this.openEncryptionDlg),
                        this.cancelButton = new Button("Cancel", this.cancelEdit)
                    ])
            ])
        ]);

        let optionsBar = new Div("", null, [
            this.preformattedCheckBox = new Checkbox("Plain Text", false, {
                onChange: (evt: any) => {
                    if (this.contentEditor) {
                        this.contentEditor.setMode(evt.target.checked ? "ace/mode/text" : "ace/mode/markdown");
                    }
                }
            }),
            this.wordWrapCheckBox = new Checkbox("Word Wrap", true, {
                onChange: (evt: any) => {
                    if (this.contentEditor) {
                        this.contentEditor.setWordWrap(evt.target.checked);
                    }
                }
            }),
            this.inlineChildrenCheckBox = new Checkbox("Inline Children", false)
        ]);

        let selectionsBar = new FormInline(null, [
            this.layoutSelection = this.createLayoutSelection(),
            this.prioritySelection = this.createPrioritySelection()
        ]);

        this.propEntries = new Array<I.PropEntry>();

        let collapsiblePropsTable = new EditPropsTable({
            className: "edit-props-table form-group-border"
        });
        let editPropsTable = new EditPropsTable();

        let isPre = !!S.props.getNodePropVal(C.PRE, this.node);
        let isWordWrap = !S.props.getNodePropVal(C.NOWRAP, this.node);

        this.preformattedCheckBox.setChecked(isPre);
        this.wordWrapCheckBox.setChecked(isWordWrap);

        /* If not preformatted text, then always turn on word-wrap because for now at least this means the content
        will be in markdown mode, and we definitely want wordwrap on for markdown editing */
        if (C.ENABLE_ACE_EDITOR) {
            if (!isPre) {
                isWordWrap = true;
            }
        }

        //todo-1: does it make sense for FormGroup to contain single fields, or multiple fields? This seems wrong to have a group with one in it.
        let nodeNameFormGroup = new FormGroup();
        this.nodeNameTextField = new TextField("Node Name", null, this.node.name);
        nodeNameFormGroup.addChild(this.nodeNameTextField);

        editPropsTable.addChild(nodeNameFormGroup);

        let content = this.node.content;
        let contentTableRow = this.makeContentEditorFormGroup(this.node, isPre, isWordWrap);
        editPropsTable.addChild(contentTableRow);

        this.contentEditor.setWordWrap(isWordWrap);

        if (this.node.properties) {
            this.node.properties.forEach((prop: J.PropertyInfo) => {

                if (prop.name == "layout") {
                    this.layoutSelection.setSelection(prop.value);
                    return;
                }

                if (prop.name == "priority") {
                    this.prioritySelection.setSelection(prop.value);
                    return;
                }

                if (prop.name == "inlineChildren") {
                    this.inlineChildrenCheckBox.setChecked(true);
                    return;
                }

                if (!S.render.allowPropertyEdit(this.node, prop.name)) {
                    console.log("Hiding property: " + prop.name);
                    return;
                }

                //console.log("Creating edit field for property " + prop.name);

                let isReadOnlyProp = S.render.isReadOnlyProperty(prop.name);
                let isBinaryProp = S.render.isBinaryProperty(prop.name);

                //warning: this is NEW for the propEntries to be containing the 'content'. It used to contain everythign BUT content.
                let propEntry: I.PropEntry = new I.PropEntry(prop, isReadOnlyProp, isBinaryProp);
                this.propEntries.push(propEntry);

                if ((!isReadOnlyProp && !isBinaryProp) || S.edit.showReadOnlyProperties) {
                    let tableRow = this.makePropEditor(propEntry);
                    collapsiblePropsTable.addChild(tableRow);
                }
            });
        }

        if (!collapsiblePropsTable.childrenExist()) {
            collapsiblePropsTable.addChild(new TextContent("Node has no custom properties."));
        }

        this.propsButtonBar = new ButtonBar(
            [
                this.addPropertyButton = new Button("Add Property", this.addProperty),
                this.deletePropButton = new Button("Delete Property", this.deletePropertyButtonClick),
            ]);
        //initially disabled.
        this.deletePropButton.setEnabled(false);

        collapsiblePropsTable.addChild(this.propsButtonBar);

        let collapsiblePanel = new CollapsiblePanel("More...", null, [optionsBar, selectionsBar, collapsiblePropsTable], false,
            (state: boolean) => {
                EditNodeDlg.morePanelExpanded = state;
            }, EditNodeDlg.morePanelExpanded);

        this.propertyEditFieldContainer.setChildren([editPropsTable, collapsiblePanel]);

        //this.addPropertyButton.setVisible(!S.edit.editingUnsavedNode);
    }

    toggleShowReadOnly = (): void => {
        // alert("not yet implemented.");
        // see saveNode for how to iterate all properties, although I wonder why I didn't just use a map/set of
        // properties elements
        // instead so I don't need to parse any DOM or domIds inorder to iterate over the list of them????
    }

    addProperty = (): void => {
        (async () => {
            /* always save existing node before opening new property dialog */
            let dlg = new EditPropertyDlg({
                editNode: this.node,
                propSavedFunc: this.propertySaved
            });
            this.editPropertyDlgInst = dlg;
            await this.editPropertyDlgInst.open();
        })();
    }

    propertySaved = (): void => {
        this.rebuildDlg();
    }

    insertTime = (): void => {
        if (this.contentEditor) {
            this.contentEditor.insertTextAtCursor("[" + S.util.formatDate(new Date()) + "]");
        }
    }

    openChangeNodeTypeDlg = (): void => {
        (async () => {
            let dlg = new ChangeNodeTypeDlg(this.setNodeType);
            await dlg.open();

            //actually this happens inside setNodeType function, but really we could get rid of that callback
            //and use an await to do all that here.
            //this.rebuildDlg(); //todo-1: this is overkill. Will do it with targeted react setState eventually
        })();
    }

    openEncryptionDlg = (): void => {
        (async () => {
            let encrypted: boolean = S.props.isEncrypted(this.node);
            let dlg = new EncryptionDlg(encrypted);

            /* awaits until dialog is closed */
            await dlg.open();

            //todo-0: psudo codo i need to implement, but will require always setting isPublic first, and also while I'm at it
            //I will also add a flag 'isShared' so that an icon can be displayed for the node (at least for the owner of the node to see, if not everyone)
            // if (dlg.encrypted && this.node.isPublic) {
            //     alert("Cannot encrypt a node that is shared to public. Remove public share first.");
            //     return;
            // }

            /* only if the encryption setting changed do we need to anything in here */
            if (encrypted !== dlg.encrypted) {

                /* If we're turning off encryption for the node */
                if (!dlg.encrypted) {
                    /* Take what's in the editor and put
                    that into this.node.content, becasue it's the correct and only place the correct updated text is guaranteed to be
                    in the case where the user made some changes before disabling encryption. */
                    this.node.content = this.contentEditor.getValue();
                    S.props.setNodePropVal(J.NodeProp.ENC_KEY, this.node, null);
                }
                /* Else need to ensure node is encrypted */
                else {
                    // if we need to encrypt and the content is not currently encrypted.
                    if (!this.node.content.startsWith(J.NodeProp.ENC_TAG)) {
                        let content = this.contentEditor.getValue();
                        let skdp: SymKeyDataPackage = await S.encryption.encryptSharableString(null, content);
                        this.node.content = J.NodeProp.ENC_TAG + skdp.cypherText;
                        S.props.setNodePropVal(J.NodeProp.ENC_KEY, this.node, skdp.cypherKey);
                    }
                }

                this.rebuildDlg();
            }
        })();
    }

    setNodeType = (newType: string): void => {
        S.util.ajax<J.SetNodeTypeRequest, J.SetNodeTypeResponse>("setNodeType", {
            nodeId: this.node.id,
            type: newType
        },
            (res) => {
                this.node.type = newType;
                this.setNodeTypeResponse(res);
            });
    }

    setNodeTypeResponse = (res: any): void => {
        S.util.checkSuccess("Save properties", res);
        S.meta64.treeDirty = true;
        this.rebuildDlg();
    }

    savePropertyResponse(res: any): void {
        S.util.checkSuccess("Save properties", res);

        this.node.properties.push(res.propertySaved);
        S.meta64.treeDirty = true;
        this.rebuildDlg();
    }

    deleteProperty(propName: string) {
        new ConfirmDlg("Delete the Property: " + propName, "Confirm Delete",
            () => {
                this.deletePropertyImmediate(propName);
            }
        ).open();
    }

    deletePropertyImmediate = (propName: string) => {
        S.util.ajax<J.DeletePropertyRequest, J.DeletePropertyResponse>("deleteProperty", {
            "nodeId": this.node.id,
            "propName": propName
        }, (res) => {
            this.deletePropertyResponse(res, propName);
        });
    }

    deletePropertyResponse = (res: any, propertyToDelete: any) => {
        if (S.util.checkSuccess("Delete property", res)) {
            S.props.deleteProp(this.node, propertyToDelete);

            /* now just re-render screen from local variables */
            S.meta64.treeDirty = true;
            this.rebuildDlg();
        }
    }

    saveCheckboxVal = (checkbox: Checkbox, saveList: J.PropertyInfo[], handled: any, propName: string, invert: boolean = false): void => {
        let val = checkbox.getChecked() ? "1" : null;
        if (invert) {
            val = (val == "1" ? null : "1");
        }
        S.props.setNodePropVal(propName, this.node, val);
        handled[propName] = true;
        saveList.push({
            "name": propName,
            "value": val
        });
    }

    saveNode = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            let saveList: J.PropertyInfo[] = [];
            let handled = {};

            if (this.node) {
                this.saveCheckboxVal(this.preformattedCheckBox, saveList, handled, C.PRE);
                this.saveCheckboxVal(this.inlineChildrenCheckBox, saveList, handled, "inlineChildren");
                this.saveCheckboxVal(this.wordWrapCheckBox, saveList, handled, C.NOWRAP, true);

                /* Get state of the 'layout' dropdown */
                let layout = this.layoutSelection.getSelection();

                S.props.setNodePropVal("layout", this.node, layout);
                handled["layout"] = true;
                saveList.push({
                    "name": "layout",
                    "value": layout == "v" ? null : layout
                });

                /* Get state of the 'priority' dropdown */
                let priority = this.prioritySelection.getSelection();

                //priority value 0 is default, so if user selects that we can just delete the option and save space.
                S.props.setNodePropVal("priority", this.node, layout);
                handled["priority"] = true;
                saveList.push({
                    "name": "priority",
                    "value": priority == "0" ? null : priority
                });
            }

            let content: string;
            if (this.contentEditor) {
                content = this.contentEditor.getValue();
            }

            //todo-0: take another look at why we need this here because propEntries apparently won't contain
            //the props on node.properties.
            handled[J.NodeProp.ENC_KEY] = true;
            saveList.push({
                "name": J.NodeProp.ENC_KEY,
                "value": S.props.getNodePropVal(J.NodeProp.ENC_KEY, this.node)
            });

            let nodeName = this.nodeNameTextField.getValue();

            //convert any empty string to null here to be sure DB storage is least amount.
            if (!nodeName) {
                nodeName = null;
            }
            else {
                //todo-1: for now if user puts a colon in a node name, we can just change it for them.
                nodeName = nodeName.replace(":", "-");
            }

            /* Now scan over all properties to build up what to save */
            if (this.propEntries) {
                this.propEntries.forEach((prop: I.PropEntry) => {
                    /* Ignore this property if it's one that cannot be edited as text, or has already been handled/processed */
                    if (prop.readOnly || prop.binary || handled[prop.property.name])
                        return;

                    //console.log("property field: " + JSON.stringify(prop));
                    let propVal: string;
                    let editor: I.TextEditorIntf = prop.comp;

                    /* If we are editing with an ace editor get the value from it */
                    if (editor) {
                        propVal = editor.getValue();
                        //console.log("ACE propVal[" + prop.id + "]=" + propVal);
                    }

                    //todo-1: Is it ALWAYS true there's no way this can be different from checking the acual DB? the true content changed?
                    //if (propVal !== prop.property.value) {
                    saveList.push({
                        name: prop.property.name,
                        value: propVal
                    });
                    //}
                });
            }

            let postData = {
                nodeId: this.node.id,
                content: content,
                properties: saveList,
                name: nodeName
            };
            // console.log("calling saveNode(). PostData=" + S.util.toJson(postData));
            S.util.ajax<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", postData, (res) => {
                S.edit.saveNodeResponse(this.node, res);
            });

            resolve();
        });
    }

    makePropEditor = (propEntry: I.PropEntry): EditPropsTableRow => {
        let tableRow = new EditPropsTableRow({
        });
        //console.log("Property single-type: " + propEntry.property.name);

        let formGroup = new FormGroup();
        let propVal = propEntry.binary ? "[binary]" : propEntry.property.value;

        let label = propEntry.property.name; //S.render.sanitizePropertyName(propEntry.property.name);
        let propValStr = propVal ? propVal : "";
        propValStr = S.util.escapeForAttrib(propValStr);
        // console.log("making single prop editor: prop[" + propEntry.property.name + "] val[" + propEntry.property.value
        //     + "] fieldId=" + propEntry.id);

        //todo-1: actually this is wrong to just do a Textarea when it's readonly. It might be a non-multiline item here
        //and be better with a Textfield based editor
        if (propEntry.readOnly || propEntry.binary) {
            let textarea = new Textarea(label + " (read-only)", {
                "readonly": "readonly",
                "disabled": "disabled",
                "defaultValue": propValStr
            });

            formGroup.addChild(textarea);
        }
        else {
            let checkbox: Checkbox = new Checkbox(label, false, {
                onClick: (evt: any) => {
                    //console.log("checkbox click: evt.target.checked: "+evt.target.checked);
                    this.propertyCheckboxChanged();
                }
            });

            propEntry.checkBox = checkbox;
            formGroup.addChild(checkbox);

            let editor: I.TextEditorIntf = null;
            let multiLine = false;

            if (multiLine) {
                if (C.ENABLE_ACE_EDITOR) {
                    editor = new AceEditPropTextarea(propEntry.property.value, "25em", false, false);
                }
                else {
                    editor = new Textarea(null, {
                        rows: "20",
                        defaultValue: propEntry.property.value
                    });
                    editor.focus();
                }
            }
            else {
                editor = new TextField(null, {
                    "defaultValue": propValStr
                });
            }

            propEntry.comp = editor;
            formGroup.addChild(editor as any as Comp);
        }

        tableRow.addChildren([formGroup]);
        return tableRow;
    }

    makeContentEditorFormGroup = (node: J.NodeInfo, isPre: boolean, isWordWrap: boolean): FormGroup => {
        let value = node.content;
        let formGroup = new FormGroup();
        let encrypted = value.startsWith(J.NodeProp.ENC_TAG);

        value = S.util.escapeForAttrib(value);
        //console.log("making field editor for [" + propName + "] val[" + value + "]");

        if (C.ENABLE_ACE_EDITOR) {
            this.contentEditor = new AceEditPropTextarea(encrypted ? "[encrypted]" : value, "25em", isPre, isWordWrap);

            this.contentEditor.whenElm((elm: HTMLElement) => {
                let timer = setInterval(() => {
                    if ((this.contentEditor as AceEditPropTextarea).getAceEditor()) {

                        if (encrypted) {
                            //console.log('decrypting: ' + value);
                            let cypherText = value.substring(J.NodeProp.ENC_TAG.length);
                            (async () => {
                                let cypherKey = S.props.getCryptoKey(node);
                                if (cypherKey) {
                                    let clearText: string = await S.encryption.decryptSharableString(null, { cypherKey, cypherText });

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
                rows: "20",
                defaultValue: encrypted ? "[encrypted]" : value
            });

            this.contentEditor.whenElm((elm: HTMLElement) => {
                if (encrypted) {
                    //console.log('decrypting: ' + value);
                    let cypherText = value.substring(J.NodeProp.ENC_TAG.length);
                    (async () => {
                        let cypherKey = S.props.getCryptoKey(node);
                        if (cypherKey) {
                            let clearText: string = await S.encryption.decryptSharableString(null, { cypherKey, cypherText });
                            //console.log('decrypted to:' + value);
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
        if (this.propEntries) {
            /* Iterate over all properties */
            this.propEntries.forEach((propEntry: I.PropEntry) => {

                /* Ignore this property if it's one that cannot be edited directly */
                if (propEntry.readOnly || propEntry.binary)
                    return;

                if (propEntry.checkBox && propEntry.checkBox.getChecked()) {
                    ret = true;
                    //return false to stop iterating.
                    return false;
                }
            });
        }
        return ret;
    }

    //todo-1 modify to support multiple delete of props.
    deletePropertyButtonClick = (): void => {
        if (this.propEntries) {
            /* Iterate over all properties */
            this.propEntries.forEach((propEntry: I.PropEntry) => {

                /* Ignore this property if it's one that cannot be edited directly */
                if (propEntry.readOnly || propEntry.binary)
                    return;

                if (propEntry.checkBox && propEntry.checkBox.getChecked()) {
                    this.deleteProperty(propEntry.property.name);
                    /* for now lets' just support deleting one property at a time, and so we can return once we found a
                    checked one to delete. Would be easy to extend to allow multiple-selects in the future.
                    Returning false stops iteration */
                    return false;
                }
            });
        }
    }

    cancelEdit = (): void => {
        this.close();
    }

    init = (): void => {
        console.log("EditNodeDlg.init");
        this.initChildren();
    }

    rebuildDlg = (): void => {
        this.initChildren();
        this.domRender();
    }
}

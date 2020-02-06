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
import { Constants as cnst } from "../Constants";
import { PubSub } from "../PubSub";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { ChangeNodeTypeDlg } from "./ChangeNodeTypeDlg";
import { AceEditPropTextarea } from "../widget/AceEditPropTextarea";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
import { TextField } from "../widget/TextField";
import { EncryptionDlg } from "./EncryptionDlg";
import { EncryptionOptions } from "../EncryptionOptions";
import { FormInline } from "../widget/FormInline";
import { TextContent } from "../widget/TextContent";
import { Comp } from "../widget/base/Comp";
import { Textarea } from "../widget/Textarea";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditNodeDlg extends DialogBase {
    node: I.NodeInfo;
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
    typeName: string;
    createAtTop: boolean;

    nodeNameTextField: TextField;
    enableAce: boolean = false;
    contentEditor: I.TextEditorIntf;

    encryptionOptions: EncryptionOptions = new EncryptionOptions();

    static morePanelExpanded: boolean = false;

    constructor(args: Object) {
        super("Edit Node", "app-modal-content", false, true);

        this.typeName = (<any>args).typeName;
        this.createAtTop = (<any>args).createAtTop;
        this.node = (<any>args).node;
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

    initChildren = (): void => {
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

        let editOrderedProps: I.PropertyInfo[] = S.props.getPropertiesInEditingOrder(this.node, this.node.properties);
        //console.log("POPULATING PROPS: " + S.util.prettyPrint(editOrderedProps));

        let isPre = false;
        let isWordWrap = true;

        /* We have to scan properties in this loop before we do the loop below. So it is not redundant to have two loops
        scanning the properties. This is by design, and not a mistake */
        if (editOrderedProps) {
            editOrderedProps.forEach((prop: I.PropertyInfo) => {
                if (prop.name == cnst.PRE) {
                    isPre = true;
                    return;
                }

                if (prop.name == cnst.NOWRAP) {
                    isWordWrap = false;
                    return;
                }

                if (prop.name == cnst.ENC && prop.value == "priv") {
                    this.encryptionOptions.encryptForOwnerOnly = true;
                }

                //console.log("Populate Prop: " + prop.name + "=" + prop.value);
            });
        }

        this.preformattedCheckBox.setChecked(isPre);
        this.wordWrapCheckBox.setChecked(isWordWrap);

        /* If not preformatted text, then always turn on word-wrap because for now at least this means the content
        will be in markdown mode, and we definitely want wordwrap on for markdown editing */
        if (this.enableAce) {
            //todo-0: this needs to be revisited with enableAce turned on.
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
        let encrypted = false;

        //new logic means when turning encryption option back off we will come thru here with PRIV property not set but
        //data still encrypted but we detect still and decrypt in this case too.
        if (content.startsWith(cnst.ENC_TAG) /* && "priv" == S.props.getNodePropertyVal(cnst.ENC, this.node) */) {
            encrypted = true;
        }

        let contentTableRow = this.makeContentEditorFormGroup(content, isPre, isWordWrap, encrypted);
        editPropsTable.addChild(contentTableRow);

        this.contentEditor.setWordWrap(isWordWrap);

        if (editOrderedProps) {
            editOrderedProps.forEach((prop: I.PropertyInfo) => {

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

                /*
                 * if property not allowed to display return to bypass this property/iteration
                 */
                if (!S.render.allowPropertyToDisplay(prop.name)) {
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
            let dlg = new EncryptionDlg(this.encryptionOptions);
            await dlg.open();
            console.log("EncOptions after EncDlg: " + S.util.prettyPrint(this.encryptionOptions));
            S.props.setNodePropertyVal(cnst.ENC, this.node, this.encryptionOptions.encryptForOwnerOnly ? "priv" : null);

            this.rebuildDlg(); //todo-1: this is overkill. Will do it with targeted react setState eventually
        })();
    }

    setNodeType = (newType: string): void => {
        let postData = {
            nodeId: this.node.id,
            type: newType
        };
        S.util.ajax<I.SetNodeTypeRequest, I.SetNodeTypeResponse>("setNodeType", postData, this.setNodeTypeResponse);
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
        S.util.ajax<I.DeletePropertyRequest, I.DeletePropertyResponse>("deleteProperty", {
            "nodeId": this.node.id,
            "propName": propName
        }, (res) => {
            this.deletePropertyResponse(res, propName);
        });
    }

    deletePropertyResponse = (res: any, propertyToDelete: any) => {
        if (S.util.checkSuccess("Delete property", res)) {
            S.props.deleteProperty(this.node, propertyToDelete);

            /* now just re-render screen from local variables */
            S.meta64.treeDirty = true;
            this.rebuildDlg();
        }
    }

    saveCheckboxVal = (checkbox: Checkbox, saveList: I.PropertyInfo[], handled: any, propName: string, invert: boolean = false): void => {
        let val = checkbox.getChecked() ? "1" : null;
        if (invert) {
            val = (val == "1" ? null : "1");
        }
        S.props.setNodePropertyVal(propName, this.node, val);
        handled[propName] = true;
        saveList.push({
            "name": propName,
            "value": val
        });
    }

    saveNode = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            let saveList: I.PropertyInfo[] = [];
            let handled = {};

            if (this.node) {
                this.saveCheckboxVal(this.preformattedCheckBox, saveList, handled, cnst.PRE);
                this.saveCheckboxVal(this.inlineChildrenCheckBox, saveList, handled, "inlineChildren");
                this.saveCheckboxVal(this.wordWrapCheckBox, saveList, handled, cnst.NOWRAP, true);

                /* Get state of the 'layout' dropdown */
                let layout = this.layoutSelection.getSelection();

                S.props.setNodePropertyVal("layout", this.node, layout);
                handled["layout"] = true;
                saveList.push({
                    "name": "layout",
                    "value": layout == "v" ? null : layout
                });

                /* Get state of the 'priority' dropdown */
                let priority = this.prioritySelection.getSelection();

                //priority value 0 is default, so if user selects that we can just delete the option and save space.
                S.props.setNodePropertyVal("priority", this.node, layout);
                handled["priority"] = true;
                saveList.push({
                    "name": "priority",
                    "value": priority == "0" ? null : priority
                });

                //handle encryption setting
                handled[cnst.ENC] = true;
                saveList.push({
                    "name": cnst.ENC,
                    "value": this.encryptionOptions.encryptForOwnerOnly ? "priv" : null
                });
            }

            let content: string;
            if (this.contentEditor) {
                content = this.contentEditor.getValue();

                // if we need to encrypt and the content is not currently encrypted.
                if (content && this.encryptionOptions.encryptForOwnerOnly && !content.startsWith(cnst.ENC_TAG)) {
                    content = await S.encryption.symEncryptString(null, content);
                    content = cnst.ENC_TAG + content;
                    //console.log("Encrypted: " + content);
                }
            }

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
            S.util.ajax<I.SaveNodeRequest, I.SaveNodeResponse>("saveNode", postData, (res) => {
                S.edit.saveNodeResponse(res, {
                    savedId: this.node.id
                });
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
                if (this.enableAce) {
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

    makeContentEditorFormGroup = (value: string, isPre: boolean, isWordWrap: boolean, encrypted: boolean): FormGroup => {
        let formGroup = new FormGroup();

        value = S.util.escapeForAttrib(value);
        //console.log("making field editor for [" + propName + "] val[" + value + "]");

        if (this.enableAce) {
            this.contentEditor = new AceEditPropTextarea(encrypted ? "[encrypted]" : value, "25em", isPre, isWordWrap);

            this.contentEditor.whenElm((elm: HTMLElement) => {
                let timer = setInterval(() => {
                    if ((this.contentEditor as AceEditPropTextarea).getAceEditor()) {

                        if (encrypted) {
                            //console.log('decrypting: ' + value);
                            value = value.substring(cnst.ENC_TAG.length);
                            (async () => {
                                value = await S.encryption.symDecryptString(null, value);
                                //console.log('decrypted to:' + value);
                                (this.contentEditor as AceEditPropTextarea).setValue(value);
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
                    value = value.substring(cnst.ENC_TAG.length);
                    (async () => {
                        value = await S.encryption.symDecryptString(null, value);
                        //console.log('decrypted to:' + value);
                        (this.contentEditor as Textarea).setValue(value);
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

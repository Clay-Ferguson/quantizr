import * as I from "../Interfaces"
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
import { EditPropTextarea } from "../widget/EditPropTextarea";
import { AceEditorInfo } from "../widget/AceEditorInfo";
import { EditPropTextField } from "../widget/EditPropTextField";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
import { TextField } from "../widget/TextField";
import { EncryptionDlg } from "./EncryptionDlg";
import { EncryptionOptions } from "../EncryptionOptions";
import { FormInline } from "../widget/FormInline";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

declare var ace;

export class EditNodeDlg extends DialogBase {
    node: I.NodeInfo;
    header: Header;
    buttonBar: ButtonBar;
    propsButtonBar: ButtonBar;
    layoutSelection: Selection;
    prioritySelection: Selection;
    pathDisplay: Div;
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

    focusId: string;
    propEntries: Array<I.PropEntry>;
    editPropertyDlgInst: any;
    typeName: string;
    createAtTop: boolean;

    nodeNameTextField: TextField;
    aceEditor: any;

    /* map that allows us to lookup ace editor info specific to any field/property that is being edited by one, 
    the keys are named relative to the SubNode.java object, so the ones that are 'prp' (properties) have a 'prp' prefix */
    aceEditorMap: { [key: string]: AceEditorInfo } = {};

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
        let path: string = S.view.getPathDisplay(this.node, "<br>");

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
                    if (this.aceEditor && this.aceEditor.getAceEditor()) {
                        this.aceEditor.getAceEditor().session.setMode(evt.target.checked ? "ace/mode/text" : "ace/mode/markdown");
                    }
                }
            }),
            this.wordWrapCheckBox = new Checkbox("Word Wrap", false, {
                onChange: (evt: any) => {
                    if (this.aceEditor && this.aceEditor.getAceEditor()) {
                        this.aceEditor.getAceEditor().session.setUseWrapMode(evt.target.checked);
                    }
                }
            }),
            this.inlineChildrenCheckBox = new Checkbox("Inline Children", false)
        ]);

        let selectionsBar = new FormInline(null, [
            this.layoutSelection = this.createLayoutSelection(),
            this.prioritySelection = this.createPrioritySelection()
        ]);

        /* clear this map to get rid of old properties */
        this.propEntries = new Array<I.PropEntry>();

        let collapsiblePropsTable = new EditPropsTable({
            className: "edit-props-table"
        });
        let editPropsTable = new EditPropsTable();

        console.log("Editing existing node.");

        let editOrderedProps: I.PropertyInfo[] = S.props.getPropertiesInEditingOrder(this.node, this.node.properties);
        //console.log("POPULATING PROPS: " + S.util.prettyPrint(editOrderedProps));

        let isPre = false;
        let isWordWrap = false;

        /* We have to scan properties in this loop before we do the loop below. So it is not redundant to have two loops
        scanning the properties. This is by design, and not a mistake */
        if (editOrderedProps) {
            editOrderedProps.forEach((prop: I.PropertyInfo) => {
                if (prop.name == "pre") {
                    isPre = true;
                    this.preformattedCheckBox.setChecked(true);
                    return;
                }
                if (prop.name == "wrap") {
                    isWordWrap = true;
                    this.wordWrapCheckBox.setChecked(true);
                    return;
                }

                if (prop.name == cnst.ENC && prop.value == "priv") {
                    this.encryptionOptions.encryptForOwnerOnly = true;
                }

                //console.log("Populate Prop: " + prop.name + "=" + prop.value);
            });
        }

        /* If not preformatted text, then always turn on word-wrap because for now at least this means the content
        will be in markdown mode, and we definitely want wordwrap on for markdown editing */
        if (!isPre) {
            isWordWrap = true;
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

        let contentTableRow = this.makeTextFieldEditor("content", "Content", content, true, isPre, isWordWrap, true, encrypted);
        editPropsTable.addChild(contentTableRow);

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

                //todo-1: does PropEntry EVER need these first two arguments?
                let propEntry: I.PropEntry = new I.PropEntry(/* fieldId */ null, /* checkboxId */ null, prop, isReadOnlyProp, isBinaryProp);

                this.propEntries.push(propEntry);

                if ((!isReadOnlyProp && !isBinaryProp) || S.edit.showReadOnlyProperties) {
                    let tableRow = this.makePropEditor(propEntry, false, false);
                    collapsiblePropsTable.addChild(tableRow);
                }
            });
        }

        this.propsButtonBar = new ButtonBar(
            [
                this.addPropertyButton = new Button("Add Property", this.addProperty),
                this.deletePropButton = new Button("Delete Property", this.deletePropertyButtonClick),
            ])

        this.pathDisplay = cnst.SHOW_PATH_IN_DLGS ? new Div(path, {
            className: "alert alert-info small-padding"
        }) : null;

        let collapsiblePanel = new CollapsiblePanel("More...", null, [this.pathDisplay, optionsBar, selectionsBar, collapsiblePropsTable, this.propsButtonBar], false,
            (state: boolean) => {
                EditNodeDlg.morePanelExpanded = state;
            }, EditNodeDlg.morePanelExpanded);

        this.propertyEditFieldContainer.setChildren([editPropsTable, collapsiblePanel]);

        //this.addPropertyButton.setVisible(!S.edit.editingUnsavedNode);
    }

    toggleShowReadOnly = (): void => {
        // alert("not yet implemented.");
        // see saveExistingNode for how to iterate all properties, although I wonder why I didn't just use a map/set of
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

            //the EditPropertyDlg already has a way of calling this itself, and probably would be ok ot pass a callback into the dialog
            //rather than doing a bunch of confusing 'awaits' here
            //this.rebuildDlg(); //todo-1: this is overkill. Will do it with targeted react setState eventually
        })();
    }

    propertySaved = (): void => {
        this.rebuildDlg();
    }

    insertTime = (): void => {
        let aceEditorInfo: AceEditorInfo = this.aceEditorMap["content"];
        if (aceEditorInfo) {
            aceEditorInfo.editor.insertTextAtCursor("[" + S.util.formatDate(new Date()) + "]");
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

            if (this.encryptionOptions.encryptForOwnerOnly) {
                //todo-0: think about having a strategy of setting to "null" indicating to DELETE, adn also making it
                //not show up in the GUI if null. Blank string would be required to exist to save something empty.
                S.props.setNodePropertyVal(cnst.ENC, this.node, "priv");
            }
            else {
                S.props.deleteProperty(this.node, cnst.ENC);
            }

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

    /*
     * Deletes the property of the specified name on the node being edited, but first gets confirmation from user
     */
    deleteProperty(propName: string) {
        //console.log("Asking to confirm delete property.");
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
            /*
             * remove deleted property from client side data, so we can re-render screen without making another call to
             * server
             */
            S.props.deleteProperty(this.node, propertyToDelete);

            /* now just re-render screen from local variables */
            S.meta64.treeDirty = true;
            this.rebuildDlg();
        }
    }

    /*
     * for now just let server side choke on invalid things. It has enough security and validation to at least protect
     * itself from any kind of damage.
     */
    saveNode = (): void => {
        //due to refactoring these two functions can now be the same. todo-1
        this.saveExistingNode();
    }

    saveCheckboxVal = (checkbox: Checkbox, saveList: I.PropertyInfo[], handled: any, propName: string): void => {
        let val = checkbox.getChecked() ? "1" : null;
        S.props.setNodePropertyVal(propName, this.node, val);
        handled[propName] = true;
        saveList.push({
            "name": propName,
            "value": val
        });
    }

    saveExistingNode = async (callback: Function = null): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            /* holds list of properties to send to server. Each one having name+value properties */
            let saveList: I.PropertyInfo[] = [];
            let handled = {};

            if (this.node) {
                this.saveCheckboxVal(this.preformattedCheckBox, saveList, handled, "pre");
                this.saveCheckboxVal(this.inlineChildrenCheckBox, saveList, handled, "inlineChildren");
                this.saveCheckboxVal(this.wordWrapCheckBox, saveList, handled, "wrap");

                /* Get state of the 'layout' dropdown */
                let layout = this.layoutSelection.getSelection();

                //vertical layout is the default, so if user selects that we can just delete the option and save space.

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
            let aceEditorInfo: AceEditorInfo = this.aceEditorMap["content"];

            /* If we are editing with an ace editor get the value from it */
            if (aceEditorInfo) {
                content = aceEditorInfo.editor.getValue();

                // if we need to encrypt and the content is not currently encrypted.
                if (content && this.encryptionOptions.encryptForOwnerOnly && !content.startsWith(cnst.ENC_TAG)) {
                    content = await S.encryption.symEncryptString(null, content);
                    content = cnst.ENC_TAG + content;
                }
            }

            let nodeName = this.nodeNameTextField.getValue();

            //convert any empty string to null here to be sure DB storage is least amount.
            if (!nodeName) {
                nodeName = null;
            }

            /* Now scan over all properties to build up what to save */
            if (this.propEntries) {
                this.propEntries.forEach((prop: I.PropEntry) => {
                    /* Ignore this property if it's one that cannot be edited as text, or has already been handled/processed */
                    if (prop.readOnly || prop.binary || handled[prop.property.name])
                        return;

                    //console.log("property field: " + JSON.stringify(prop));

                    let propVal: string;
                    let aceEditorInfo: AceEditorInfo = this.aceEditorMap["prp." + prop.property.name];

                    /* If we are editing with an ace editor get the value from it */
                    if (aceEditorInfo) {
                        propVal = aceEditorInfo.editor.getValue();
                        //console.log("ACE propVal[" + prop.id + "]=" + propVal);
                    }
                    /* Else get from the plain text area we must be using (pre-ace design) */
                    else {
                        try {
                            propVal = S.util.getTextAreaValById(prop.id);
                            //console.log("TEXTAREA propVal[" + prop.id + "]=" + propVal);
                        }
                        catch (error) {
                            //todo-1: this was seeing the obsolete "sn:lastModified" and blowing up here. Need to look into it.
                            console.log("not able to get propVal for any prob with DOM ID " + prop.id);
                            propVal = "[err]";
                        }
                    }

                    if (propVal !== prop.property.value) {
                        saveList.push({
                            name: prop.property.name,
                            value: propVal
                        });
                    } else {
                        console.log("Prop didn't change: " + prop.id);
                    }
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

    makePropEditor = (propEntry: I.PropEntry, isPre: boolean, isWordWrap: boolean): EditPropsTableRow => {
        let tableRow = new EditPropsTableRow({
        });
        //console.log("Property single-type: " + propEntry.property.name);

        let formGroup = new FormGroup();
        let propVal = propEntry.binary ? "[binary]" : propEntry.property.value;

        let isPassword = propEntry.property.name == "sn:pwd"
            || propEntry.property.name == "sn:user"
            || propEntry.property.name == "sn:email";

        if (isPassword && !S.meta64.isAdminUser) {
            return null;
        }
        let label = S.render.sanitizePropertyName(propEntry.property.name);
        let propValStr = propVal ? propVal : "";
        propValStr = S.util.escapeForAttrib(propValStr);
        // console.log("making single prop editor: prop[" + propEntry.property.name + "] val[" + propEntry.property.value
        //     + "] fieldId=" + propEntry.id);

        //todo-p1: actually this is wrong to just do a Textarea when it's readonly. It might be a non-multiline item here
        //and be better with a Textfield based editor
        if (propEntry.readOnly || propEntry.binary) {
            let textarea = new EditPropTextarea(propEntry, {
                "readonly": "readonly",
                "disabled": "disabled",
                "label": label + " (read-only)",
                "defaultValue": propValStr
            });

            formGroup.addChild(textarea);
        }
        else {
            let checkbox = new Checkbox(label);
            propEntry.checkboxId = checkbox.getId();
            formGroup.addChild(checkbox);

            let editorComp: any = null;
            let multiLine = false;

            if (multiLine) {
                editorComp = new AceEditPropTextarea(propEntry.property.value, "25em", isPre, isWordWrap);
                propEntry.id = editorComp.getId();
                this.aceEditor = editorComp;

                editorComp.whenElm((elm: HTMLElement) => {
                    let timer = setInterval(() => {
                        if (editorComp.getAceEditor()) {
                            clearInterval(timer);
                            if (!multiLine) {
                                //todo-p1: this worked BUT the ace editor is doesn't do what i was hoping for here. It leaves the wrapping capability ENABLED.
                                //I guess the ultimate solution will to just go back to using conventional edit field when i only want one line of text to be edited.
                                console.log("Setting property to wrap disabled: " + propEntry.property.name);
                                //textarea.getAceEditor().setWrapBehavioursEnabled(false);
                            }
                            else {
                                editorComp.getAceEditor().focus();
                            }
                        }

                    }, 250);
                });

                this.aceEditorMap["prp." + propEntry.property.name] = new AceEditorInfo(editorComp);
            }
            else {
                //todo-p1: it's a bit inconsistent/ugly that we pass the value into this component so dramatically different than
                //we do into the AceEditPropTextarea
                editorComp = new EditPropTextField(propEntry, {
                    //"readonly": "readonly",
                    //"disabled": "disabled",
                    //"label": label,
                    "defaultValue": propValStr
                });
            }

            formGroup.addChild(editorComp);
        }

        tableRow.addChildren([formGroup]);
        return tableRow;
    }

    makeTextFieldEditor = (propName: string, prompt: string, value: string, multiLine: boolean, isPre: boolean, isWordWrap: boolean, setFocus: boolean,
        encrypted: boolean): FormGroup => {
        let formGroup = new FormGroup();

        value = S.util.escapeForAttrib(value);
        //console.log("making field editor for [" + propName + "] val[" + value + "]");
        let editorComp: any = null;

        if (multiLine) {
            editorComp = new AceEditPropTextarea(encrypted ? "[encrypted]" : value, "25em", isPre, isWordWrap);
            this.aceEditor = editorComp;

            editorComp.whenElm((elm: HTMLElement) => {
                let timer = setInterval(() => {
                    if (editorComp.getAceEditor()) {

                        if (encrypted) {
                            //console.log('decrypting: ' + value);
                            value = value.substring(cnst.ENC_TAG.length);
                            (async () => {
                                value = await S.encryption.symDecryptString(null, value);
                                //console.log('decrypted to:' + value);
                                editorComp.setValue(value);
                            })();
                        }

                        clearInterval(timer);
                        if (!multiLine) {
                            //todo-p1: this worked BUT the ace editor is doesn't do what i was hoping for here. It leaves the wrapping capability ENABLED.
                            //I guess the ultimate solution will to just go back to using conventional edit field when i only want one line of text to be edited.
                            //textarea.getAceEditor().setWrapBehavioursEnabled(false);
                        }
                        else {
                            editorComp.getAceEditor().focus();
                        }
                    }
                }, 250);
            });

            //NOTE: Not a 'prp.' property here.
            this.aceEditorMap[propName] = new AceEditorInfo(editorComp);
        }
        else {
            editorComp = new TextField(prompt, null, value);
        }

        formGroup.addChild(editorComp);

        if (setFocus) {
            this.focusId = editorComp.getId();
        }

        return formGroup;
    }

    deletePropertyButtonClick = (): void => {
        if (this.propEntries) {
            /* Iterate over all properties */
            this.propEntries.forEach((propEntry: I.PropEntry) => {

                /* Ignore this property if it's one that cannot be edited as text */
                if (propEntry.readOnly || propEntry.binary)
                    return;

                //console.log("checking to delete prop=" + propEntry.property.name);

                if (S.util.getCheckBoxStateById(propEntry.checkboxId)) {
                    //console.log("prop IS CHECKED=" + propEntry.property.name);
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

        this.whenElm((elm: HTMLElement) => {
            if (this.focusId) {
                // Before trying to set focus to something who's display style we just changed, we need to wait for the browser
                // to have it on the screen.
                setTimeout(() => {
                    if (this.aceEditor && this.aceEditor.getAceEditor()) {
                        this.aceEditor.getAceEditor().focus();
                    }
                    else {
                        S.util.delayedFocus(this.focusId);
                    }
                }, 300);
            }
        });
    }

    rebuildDlg = (): void => {
        this.initChildren();
        this.domRender();
    }
}


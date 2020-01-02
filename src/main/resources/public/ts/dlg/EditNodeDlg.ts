import * as I from "../Interfaces"
import { DialogBase } from "../DialogBase";
import { EditPropertyDlg } from "./EditPropertyDlg";
import { ConfirmDlg } from "./ConfirmDlg";
import { Button } from "../widget/Button";
import { Header } from "../widget/Header";
import { Selection } from "../widget/Selection";
import { ButtonBar } from "../widget/ButtonBar";
import { Div } from "../widget/Div";
import { TextContent } from "../widget/TextContent";
import { Textarea } from "../widget/Textarea";
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
    optionsBar: Div;
    pathDisplay: Div;
    help: TextContent;
    propertyEditFieldContainer: Div;

    preformattedCheckBox: Checkbox;
    wordWrapCheckBox: Checkbox;
    inlineChildrenCheckBox: Checkbox;
    saveNodeButton: Button;
    setTypeButton: Button;
    encryptionButton: Button;
    insertTimeButton: Button;
    addPropertyButton: Button;
    addTagsPropertyButton: Button;
    deletePropButton: Button;
    cancelButton: Button;

    focusId: string;
    propEntries: Array<I.PropEntry> = new Array<I.PropEntry>();
    editPropertyDlgInst: any;
    typeName: string;
    createAtTop: boolean;

    nodeNameTextField: TextField;
    aceEditor: any;

    /* map that allows us to lookup ace editor info specific to any field/property that is being edited by one, 
    the keys are named relative to the SubNode.java object, so the ones that are 'prp' (properties) have a 'prp' prefix */
    aceEditorMap: { [key: string]: AceEditorInfo } = {};

    encryptionOptions: EncryptionOptions = new EncryptionOptions();

    constructor(args: Object) {
        super("Edit Node", "app-modal-content-edit-dlg", false, true);

        this.typeName = (<any>args).typeName;
        this.createAtTop = (<any>args).createAtTop;
        this.node = (<any>args).node;

        this.propEntries = new Array<I.PropEntry>();

        let path: string = S.view.getPathDisplay(this.node, "<br>");

        this.setChildren([
            new Form(null, [
                this.help = new TextContent("Help content."),
                new Div(null, {
                },
                    [
                        this.propertyEditFieldContainer = new Div("", {
                        }),
                        this.pathDisplay = cnst.SHOW_PATH_IN_DLGS ? new Div(path, {
                            style: { backgroundColor: '#FAD7A0', padding: '5px', border: '1px solid lightGray' }
                        }) : null,
                    ]
                ),
                this.optionsBar = new Div("", null, [
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
                    this.inlineChildrenCheckBox = new Checkbox("Inline Children", false),
                    this.layoutSelection = this.createLayoutSelection()
                ]),
                this.buttonBar = new ButtonBar(
                    [
                        this.saveNodeButton = new Button("Save", () => {
                            this.saveNode();
                            this.close();
                        }, null),
                        this.setTypeButton = new Button("Set Type", this.openChangeNodeTypeDlg),
                        //this.insertTimeButton = new Button("Ins. Time", this.insertTime),

                        //Encryption is a work in progress. Disabling for now for end users.
                        //this.encryptionButton = new Button("Encryption", this.openEncryptionDlg),

                        this.cancelButton = new Button("Cancel", this.cancelEdit)
                    ])
            ])
        ]);

        S.domBind.whenElm(this.getId(), (elm: HTMLElement) => {
            elm.style.display = "inline-block";

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

    createLayoutSelection = (): Selection => {
        let selection: Selection = new Selection(null, [
            { key: "v", val: "Vertical", selected: true },
            { key: "c2", val: "2 Columns" },
            { key: "c3", val: "3 Columns" },
            { key: "c4", val: "4 Columns" }
        ]);
        return selection;
    }

    /*
     * Generates all the HTML edit fields and puts them into the DOM model of the property editor dialog box.
     *
     */
    populateEditNodePg = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            // S.domBind.whenElm(this.pathDisplay.getId(), (elm: HTMLElement) => {
            //     S.view.initEditPathDisplayById(elm);
            // });

            let counter = 0;

            /* clear this map to get rid of old properties */
            this.propEntries = new Array<I.PropEntry>();
            let collapsiblePropsTable = new EditPropsTable({
                className: "edit-props-table"
            });
            let editPropsTable = new EditPropsTable();

            /* editNode will be null if this is a new node being created */
            if (S.edit.editNode) {
                console.log("Editing existing node.");

                let editOrderedProps = S.props.getPropertiesInEditingOrder(S.edit.editNode, S.edit.editNode.properties);
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

                let nameTableRow = this.makeTextFieldEditor("name", "Name", S.util.getNodeName(S.edit.editNode), false, isPre, false, false);
                editPropsTable.addChild(nameTableRow);

                let content = S.edit.editNode.content;

                if (content.startsWith(cnst.ENC_TAG) && "priv" == S.props.getNodePropertyVal(cnst.ENC, S.edit.editNode)) {
                    content = content.substring(cnst.ENC_TAG.length);
                    content = await S.encryption.symDecryptString(null, content);
                }

                let contentTableRow = this.makeTextFieldEditor("content", "Content", content, true, isPre, isWordWrap, true);
                editPropsTable.addChild(contentTableRow);

                if (editOrderedProps) {
                    // Iterate PropertyInfo.java objects
                    editOrderedProps.forEach((prop: I.PropertyInfo) => {

                        if (prop.name == "layout") {
                            this.layoutSelection.setSelection(prop.value);
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

                        console.log("Creating edit field for property " + prop.name);

                        let isReadOnlyProp = S.render.isReadOnlyProperty(prop.name);
                        let isBinaryProp = S.render.isBinaryProperty(prop.name);
                        let propEntry: I.PropEntry = new I.PropEntry(/* fieldId */ null, /* checkboxId */ null, prop, isReadOnlyProp, isBinaryProp);

                        this.propEntries.push(propEntry);

                        if ((!isReadOnlyProp && !isBinaryProp) || S.edit.showReadOnlyProperties) {
                            let tableRow = this.makePropEditor(propEntry, false, false);
                            collapsiblePropsTable.addChild(tableRow);
                        }
                    });
                }
            }
            /* Editing a new node */
            else {
                let tableRow = new EditPropsTableRow();
                console.log("Editing new node.");

                tableRow.addChild(new Textarea({
                    "placeholder": "Enter new node name",
                    "label": "New Node Name"
                }));

                editPropsTable.addChild(tableRow);
            }

            //I'm not quite ready to add this button yet.
            // var toggleReadonlyVisButton = tag.button({
            //     "raised": "raised",
            //     "onClick": toggleShowReadOnly(); //
            // }, //
            //     (edit.showReadOnlyProperties ? "Hide Read-Only Properties" : "Show Read-Only Properties"));
            //
            // fields += toggleReadonlyVisButton;
            //let row = tag.div( { "display": "table-row" }, left + center + right);

            this.propsButtonBar = new ButtonBar(
                [
                    this.addPropertyButton = new Button("Add Property", this.addProperty),
                    this.addTagsPropertyButton = new Button("Add Tags", this.addTagsProperty),
                    this.deletePropButton = new Button("Delete Property", this.deletePropertyButtonClick),
                ])

            let collapsiblePanel = new CollapsiblePanel("More...", null, [this.nodeNameTextField, collapsiblePropsTable, this.propsButtonBar]);

            this.propertyEditFieldContainer.setChildren([editPropsTable, collapsiblePanel]);
            this.propertyEditFieldContainer.reactRenderToDOM();

            let instr = S.edit.editingUnsavedNode ? //
                "You may leave this field blank and a unique ID will be assigned. You only need to provide a name if you want this node to have a more meaningful URL."
                : //
                "";

            if (!instr) {
                this.help.setVisible(false);
            }
            else {
                this.help.setInnerHTML(instr);
            }

            /*
             * Allow adding of new properties as long as this is a saved node we are editing, because we don't want to start
             * managing new properties on the client side. We need a genuine node already saved on the server before we allow
             * any property editing to happen.
             */
            this.addPropertyButton.setVisible(!S.edit.editingUnsavedNode);

            let tagsPropExists = S.props.getNodePropertyVal("sn:tags", S.edit.editNode) != null;
            this.addTagsPropertyButton.setVisible(!tagsPropExists);

            // S.domBind.whenElm(this.getId(), (elm : HTMLElement) => {
            //     elm.style.display = "inline-block";
            // });

            resolve();
        });
    }

    toggleShowReadOnly = (): void => {
        // alert("not yet implemented.");
        // see saveExistingNode for how to iterate all properties, although I wonder why I didn't just use a map/set of
        // properties elements
        // instead so I don't need to parse any DOM or domIds inorder to iterate over the list of them????
    }

    addProperty = (): void => {
        /* always save existing node before opening new property dialog */
        let dlg = new EditPropertyDlg({ "editNodeDlg": this });
        this.editPropertyDlgInst = dlg;
        this.editPropertyDlgInst.open();
    }

    insertTime = (): void => {
        let aceEditorInfo: AceEditorInfo = this.aceEditorMap["content"];
        if (aceEditorInfo) {
            aceEditorInfo.editor.insertTextAtCursor("[" + S.util.formatDate(new Date()) + "]");
        }
    }

    openChangeNodeTypeDlg = (): void => {
        new ChangeNodeTypeDlg(this.setNodeType).open();
    }

    openEncryptionDlg = (): void => {
        new EncryptionDlg(this.encryptionOptions).open();
    }

    setNodeType = (newType: string): void => {
        let postData = {
            nodeId: S.edit.editNode.id,
            type: newType
        };
        S.util.ajax<I.SetNodeTypeRequest, I.SetNodeTypeResponse>("setNodeType", postData, this.setNodeTypeResponse);
    }

    setNodeTypeResponse = (res: any): void => {
        S.util.checkSuccess("Save properties", res);
        S.meta64.treeDirty = true;

        this.populateEditNodePg();
    }

    addTagsProperty = (): void => {
        if (S.props.getNodePropertyVal("sn:tags", S.edit.editNode)) {
            return;
        }

        let postData = {
            nodeId: S.edit.editNode.id,
            propertyName: "sn:tags",
            propertyValue: ""
        };
        S.util.ajax<I.SavePropertyRequest, I.SavePropertyResponse>("saveProperty", postData, this.addTagsPropertyResponse);
    }

    addTagsPropertyResponse = (res: I.SavePropertyResponse): void => {
        if (S.util.checkSuccess("Add Tags Property", res)) {
            this.savePropertyResponse(res);
        }
    }

    savePropertyResponse(res: any): void {
        S.util.checkSuccess("Save properties", res);

        S.edit.editNode.properties.push(res.propertySaved);
        S.meta64.treeDirty = true;

        this.populateEditNodePg();
    }

    /*
     * Deletes the property of the specified name on the node being edited, but first gets confirmation from user
     */
    deleteProperty(propName: string) {
        console.log("Asking to confirm delete property.");
        new ConfirmDlg("Delete the Property: " + propName, "Confirm Delete",
            () => {
                this.deletePropertyImmediate(propName);
            }
        ).open();
    }

    deletePropertyImmediate = (propName: string) => {
        S.util.ajax<I.DeletePropertyRequest, I.DeletePropertyResponse>("deleteProperty", {
            "nodeId": S.edit.editNode.id,
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
            S.props.deletePropertyFromLocalData(propertyToDelete);

            /* now just re-render screen from local variables */
            S.meta64.treeDirty = true;

            this.populateEditNodePg();
        }
    }

    /*
     * for now just let server side choke on invalid things. It has enough security and validation to at least protect
     * itself from any kind of damage.
     */
    saveNode = (): void => {
        /*
         * If editing an unsaved node it's time to run the insertNode, or createSubNode, which actually saves onto the
         * server, and will initiate further editing like for properties, etc.
         */
        if (S.edit.editingUnsavedNode) {
            this.saveNewNode(null);
        }
        /*
         * Else we are editing a saved node, which is already saved on server.
         */
        else {
            this.saveExistingNode();
        }
    }

    saveNewNode = (newNodeName?: string): void => {
        /*
         * If we didn't create the node we are inserting under, and neither did "admin", then we need to send notification
         * email upon saving this new node.
         */
        // if (S.meta64.userName != S.edit.parentOfNewNode.owner && //
        //     S.edit.parentOfNewNode.owner != "admin") {
        //     S.edit.sendNotificationPendingSave = true;
        // }

        S.meta64.treeDirty = true;
        if (S.edit.nodeInsertTarget) {
            S.util.ajax<I.InsertNodeRequest, I.InsertNodeResponse>("insertNode", {
                "parentId": S.edit.parentOfNewNode.id,
                "targetOrdinal": S.edit.nodeInsertTarget.ordinal,
                "newNodeName": newNodeName,
                "typeName": this.typeName ? this.typeName : "u"
            }, S.edit.insertNodeResponse);
        } else {
            S.util.ajax<I.CreateSubNodeRequest, I.CreateSubNodeResponse>("createSubNode", {
                "nodeId": S.edit.parentOfNewNode.id,
                "newNodeName": newNodeName,
                "typeName": this.typeName ? this.typeName : "u",
                "createAtTop": this.createAtTop
            }, S.edit.createSubNodeResponse);
        }
    }

    saveCheckboxVal = (checkbox: Checkbox, saveList: I.PropertyInfo[], handled: any, propName: string): void => {
        //todo-1: delete-node-indicator was a quick ugly hack. Need to do something reasonable instead.
        let val = checkbox.getChecked() ? "1" : "[delete-node-indicator]";
        let changed = S.props.setNodePropertyVal(propName, S.edit.editNode, val);
        if (changed) {
            handled[propName] = true;
            saveList.push({
                "name": propName,
                "value": val
            });
        }
    }

    saveExistingNode = async (callback: Function = null): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            /* holds list of properties to send to server. Each one having name+value properties */
            let saveList: I.PropertyInfo[] = [];
            let handled = {};

            if (S.edit.editNode) {
                this.saveCheckboxVal(this.preformattedCheckBox, saveList, handled, "pre");
                this.saveCheckboxVal(this.inlineChildrenCheckBox, saveList, handled, "inlineChildren");
                this.saveCheckboxVal(this.wordWrapCheckBox, saveList, handled, "wrap");

                /* Get state of the 'layout' dropdown */
                let layout = this.layoutSelection.getSelection();
                if (layout == "v") layout = "[delete-node-indicator]";
                let changed = S.props.setNodePropertyVal("layout", S.edit.editNode, layout);
                if (changed) {
                    handled["layout"] = true;
                    saveList.push({
                        "name": "layout",
                        "value": layout
                    });
                }

                //handle encryption setting
                handled[cnst.ENC] = true;
                saveList.push({
                    "name": cnst.ENC,
                    //save as 'priv' or else delete the property
                    "value": this.encryptionOptions.encryptForOwnerOnly ? "priv" : "[delete-node-indicator]"
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

            let nodeName = this.nodeNameTextField ? this.nodeNameTextField.getValue() : null;

            /* Now scan over all properties to build up what to save */
            if (this.propEntries) {
                debugger;
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
                            //todo-0: this was seeing the obsolete "sn:lastModified" and blowing up here. Need to look into it.
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
                nodeId: S.edit.editNode.id,
                content: content,
                properties: saveList,
                name: nodeName
            };
            // console.log("calling saveNode(). PostData=" + S.util.toJson(postData));
            S.util.ajax<I.SaveNodeRequest, I.SaveNodeResponse>("saveNode", postData, (res) => {
                S.edit.saveNodeResponse(res, {
                    savedId: S.edit.editNode.id
                });
            });

            resolve();
        });
    }

    makePropEditor = (propEntry: I.PropEntry, isPre: boolean, isWordWrap: boolean): EditPropsTableRow => {
        let tableRow = new EditPropsTableRow({
        });
        console.log("Property single-type: " + propEntry.property.name);

        let formGroup = new FormGroup();
        let propVal = propEntry.binary ? "[binary]" : propEntry.property.value;

        let isPassword = propEntry.property.name == cnst.PASSWORD || propEntry.property.name == "sn:pwd"
            || propEntry.property.name == "sn:user"
            || propEntry.property.name == "sn:email";

        if (isPassword && !S.meta64.isAdminUser) {
            return null;
        }
        let label = S.render.sanitizePropertyName(propEntry.property.name);
        let propValStr = propVal ? propVal : "";
        propValStr = S.util.escapeForAttrib(propValStr);
        console.log("making single prop editor: prop[" + propEntry.property.name + "] val[" + propEntry.property.value
            + "] fieldId=" + propEntry.id);

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

    makeTextFieldEditor = (propName: string, prompt: string, value: string, multiLine: boolean, isPre: boolean, isWordWrap: boolean, setFocus: boolean): FormGroup => {
        let formGroup = new FormGroup();

        value = S.util.escapeForAttrib(value);
        console.log("making field editor for [" + propName + "] val[" + value + "]");
        let editorComp: any = null;

        if (multiLine) {
            editorComp = new AceEditPropTextarea(value, "25em", isPre, isWordWrap);
            this.aceEditor = editorComp;

            editorComp.whenElm((elm: HTMLElement) => {
                let timer = setInterval(() => {
                    if (editorComp.getAceEditor()) {
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
            editorComp = new TextField({
                "placeholder": "",
                "label": prompt
            }, value);

            if (propName === "name") {
                this.nodeNameTextField = editorComp;
            }
        }

        //we add to form group only if this isn't 'name' because we put name into the collapsed area under "More..." button
        //to save space on the screen, since name is not that frequently edited
        if (propName != "name") {
            formGroup.addChild(editorComp);
        }

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
        this.populateEditNodePg();
    }
}


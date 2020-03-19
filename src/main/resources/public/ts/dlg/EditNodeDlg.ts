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

    editPropertyDlgInst: any;

    //Maps property names to the actual editor Comp (editor, checkbox, etc) that is currently editing it.
    propNameToEditorCompMap: { [key: string]: Comp } = {}; //not needed ???

    //maps the DOM ids of dom elements the property that DOM element is editing.
    compIdToPropMap: { [key: string]: J.PropertyInfo } = {};
    propCheckBoxes: Checkbox[];

    nodeNameTextField: TextField;
    contentEditor: I.TextEditorIntf;

    static morePanelExpanded: boolean = false;

    skdp: SymKeyDataPackage;

    //This flag can be turned on during debugging to force ALL properties to be editable. Maybe there should be some way for users
    //to dangerously opt into this also without hacking the code with this var.
    //For admin user we need a checkbox for this (todo-0)
    allowEditAllProps: boolean = true;

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
                        }, null, "btn-primary"),
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

        let collapsiblePropsTable = new EditPropsTable({
            className: "edit-props-table form-group-border"
        });
        let editPropsTable = new EditPropsTable();

        let isPre = !!S.props.getNodePropVal(J.NodeProp.PRE, this.node);
        let isWordWrap = !S.props.getNodePropVal(J.NodeProp.NOWRAP, this.node);

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

        this.propCheckBoxes = [];

        if (this.node.properties) {
            this.node.properties.forEach((prop: J.PropertyInfo) => {

                if (prop.name == J.NodeProp.LAYOUT) {
                    this.layoutSelection.setSelection(prop.value);
                    return;
                }

                if (prop.name == J.NodeProp.PRIORITY) {
                    this.prioritySelection.setSelection(prop.value);
                    return;
                }

                if (prop.name == J.NodeProp.INLINE_CHILDREN) {
                    this.inlineChildrenCheckBox.setChecked(true);
                    return;
                }

                //console.log("Creating edit field for property " + prop.name);

                if (!this.allowEditAllProps && !S.render.allowPropertyEdit(this.node, prop.name)) {
                    console.log("Hiding property: " + prop.name);
                    return;
                }

                if (this.allowEditAllProps || (
                    !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {
                    let tableRow = this.makePropEditor(prop);
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
            }, EditNodeDlg.morePanelExpanded, "float-right");

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

            if (dlg.encrypted && S.props.isPublic(this.node)) {
                S.util.showMessage("Cannot encrypt a node that is shared to public. Remove public share first.");
                return;
            }

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
                    if (!this.node.content.startsWith(J.Constant.ENC_TAG)) {
                        let content = this.contentEditor.getValue();
                        this.skdp = await S.encryption.encryptSharableString(null, content);
                        this.node.content = J.Constant.ENC_TAG + this.skdp.cipherText;
                        S.props.setNodePropVal(J.NodeProp.ENC_KEY, this.node, this.skdp.cipherKey);
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
        this.rebuildDlg();
    }

    savePropertyResponse(res: any): void {
        S.util.checkSuccess("Save properties", res);

        this.node.properties.push(res.propertySaved);
        this.rebuildDlg();
    }

    deleteProperty(propName: string) {
        S.util.ajax<J.DeletePropertyRequest, J.DeletePropertyResponse>("deleteProperty", {
            "nodeId": this.node.id,
            "propName": propName
        }, (res) => {
            this.deletePropertyResponse(res, propName);
        });
    }

    deletePropertyResponse = (res: any, prop: any) => {
        if (S.util.checkSuccess("Delete property", res)) {
            S.props.deleteProp(this.node, prop);
            this.rebuildDlg();
        }
    }

    saveCheckboxVal = (checkbox: Checkbox, propName: string, invert: boolean = false): void => {
        let val = checkbox.getChecked() ? "1" : null;
        if (invert) {
            val = (val == "1" ? null : "1");
        }
        S.props.setNodePropVal(propName, this.node, val);
    }

    saveNode = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {

            if (this.node) {
                this.saveCheckboxVal(this.preformattedCheckBox, J.NodeProp.PRE);
                this.saveCheckboxVal(this.inlineChildrenCheckBox, J.NodeProp.INLINE_CHILDREN);
                this.saveCheckboxVal(this.wordWrapCheckBox, J.NodeProp.NOWRAP, true);

                /* Get state of the 'layout' dropdown */
                let layout = this.layoutSelection.getSelection();
                S.props.setNodePropVal(J.NodeProp.LAYOUT, this.node, layout);

                /* Get state of the 'priority' dropdown */
                let priority = this.prioritySelection.getSelection();
                S.props.setNodePropVal(J.NodeProp.PRIORITY, this.node, priority);
            }

            let content: string;
            if (this.contentEditor) {

                content = this.contentEditor.getValue();

                //todo-1: an optimization can be done here such that if we just ENCRYPTED the node, we use this.skpd.symKey becuase that
                //will already be available
                let cipherKey = S.props.getCryptoKey(this.node);
                if (cipherKey) {
                    content = await S.encryption.symEncryptStringWithCipherKey(cipherKey, content);
                    content = J.Constant.ENC_TAG + content;
                }
            }

            let nodeName = this.nodeNameTextField.getValue();

            //convert any empty string to null here to be sure DB storage is least amount.
            if (!nodeName) {
                nodeName = "";
            }

            this.node.name = nodeName;
            this.node.content = content;
            let newProps: J.PropertyInfo[] = [];

            /* Now scan over all properties to build up what to save */
            if (this.node.properties) {
                this.node.properties.forEach((prop: J.PropertyInfo) => {

                    //console.log("prop to save?: "+prop.name);

                    /* Ignore this property if it's one that cannot be edited as text, or has already been handled/processed */
                    if (!this.allowEditAllProps && S.render.isReadOnlyProperty(prop.name)) {
                        return;
                    }

                    let comp = this.propNameToEditorCompMap[prop.name] as any as I.TextEditorIntf;
                    if (comp) {
                        prop.value = comp.getValue();
                        //console.log("value from editor comp: "+prop.value);
                    }

                    newProps.push(prop);
                });
            }
            this.node.properties = newProps;

            //console.log("calling saveNode(). PostData=" + S.util.toJson(this.node));
            S.util.ajax<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
                node: this.node
            }, (res) => {
                S.edit.saveNodeResponse(this.node, res);
            });

            resolve();
        });
    }

    makePropEditor = (propEntry: J.PropertyInfo): EditPropsTableRow => {
        let tableRow = new EditPropsTableRow({});
        //console.log("Property single-type: " + propEntry.property.name);

        let isReadOnly = S.render.isReadOnlyProperty(propEntry.name);

        let formGroup = new FormGroup();
        let propVal = propEntry.value;

        let label = propEntry.name; //S.render.sanitizePropertyName(propEntry.property.name);
        let propValStr = propVal ? propVal : "";
        propValStr = S.util.escapeForAttrib(propValStr);
        // console.log("making single prop editor: prop[" + propEntry.property.name + "] val[" + propEntry.property.value
        //     + "] fieldId=" + propEntry.id);

        //todo-1: actually this is wrong to just do a Textarea when it's readonly. It might be a non-multiline item here
        //and be better with a Textfield based editor
        if (!this.allowEditAllProps && isReadOnly) {
            let textarea = new Textarea(label + " (read-only)", {
                "readOnly": "readOnly",
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
            this.propCheckBoxes.push(checkbox);
            this.compIdToPropMap[checkbox.getId()] = propEntry;

            formGroup.addChild(checkbox);

            let editor: I.TextEditorIntf = null;
            let multiLine = false;

            if (multiLine) {
                if (C.ENABLE_ACE_EDITOR) {
                    editor = new AceEditPropTextarea(propEntry.value, "25em", false, false);
                }
                else {
                    editor = new Textarea(null, {
                        rows: "20",
                        defaultValue: propEntry.value
                    });
                    editor.focus();
                }
            }
            else {
                editor = new TextField(null, {
                    "defaultValue": propValStr
                });
            }
            this.propNameToEditorCompMap[propEntry.name] = editor as any as Comp;

            formGroup.addChild(editor as any as Comp);
        }

        tableRow.addChildren([formGroup]);
        return tableRow;
    }

    makeContentEditorFormGroup = (node: J.NodeInfo, isPre: boolean, isWordWrap: boolean): FormGroup => {
        let value = node.content;
        let formGroup = new FormGroup();
        let encrypted = value.startsWith(J.Constant.ENC_TAG);

        value = S.util.escapeForAttrib(value);
        //console.log("making field editor for [" + propName + "] val[" + value + "]");

        if (C.ENABLE_ACE_EDITOR) {
            this.contentEditor = new AceEditPropTextarea(encrypted ? "[encrypted]" : value, "25em", isPre, isWordWrap);

            this.contentEditor.whenElm((elm: HTMLElement) => {
                let timer = setInterval(() => {
                    if ((this.contentEditor as AceEditPropTextarea).getAceEditor()) {

                        if (encrypted) {
                            //console.log('decrypting: ' + value);
                            let cipherText = value.substring(J.Constant.ENC_TAG.length);
                            (async () => {
                                let cipherKey = S.props.getCryptoKey(node);
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
                rows: "20",
                defaultValue: encrypted ? "[encrypted]" : value
            });

            this.contentEditor.whenElm((elm: HTMLElement) => {
                if (encrypted) {
                    //console.log('decrypting: ' + value);
                    let cipherText = value.substring(J.Constant.ENC_TAG.length);
                    (async () => {
                        let cipherKey = S.props.getCryptoKey(node);
                        if (cipherKey) {
                            let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });
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

        /* Iterate over all property checkboxes */
        this.propCheckBoxes.forEach((checkbox: Checkbox) => {
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
            }
        ).open();
    }

    deleteSelectedProperties = (): void => {
        /* Iterate over all property checkboxes */
        this.propCheckBoxes.forEach((checkbox: Checkbox) => {
            if (checkbox.getChecked()) {
                let prop: J.PropertyInfo = this.compIdToPropMap[checkbox.getId()];
                this.deleteProperty(prop.name);
            }
        });
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

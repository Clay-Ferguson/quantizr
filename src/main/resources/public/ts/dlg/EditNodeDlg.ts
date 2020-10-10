import { AppState } from "../AppState";
import { NodeCompBinary } from "../comps/NodeCompBinary";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { SplitNodeDlg } from "../dlg/SplitNodeDlg";
import { NodeActionType } from "../enums/NodeActionType";
import * as I from "../Interfaces";
import { ValueIntf } from "../Interfaces";
import { SymKeyDataPackage } from "../intf/EncryptionIntf";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PropValueHolder } from "../PropValueHolder";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { AceEditPropTextarea } from "../widget/AceEditPropTextarea";
import { Comp } from "../widget/base/Comp";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
import { DateTimeField } from "../widget/DateTimeField";
import { Div } from "../widget/Div";
import { EditPropsTable } from "../widget/EditPropsTable";
import { EditPropsTableRow } from "../widget/EditPropsTableRow";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { FormInline } from "../widget/FormInline";
import { Header } from "../widget/Header";
import { Icon } from "../widget/Icon";
import { Label } from "../widget/Label";
import { LayoutRow } from "../widget/LayoutRow";
import { Selection } from "../widget/Selection";
import { Textarea } from "../widget/Textarea";
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";
import { ChangeNodeTypeDlg } from "./ChangeNodeTypeDlg";
import { ConfirmDlg } from "./ConfirmDlg";
import { EditPropertyDlg } from "./EditPropertyDlg";
import { EncryptionDlg } from "./EncryptionDlg";
import { UploadFromFileDropzoneDlg } from "./UploadFromFileDropzoneDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class EditNodeDlg extends DialogBase {
    header: Header;
    propertyEditFieldContainer: Div;
    uploadButton: Button;
    deleteUploadButton: Button;
    deletePropButton: Button;

    // maps the DOM ids of dom elements the property that DOM element is editing.
    compIdToPropMap: { [key: string]: J.PropertyInfo } = {};

    contentEditor: I.TextEditorIntf;

    static morePanelExpanded: boolean = false;

    skdp: SymKeyDataPackage;

    // if user uploads or deletes an upload we set this, to force refresh when dialog closes even if they don't click save.
    binaryDirty: boolean = false;

    /* Since some of our property editing (the Selection components) modify properties 'in-place' in the node we have
    this initialProps clone so we can 'rollback' properties if use clicks cancel */
    initialProps: J.PropertyInfo[];

    constructor(node: J.NodeInfo, state: AppState) {
        super("Edit", "app-modal-content", false, state);
        this.mergeState({
            node,

            // selected props is used as a set of all 'selected' (via checkbox) property names
            selectedProps: new Set<string>()
        });
        this.initialProps = S.util.arrayClone(node.properties);
    }

    createLayoutSelection = (): Selection => {
        // todo-1: these columns need to auto-space and not go past allowed width of page display
        let selection: Selection = new Selection(null, "Layout", [
            { key: "v", val: "Vertical" },
            { key: "c2", val: "2 Columns" },
            { key: "c3", val: "3 Columns" },
            { key: "c4", val: "4 Columns" },
            { key: "c5", val: "5 Columns" },
            { key: "c6", val: "6 Columns" }
        ], "m-2", new PropValueHolder(this.getState().node, J.NodeProp.LAYOUT, "v")); // w-25
        return selection;
    }

    createPrioritySelection = (): Selection => {
        let selection: Selection = new Selection(null, "Priority", [
            { key: "0", val: "none" },
            { key: "1", val: "Top" },
            { key: "2", val: "High" },
            { key: "3", val: "Medium" },
            { key: "4", val: "Low" },
            { key: "5", val: "Backlog" }
        ], "m-2", new PropValueHolder(this.getState().node, J.NodeProp.PRIORITY, "0"));
        return selection;
    }

    createImgSizeSelection = (label: string, allowNone: boolean, valueIntf: ValueIntf): Selection => {
        let options = [];

        if (allowNone) {
            // none means we would ignore the option during rendering, slightly different from "Actual" in cases
            // where this is an override that we don't want to override with. 'none' means don't override.
            options.push({ key: "n", val: "None" });
        }

        options = options.concat([
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
            { key: "1000px", val: "1000px" }
        ]);

        let selection: Selection = new Selection(null, label, options, "m-2", valueIntf);
        return selection;
    }

    getTitleIconComp(): CompIntf {
        let state = this.getState();

        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(state.node.type);
        if (typeHandler) {
            let iconClass = typeHandler.getIconClass();
            if (iconClass) {
                return new Icon({
                    style: { marginRight: "12px", verticalAlign: "middle" },
                    className: iconClass
                });
            }
        }
        return null;
    }

    getTitleText(): string {
        let state = this.getState();
        let ret = null;

        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(state.node.type);
        if (typeHandler) {
            ret = "Edit (" + typeHandler.getName() + ")";
        }
        else {
            ret = "Edit";
        }
        return ret;
    }

    getExtraTitleBarComps(): CompIntf[] {
        let state = this.getState();
        let comps: CompIntf[] = [];

        if (S.props.isEncrypted(state.node)) {
            comps.push(new Icon({
                style: { marginLeft: "12px", verticalAlign: "middle" },
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

        // This flag can be turned on during debugging to force ALL properties to be editable. Maybe there should be some way for users
        // to dangerously opt into this also without hacking the code with this var.
        let allowEditAllProps: boolean = this.appState.isAdminUser;

        // let allowUpload: boolean = typeHandler ? (state.isAdminUser || typeHandler.allowAction(NodeActionType.upload, state.node, this.appState)) : true;
        // let allowShare = true;

        let children = [
            new Form(null, [
                // this.help = new TextContent("Help content."),
                new Div(null, {
                }, [
                    this.propertyEditFieldContainer = new Div("", {
                    })
                ])
                //     //this.insertTimeButton = new Button("Ins. Time", this.insertTime),
                //     this.cancelButton = new Button("Cancel", this.cancelEdit)
                // ])
            ])
        ];

        let optionsBar = new Div("", null, [
            new Checkbox("Word Wrap", {
                className: "marginRight"
            }, {
                setValue: (checked: boolean): void => {
                    // this is counter-intuitive that we invert here because 'NOWRAP' is a negation of "wrap"
                    S.props.setNodePropVal(J.NodeProp.NOWRAP, state.node, checked ? null : "1");
                    if (this.contentEditor) {
                        this.contentEditor.setWordWrap(checked);
                    }
                },
                getValue: (): boolean => {
                    return S.props.getNodePropVal(J.NodeProp.NOWRAP, state.node) !== "1";
                }
            }),

            // todo-1: temporarily disabling since Quanta will have it's own Gateway from now on.
            // new Checkbox("Save To IPFS", {
            //     className: "marginRight",
            // }, this.makeCheckboxPropValueHandler(J.NodeProp.SAVE_TO_IPFS)),

            state.node.hasChildren ? new Checkbox("Inline Children", null,
                this.makeCheckboxPropValueHandler(J.NodeProp.INLINE_CHILDREN)) : null
        ]);

        let selectionsBar = new FormInline(null, [
            state.node.hasChildren ? this.createLayoutSelection() : null,
            state.node.hasChildren ? this.createImgSizeSelection("Images", true, //
                new PropValueHolder(this.getState().node, J.NodeProp.CHILDREN_IMG_SIZES, "n")) : null,
            this.createPrioritySelection()
        ]);

        let imgSizeSelection = S.props.hasImage(state.node) ? this.createImgSizeSelection("Image Size", false, //
            new PropValueHolder(this.getState().node, J.NodeProp.IMG_SIZE, "100%")) : null;

        // This is the table that contains the custom editable properties inside the collapsable panel at the bottom.
        let propsTable = null;
        let mainPropsTable = null;

        // if customProps exists then the props are all added into 'editPropsTable' instead of the collapsible panel
        if (!customProps) {
            propsTable = new EditPropsTable({
                className: "edit-props-table form-group-border"
            });
            // This is the container that holds the custom properties if provided, or else the name+content textarea at the top of not
            mainPropsTable = new EditPropsTable();
        }
        else {
            // This is the container that holds the custom properties if provided, or else the name+content textarea at the top of not
            mainPropsTable = new EditPropsTable({
                className: "edit-props-table form-group-border"
            });
        }

        let propsParent: CompIntf = customProps ? mainPropsTable : propsTable;
        let isWordWrap = !S.props.getNodePropVal(J.NodeProp.NOWRAP, state.node);

        let nodeNameTextField = null;
        if (!customProps) {
            nodeNameTextField = new TextField("Node Name", false, null, null, {
                setValue: (val: string): void => {
                    this.getState().node.name = val || "";
                    nodeNameTextField.forceRender();
                },

                getValue: (): string => {
                    return this.getState().node.name;
                }
            });
        }

        if (allowContentEdit) {
            let hasContentProp = typeHandler && typeHandler.hasCustomProp("content");

            // We use 4 rows instead of 15 only if this is a customProps node.
            let rows = "15";
            if (customProps && hasContentProp) {
                rows = "4";
            }

            if (!customProps || hasContentProp) {
                let contentTableRow = this.makeContentEditorFormGroup(state.node, isWordWrap, rows);
                mainPropsTable.addChild(contentTableRow);
                this.contentEditor.setWordWrap(isWordWrap);
            }
        }

        if (state.node.properties) {
            // This loop creates all the editor input fields for all the properties
            state.node.properties.forEach((prop: J.PropertyInfo) => {

                if (!allowEditAllProps && !S.render.allowPropertyEdit(state.node, prop.name, this.appState)) {
                    console.log("Hiding property: " + prop.name);
                    return;
                }

                if (allowEditAllProps || (
                    !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {

                    if (!this.isGuiControlBasedProp(prop)) {
                        let allowSelection = !customProps || !customProps.find(p => p === prop.name);
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
            let propsButtonBar: ButtonBar = new ButtonBar([
                new Button("Add Property", this.addProperty),
                this.deletePropButton = new Button("Delete Property", this.deletePropertyButtonClick)
            ]);

            this.deletePropButton.setEnabled(false);
            propsParent.addChild(propsButtonBar);
        }

        let collapsiblePanel = !customProps ? new CollapsiblePanel(null, null, null, [
            nodeNameTextField, optionsBar, selectionsBar, propsTable
        ], false,
            (state: boolean) => {
                EditNodeDlg.morePanelExpanded = state;
            }, EditNodeDlg.morePanelExpanded, "float-right") : null;

        let binarySection: LayoutRow = null;
        if (hasAttachment) {
            let ipfsLink = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, state.node);

            binarySection = new LayoutRow([
                new Div(null, { className: "col-6 editBinaryContainer" }, [
                    new Div("Attachment", {
                        className: "smallHeading"
                    }),
                    new NodeCompBinary(state.node, true, false, null)
                ]),

                new Div(null, {
                    className: "col-6"
                }, [
                    imgSizeSelection,
                    new ButtonBar([
                        this.deleteUploadButton = new Button("Delete", this.deleteUpload, { title: "Delete this Attachment" }),
                        this.uploadButton = new Button("Replace", this.upload, { title: "Upload a new Attachment" }),
                        ipfsLink ? new Button("IPFS Link", () => S.render.showNodeUrl(state.node, this.appState), { title: "Show the IPFS URL for the attached file." }) : null
                    ], null, "float-right"),
                    ipfsLink ? new Div("Stored on IPFS", { className: "marginTop" }) : null
                ])

            ], "binaryEditorSection");
        }

        this.propertyEditFieldContainer.setChildren([mainPropsTable, binarySection, collapsiblePanel]);
        return children;
    }

    makeCheckboxPropValueHandler(propName: string): I.ValueIntf {
        return {
            setValue: (checked: boolean): void => {
                S.props.setNodePropVal(propName, this.getState().node, checked ? "1" : null);
            },
            getValue: (): boolean => {
                return S.props.getNodePropVal(propName, this.getState().node) === "1";
            }
        };
    }

    renderButtons(): CompIntf {
        let state = this.getState();

        let hasAttachment: boolean = S.props.hasBinary(state.node);

        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(state.node.type);
        let customProps: string[] = null;
        if (typeHandler) {
            customProps = typeHandler.getCustomProperties();
            typeHandler.ensureDefaultProperties(state.node);
        }

        // let allowContentEdit: boolean = typeHandler ? typeHandler.getAllowContentEdit() : true;

        // //regardless of value, if this property is present we consider the type locked
        // let typeLocked = !!S.props.getNodePropVal(J.NodeProp.TYPE_LOCK, state.node);

        // //This flag can be turned on during debugging to force ALL properties to be editable. Maybe there should be some way for users
        // //to dangerously opt into this also without hacking the code with this var.
        // let allowEditAllProps: boolean = this.appState.isAdminUser;

        let allowUpload: boolean = typeHandler ? (state.isAdminUser || typeHandler.allowAction(NodeActionType.upload, state.node, this.appState)) : true;
        let allowShare = true;

        let typeLocked = !!S.props.getNodePropVal(J.NodeProp.TYPE_LOCK, state.node);

        return new ButtonBar([
            new Button("Save", () => {
                this.saveNode();
                this.close();
            }, null, "btn-primary"),

            new Button("Cancel", this.cancelEdit, null, "btn-secondary bigMarginRight"),

            this.uploadButton = (!hasAttachment && allowUpload) ? new Button("Upload", this.upload) : null,
            allowShare ? new Button("Share", this.share) : null,

            !typeLocked ? new Button("Type", this.openChangeNodeTypeDlg) : null,
            !customProps ? new Button("Encrypt", this.openEncryptionDlg) : null,

            // show delete button only if we're in a fullscreen viewer (like Calendar view)
            S.meta64.fullscreenViewerActive(this.appState)
                ? new Button("Delete", () => {
                    S.edit.deleteSelNodes(state.node.id, false);
                    this.close();
                }) : null

            // this.insertTimeButton = new Button("Ins. Time", this.insertTime),
        ]);
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

        if (dlg.name) {
            if (!state.node.properties) {
                state.node.properties = [];
            }
            state.node.properties.push({
                name: dlg.name,
                value: ""
            });
            this.mergeState({ state });
        }
        // we don't need to return an actual promise here
        return null;
    }

    insertTime = (): void => {
        if (this.contentEditor) {
            this.contentEditor.insertTextAtCursor("[" + S.util.formatDate(new Date()) + "]");
        }
    }

    openChangeNodeTypeDlg = (): void => {
        new ChangeNodeTypeDlg(this.getState().node.type, this.setNodeType, this.appState).open();
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

    saveNode = async (): Promise<void> => {
        let state = this.getState();
        return new Promise<void>(async (resolve, reject) => {

            let content: string;
            if (this.contentEditor) {
                content = this.contentEditor.getValue();

                // todo-1: an optimization can be done here such that if we just ENCRYPTED the node, we use this.skpd.symKey becuase that
                // will already be available
                let cipherKey = S.props.getCryptoKey(state.node, this.appState);
                if (cipherKey) {
                    content = await S.encryption.symEncryptStringWithCipherKey(cipherKey, content);
                    content = J.Constant.ENC_TAG + content;
                }
            }
            if (content) {
                content = content.trim();
            }
            state.node.content = content;
            await S.edit.updateIpfsNodeJson(state.node, this.appState);

            let askToSplit = state.node.content && ((state.node as J.NodeInfo).content.indexOf("{split}") !== -1 ||
                (state.node as J.NodeInfo).content.indexOf("\n\n\n") !== -1);

            // console.log("calling saveNode(). PostData=" + S.util.prettyPrint(state.node));

            S.util.ajax<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
                updateModTime: true,
                node: state.node
            }, (res) => {
                S.render.fadeInId = state.node.id;
                S.edit.saveNodeResponse(state.node, res, true, this.appState);

                if (askToSplit) {
                    new SplitNodeDlg(state.node, this.appState).open();
                }
            });

            resolve();
        });
    }

    makePropEditor = (typeHandler: TypeHandlerIntf, propEntry: J.PropertyInfo, allowCheckbox: boolean): EditPropsTableRow => {
        let tableRow = new EditPropsTableRow();
        let allowEditAllProps: boolean = this.appState.isAdminUser;
        // console.log("Property single-type: " + propEntry.name);

        let isReadOnly = S.render.isReadOnlyProperty(propEntry.name);

        let formGroup = new FormGroup();
        let propVal = propEntry.value;

        let label = typeHandler ? typeHandler.getEditLabelForProp(propEntry.name) : propEntry.name;
        let propValStr = propVal || "";
        propValStr = S.util.escapeForAttrib(propValStr);
        // console.log("making single prop editor: prop[" + propEntry.property.name + "] val[" + propEntry.property.value
        //     + "] fieldId=" + propEntry.id);

        // todo-1: actually this is wrong to just do a Textarea when it's readonly. It might be a non-multiline item here
        // and be better with a Textfield based editor
        if (!allowEditAllProps && isReadOnly) {
            let textarea = new Textarea(label + " (read-only)", {
                readOnly: "readOnly",
                disabled: "disabled"
            }, {
                getValue: () => {
                    // read-only. always return original value.
                    return propValStr;
                },
                setValue: (val: any) => {
                    // this is a read-only field
                }
            });

            formGroup.addChild(textarea);
        }
        else {
            if (allowCheckbox) {
                let checkbox: Checkbox = new Checkbox(label, null, {
                    setValue: (checked: boolean): void => {
                        let state = this.getState();
                        if (checked) {
                            state.selectedProps.add(propEntry.name);
                        }
                        else {
                            state.selectedProps.delete(propEntry.name);
                        }
                        this.deletePropButton.setEnabled(state.selectedProps.size > 0);
                    },
                    getValue: (): boolean => {
                        return this.getState().selectedProps.has(propEntry.name);
                    }
                });

                this.compIdToPropMap[checkbox.getId()] = propEntry;
                formGroup.addChild(checkbox);
            }
            else {
                formGroup.addChild(new Label(label));
            }

            let valEditor: CompIntf = null;
            let multiLine = false;

            let valueIntf = {
                getValue: (): string => {
                    let val = S.props.getNodePropVal(propEntry.name, this.getState().node);
                    // console.log("getValue[" + propEntry.name + "]=" + val);
                    return val;
                },
                setValue: (val: any) => {
                    // console.log("settingValue[" + propEntry.name + "]=" + val);
                    let state = this.getState();
                    S.props.setNodePropVal(propEntry.name, this.getState().node, val);
                    this.mergeState(state);
                }
            };

            if (multiLine) {
                if (C.ENABLE_ACE_EDITOR) {
                    valEditor = new AceEditPropTextarea(propEntry.value, "25em", null, false);
                }
                else {
                    valEditor = new Textarea(null, {
                        rows: "20"
                    }, valueIntf);
                }
            }
            else {
                /* todo-1: eventually we will have data types, but for now we use a hack
                to detect to treat a string as a date based on its property name. */
                if (propEntry.name === "date") {

                    // Ensure we have set the default time if none is yet set.
                    let val = S.props.getNodePropVal(propEntry.name, this.getState().node);
                    if (!val) {
                        valueIntf.setValue("" + new Date().getTime());
                    }

                    valEditor = new DateTimeField(valueIntf);
                }
                else {
                    // console.log("Creating TextField for property: " + propEntry.name + " value=" + propValStr);
                    valEditor = new TextField(null, false, null, S.props.getInputClassForType(propEntry.name), valueIntf);
                }
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

        // if this is the first pass thru here (not a re-render) then allow focus() to get called
        let allowFocus = !this.contentEditor;

        value = S.util.escapeForAttrib(value);
        // console.log("making field editor for val[" + value + "]");

        if (C.ENABLE_ACE_EDITOR) {
            let aceMode = node.type === J.NodeType.PLAIN_TEXT ? "ace/mode/text" : "ace/mode/markdown";
            this.contentEditor = new AceEditPropTextarea(encrypted ? "[Encrypted]" : value, "25em", aceMode, isWordWrap);

            this.contentEditor.whenElm((elm: HTMLElement) => {
                let timer = setInterval(() => {
                    if ((this.contentEditor as AceEditPropTextarea).getAceEditor()) {

                        if (encrypted) {
                            // console.log('decrypting: ' + value);
                            let cipherText = value.substring(J.Constant.ENC_TAG.length);
                            (async () => {
                                let cipherKey = S.props.getCryptoKey(node, this.appState);
                                if (cipherKey) {
                                    let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

                                    if (clearText == null) {
                                        (this.contentEditor as Textarea).setError("Decryption Failed");
                                    }
                                    else {
                                        // console.log('decrypted to:' + value);
                                        (this.contentEditor as AceEditPropTextarea).setValue(clearText);
                                    }
                                }
                            })();
                        }

                        clearInterval(timer);

                        if (allowFocus) {
                            (this.contentEditor as AceEditPropTextarea).getAceEditor().focus();
                        }
                    }
                }, 250);
            });
        }
        else {
            this.contentEditor = new Textarea(null, {
                rows
            }, {
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
                    // console.log("decrypting: " + value);
                    let cipherText = value.substring(J.Constant.ENC_TAG.length);
                    (async () => {
                        let cipherKey = S.props.getCryptoKey(node, this.appState);
                        if (cipherKey) {
                            let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

                            if (clearText == null) {
                                (this.contentEditor as Textarea).setError("Decryption Failed");
                            }
                            else {
                                // console.log("decrypted to:" + value);
                                (this.contentEditor as Textarea).setValue(clearText);
                            }
                        }
                    })();
                }
            });

            if (allowFocus) {
                this.contentEditor.focus();
            }
        }

        formGroup.addChild(this.contentEditor as any as Comp);
        return formGroup;
    }

    deletePropertyButtonClick = (): void => {
        new ConfirmDlg("Delete the selected properties?", "Confirm Delete",
            () => {
                this.deleteSelectedProperties();
            }, null, null, null, this.appState
        ).open();
    }

    deleteSelectedProperties = (): void => {
        this.getState().selectedProps.forEach(propName => this.deleteProperty(propName), this);
    }

    cancelEdit = (): void => {
        this.close();

        // rollback properties.
        this.getState().node.properties = this.initialProps;

        if (this.binaryDirty) {
            S.meta64.refresh(this.appState);
        }
    }
}

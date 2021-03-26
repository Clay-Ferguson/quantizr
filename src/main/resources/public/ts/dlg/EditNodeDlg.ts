import { AppState } from "../AppState";
import clientInfo from "../ClientInfo";
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
import { ValidatedState } from "../ValidatedState";
import { AceEditPropTextarea } from "../widget/AceEditPropTextarea";
import { Comp } from "../widget/base/Comp";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { CollapsiblePanel } from "../widget/CollapsiblePanel";
import { DateTimeField } from "../widget/DateTimeField";
import { Div } from "../widget/Div";
import { EditPropsTable } from "../widget/EditPropsTable";
import { EditPropsTableRow } from "../widget/EditPropsTableRow";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { FormInline } from "../widget/FormInline";
import { Header } from "../widget/Header";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { Icon } from "../widget/Icon";
import { Label } from "../widget/Label";
import { LayoutRow } from "../widget/LayoutRow";
import { Selection } from "../widget/Selection";
import { Span } from "../widget/Span";
import { TextArea } from "../widget/TextArea";
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
    static parentDisplayExpanded: boolean = false;
    static helpExpanded: boolean = false;
    editorHelp: string = null;
    header: Header;
    propertyEditFieldContainer: Div;
    uploadButton: Button;
    deleteUploadButton: Button;
    deletePropButton: Button;

    contentEditor: I.TextEditorIntf;
    contentEditorState: ValidatedState<any> = new ValidatedState<any>();
    parentContentEditorState: ValidatedState<any> = new ValidatedState<any>();
    nameState: ValidatedState<any> = new ValidatedState<any>();

    // holds a map of states by property names.
    propStates: Map<string, ValidatedState<any>> = new Map<string, ValidatedState<any>>();

    static morePanelExpanded: boolean = false;

    // if user uploads or deletes an upload we set this, to force refresh when dialog closes even if they don't click save.
    binaryDirty: boolean = false;

    /* Since some of our property editing (the Selection components) modify properties 'in-place' in the node we have
    this initialProps clone so we can 'rollback' properties if use clicks cancel */
    initialProps: J.PropertyInfo[];

    allowEditAllProps: boolean = false;

    constructor(node: J.NodeInfo, public parentNode: J.NodeInfo, state: AppState) {
        super("Edit", "app-modal-content", false, state);
        this.mergeState({
            node,

            // selected props is used as a set of all 'selected' (via checkbox) property names
            selectedProps: new Set<string>()
        });
        this.allowEditAllProps = this.appState.isAdminUser;
        this.initStates();
        this.initialProps = S.util.arrayClone(node.properties);
    }

    initStates = (): void => {
        let state = this.getState();

        /* Init main content text on node */
        let value = state.node.content || "";
        value = S.util.escapeForAttrib(value);
        if (!value.startsWith(J.Constant.ENC_TAG)) {
            this.contentEditorState.setValue(value);
        }
        else {
            this.contentEditorState.setValue("");
        }

        /* Init parent node text */
        let parentValue = (this.parentNode ? this.parentNode.content : null) || "";
        parentValue = S.util.escapeForAttrib(parentValue);
        if (!parentValue.startsWith(J.Constant.ENC_TAG)) {
            this.parentContentEditorState.setValue(parentValue);
        }
        else {
            this.parentContentEditorState.setValue("");
        }

        /* Initialize node name state */
        this.nameState.setValue(state.node.name);

        this.initPropStates(state.node, false);
    }

    /* Initializes the propStates for every property in 'node', and optionally if 'onlyBinaries==true' then we process ONLY
    the properties on node that are in 'S.props.allBinaryProps' list, which is how we have to update the propStates after
    an upload has been added or removed. */
    initPropStates = (node: J.NodeInfo, onlyBinaries: boolean): any => {
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        let customProps: string[] = null;
        if (typeHandler) {
            customProps = typeHandler.getCustomProperties();
            typeHandler.ensureDefaultProperties(node);
        }

        /* If we're updating binaries from the node properties, we need to wipe all the existing ones first to account for
        props that need to be removed */
        if (onlyBinaries) {
            S.props.allBinaryProps.forEach(s => {
                if (this.propStates.get(s)) {
                    this.propStates.delete(s);
                }
            });
        }

        if (node.properties) {
            node.properties.forEach((prop: J.PropertyInfo) => {
                // console.log("prop: " + S.util.prettyPrint(prop));

                // if onlyBinaries and this is NOT a binary prop then skip it.
                if (onlyBinaries) {
                    if (S.props.allBinaryProps.has(prop.name)) {
                        this.initPropState(node, typeHandler, prop, false);
                    }
                    return;
                }

                if (!this.allowEditAllProps && !S.render.allowPropertyEdit(node, prop.name, this.appState)) {
                    // ("Hiding property: " + prop.name);
                    return;
                }

                if (this.allowEditAllProps || (
                    !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {

                    if (!this.isGuiControlBasedProp(prop)) {
                        let allowSelection = !customProps || !customProps.find(p => p === prop.name);
                        this.initPropState(node, typeHandler, prop, allowSelection);
                    }
                }
            });
        }
    }

    initPropState = (node: J.NodeInfo, typeHandler: TypeHandlerIntf, propEntry: J.PropertyInfo, allowCheckbox: boolean): void => {
        let allowEditAllProps: boolean = this.appState.isAdminUser;
        let isReadOnly = S.render.isReadOnlyProperty(propEntry.name);
        let propVal = propEntry.value;
        let propValStr = propVal || "";
        propValStr = S.util.escapeForAttrib(propValStr);
        // console.log("making single prop editor: prop[" + propEntry.property.name + "] val[" + propEntry.property.value
        //     + "] fieldId=" + propEntry.id);

        let propState: ValidatedState<any> = this.propStates.get(propEntry.name);
        if (!propState) {
            propState = new ValidatedState<any>();
            this.propStates.set(propEntry.name, propState);
        }

        if (!allowEditAllProps && isReadOnly) {
            propState.setValue(propValStr);
        }
        else {
            let val = S.props.getNodePropVal(propEntry.name, node);
            propState.setValue(val);

            /* todo-1: eventually we will have data types, but for now we use a hack
            to detect to treat a string as a date based on its property name. */
            if (propEntry.name === J.NodeProp.DATE) {
                // Ensure we have set the default time if none is yet set.
                if (!propState.getValue()) {
                    propState.setValue("" + new Date().getTime());
                }
            }
        }
    }

    createLayoutSelection = (): Selection => {
        let selection: Selection = new Selection(null, "Layout", [
            { key: "v", val: "1 column" },
            { key: "c2", val: "2 columns" },
            { key: "c3", val: "3 columns" },
            { key: "c4", val: "4 columns" },
            { key: "c5", val: "5 columns" },
            { key: "c6", val: "6 columns" }
        ], "m-2", "", new PropValueHolder(this.getState().node, J.NodeProp.LAYOUT, "v")); // w-25
        return selection;
    }

    createPrioritySelection = (): Selection => {
        return new Selection(null, "Priority", [
            { key: "0", val: "none" },
            { key: "1", val: "Top" },
            { key: "2", val: "High" },
            { key: "3", val: "Medium" },
            { key: "4", val: "Low" },
            { key: "5", val: "Backlog" }
        ], "m-2", "", new PropValueHolder(this.getState().node, J.NodeProp.PRIORITY, "0"));
    }

    createImgSizeSelection = (label: string, allowNone: boolean, extraClasses: string, valueIntf: ValueIntf): Selection => {
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
            { key: "50px", val: "50px" },
            { key: "100px", val: "100px" },
            { key: "200px", val: "200px" },
            { key: "300px", val: "300px" },
            { key: "400px", val: "400px" },
            { key: "800px", val: "800px" },
            { key: "1000px", val: "1000px" }
        ]);

        return new Selection(null, label, options, "m-2 width-7rem", extraClasses, valueIntf);
    }

    getTitleIconComp(): CompIntf {
        let state = this.getState();
        let span: Span = null;

        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(state.node.type);
        if (typeHandler) {
            let iconClass = typeHandler.getIconClass();
            if (iconClass) {
                if (!span) span = new Span();
                span.addChild(new Icon({
                    title: `Node is a '${typeHandler.getName()}' type.`,
                    style: { marginRight: "12px", verticalAlign: "middle" },
                    className: iconClass
                }));
            }
        }

        if (S.props.getNodePropVal(J.NodeProp.DATE, state.node)) {
            EditNodeDlg.morePanelExpanded = true;
            if (!span) span = new Span();
            span.addChild(new Icon({
                title: "Node has a 'Date' property.",
                style: { marginRight: "12px", verticalAlign: "middle" },
                className: "fa fa-calendar fa-lg"
            }));
        }

        return span;
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

        this.editorHelp = null;
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(state.node.type);
        let customProps: string[] = null;
        if (typeHandler) {
            customProps = typeHandler.getCustomProperties();
            typeHandler.ensureDefaultProperties(state.node);
            this.editorHelp = typeHandler.getEditorHelp();
        }

        let allowContentEdit: boolean = typeHandler ? typeHandler.getAllowContentEdit() : true;

        // let allowUpload: boolean = typeHandler ? (state.isAdminUser || typeHandler.allowAction(NodeActionType.upload, state.node, this.appState)) : true;
        // let allowShare = true;

        let children = [
            new Form(null, [
                new Div(null, {
                }, [
                    this.propertyEditFieldContainer = new Div("", {
                    })
                ])
            ])
        ];

        let wordWrapCheckbox = new Checkbox("Word Wrap", { className: "marginLeft" }, {
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
        });

        /* Note: Using FormInline causes the elements to be laid out left to right, rather than one per row */
        let selectionsBar = new FormInline(null, [
            state.node.hasChildren ? this.createLayoutSelection() : null,
            state.node.hasChildren ? this.createImgSizeSelection("Images", true, null, //
                new PropValueHolder(this.getState().node, J.NodeProp.CHILDREN_IMG_SIZES, "n")) : null,
            this.createPrioritySelection(),

            state.node.hasChildren ? new Checkbox("Inline Children", null,
                this.makeCheckboxPropValueHandler(J.NodeProp.INLINE_CHILDREN)) : null,
            wordWrapCheckbox
        ]);

        let imgSizeSelection = S.props.hasImage(state.node) ? this.createImgSizeSelection("Image Size", false, "float-right", //
            new PropValueHolder(this.getState().node, J.NodeProp.IMG_SIZE, "100%")) : null;

        // This is the table that contains the custom editable properties inside the collapsable panel at the bottom.
        let propsTable: Comp = null;
        let mainPropsTable: Comp = null;

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
            nodeNameTextField = new TextField("Node Name", false, null, null, false, this.nameState);
        }

        if (allowContentEdit) {
            let hasContentProp = typeHandler && typeHandler.hasCustomProp("content");
            let rows = this.appState.mobileMode ? "8" : "15";
            if (customProps && hasContentProp) {
                rows = "4";
            }

            if (!customProps || hasContentProp) {
                let contentTableRow = this.makeContentEditorFormGroup(state.node, isWordWrap, rows);
                mainPropsTable.addChild(contentTableRow);
                this.contentEditor.setWordWrap(isWordWrap);
            }
        }

        let numPropsShowing: number = 0;
        if (state.node.properties) {
            // This loop creates all the editor input fields for all the properties
            state.node.properties.forEach((prop: J.PropertyInfo) => {
                // console.log("prop=" + S.util.prettyPrint(prop));

                if (!this.allowEditAllProps && !S.render.allowPropertyEdit(state.node, prop.name, this.appState)) {
                    console.log("Hiding property: " + prop.name);
                    return;
                }

                if (this.allowEditAllProps || (
                    !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {

                    if (!this.isGuiControlBasedProp(prop)) {
                        let allowSelection = !customProps || !customProps.find(p => p === prop.name);
                        let tableRow = this.makePropEditor(typeHandler, prop, allowSelection, typeHandler ? typeHandler.getEditorRowsForProp(prop.name) : 1);
                        numPropsShowing++;
                        propsParent.addChild(tableRow);
                    }
                }
            });
        }

        let allowPropertyAdd: boolean = typeHandler ? typeHandler.getAllowPropertyAdd() : true;
        if (allowPropertyAdd) {
            if (numPropsShowing > 0) {
                let propsButtonBar: ButtonBar = new ButtonBar([
                    new Button("Add Property", this.addProperty),
                    this.deletePropButton = new Button("Delete Property", this.deletePropertyButtonClick)
                ]);

                this.deletePropButton.setEnabled(false);
                propsParent.addChild(propsButtonBar);
            }
        }

        let binarySection: LayoutRow = null;
        if (hasAttachment) {
            let ipfsLink = S.props.getNodePropVal(J.NodeProp.IPFS_LINK, state.node);
            let mime = S.props.getNodePropVal(J.NodeProp.BIN_MIME, state.node);

            let pinCheckbox: Checkbox = null;
            if (ipfsLink) {
                pinCheckbox = new Checkbox("IPFS Pinned", { className: "ipfsPinnedCheckbox" }, {
                    setValue: (checked: boolean): void => {
                        if (checked) {
                            this.deleteProperty(J.NodeProp.IPFS_REF);
                        }
                        else {
                            S.props.setNodePropVal(J.NodeProp.IPFS_REF, this.getState().node, "1");
                        }
                    },
                    getValue: (): boolean => {
                        return S.props.getNodeProp(J.NodeProp.IPFS_REF, state.node) ? false : true;
                    }
                });
            }

            // NOTE: col numbers in the children of LayoutRow must add up to 12 (per bootstrap)!
            let topBinRow = new LayoutRow([
                new Div(null, { className: "col-4" }, [
                    new Div((ipfsLink ? "IPFS " : "") + "Attachment", {
                        className: "smallHeading"
                    }),
                    new NodeCompBinary(state.node, true, false, null)
                ]),

                new Div(null, {
                    className: "col-8"
                }, [
                    new Div(null, null, [
                        new HorizontalLayout([
                            imgSizeSelection,
                            pinCheckbox
                        ])
                    ]),
                    new ButtonBar([
                        this.deleteUploadButton = new Button("Delete", this.deleteUpload, { title: "Delete this Attachment" }),
                        this.uploadButton = new Button("Replace", this.upload, { title: "Upload a new Attachment" })

                        // todo-1: this is not doing what I want but it unimportant so removing it for now.
                        // ipfsLink ? new Button("IPFS Link", () => S.render.showNodeUrl(state.node, this.appState), { title: "Show the IPFS URL for the attached file." }) : null
                    ], null, "float-right marginRight")
                ])
            ]);

            let bottomBinRow = null;
            if (ipfsLink) {
                bottomBinRow = new Div(null, { className: "marginTop" }, [
                    ipfsLink ? new Div(`CID: ${ipfsLink}`) : null,
                    ipfsLink ? new Div(`Type: ${mime}`) : null
                ]);
            }

            binarySection = new Div(null, { className: "marginLeft binaryEditorSection editBinaryContainer" }, [
                topBinRow, bottomBinRow
            ]);
        }

        let sharingNames = S.util.getSharingNames(state.node, false);
        let sharingSpan = null;
        if (sharingNames) {
            sharingSpan = new Span("Shared to: " + sharingNames);
        }

        let helpPanel = this.editorHelp ? new CollapsibleHelpPanel("Help", this.editorHelp,
            (state: boolean) => {
                EditNodeDlg.helpExpanded = state;
            }, EditNodeDlg.helpExpanded, "span") : null;

        let parentDisplay = null;
        if (this.parentNode) {
            let parentContentEditor = new TextArea(null, { rows: "5" }, this.parentContentEditorState);
            let parentVal = this.parentNode.content || "";
            if (!parentVal.startsWith(J.Constant.ENC_TAG)) {
                let wrap: boolean = S.props.getNodePropVal(J.NodeProp.NOWRAP, this.parentNode) !== "1";
                parentContentEditor.setWordWrap(wrap);

                let whoTo = this.parentNode.owner === this.appState.userName ? "your own" : (this.parentNode.owner + "'s");

                parentDisplay = new CollapsiblePanel("Show Parent Content", "Hide Parent Content", null, [
                    new Div("Creating under " + whoTo + " node", { className: "marginTop" }),
                    parentContentEditor
                ], false,
                    (state: boolean) => {
                        EditNodeDlg.parentDisplayExpanded = state;
                    }, EditNodeDlg.parentDisplayExpanded, "", "", "span");
            }
        }

        let expandables = new Div(null, { className: "marginBottom" }, [
            parentDisplay,
            helpPanel]);

        // if this props table would be empty don't display it (set to null)
        if (propsTable && !propsTable.childrenExist()) {
            propsTable = null;
        }

        let collapsiblePanel = !customProps ? new CollapsiblePanel(null, null, null, [
            nodeNameTextField, selectionsBar, propsTable
        ], false,
            (state: boolean) => {
                EditNodeDlg.morePanelExpanded = state;
            }, EditNodeDlg.morePanelExpanded, "float-right") : null;

        this.propertyEditFieldContainer.setChildren([mainPropsTable, sharingSpan, binarySection, collapsiblePanel, expandables]);
        return children;
    }

    countPropsShowing = (): number => {
        let state = this.getState();
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(state.node.type);
        let customProps: string[] = null;
        if (typeHandler) {
            customProps = typeHandler.getCustomProperties();
            typeHandler.ensureDefaultProperties(state.node);
            this.editorHelp = typeHandler.getEditorHelp();
        }

        let numPropsShowing: number = 0;
        if (state.node.properties) {
            // This loop creates all the editor input fields for all the properties
            state.node.properties.forEach((prop: J.PropertyInfo) => {
                // console.log("prop=" + S.util.prettyPrint(prop));

                if (!this.allowEditAllProps && !S.render.allowPropertyEdit(state.node, prop.name, this.appState)) {
                    // console.log("Hiding property: " + prop.name);
                    return;
                }

                if (this.allowEditAllProps || (
                    !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {

                    if (!this.isGuiControlBasedProp(prop)) {
                        let allowSelection = !customProps || !customProps.find(p => p === prop.name);
                        let tableRow = this.makePropEditor(typeHandler, prop, allowSelection, typeHandler ? typeHandler.getEditorRowsForProp(prop.name) : 1);
                        numPropsShowing++;
                    }
                }
            });
        }
        return numPropsShowing;
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

        let allowPropertyAdd: boolean = typeHandler ? typeHandler.getAllowPropertyAdd() : true;

        // let allowContentEdit: boolean = typeHandler ? typeHandler.getAllowContentEdit() : true;

        // //regardless of value, if this property is present we consider the type locked
        // let typeLocked = !!S.props.getNodePropVal(J.NodeProp.TYPE_LOCK, state.node);

        let allowUpload: boolean = typeHandler ? (state.isAdminUser || typeHandler.allowAction(NodeActionType.upload, state.node, this.appState)) : true;
        let allowShare: boolean = typeHandler ? (state.isAdminUser || typeHandler.allowAction(NodeActionType.share, state.node, this.appState)) : true;

        let typeLocked = !!S.props.getNodePropVal(J.NodeProp.TYPE_LOCK, state.node);
        let datePropExists = S.props.getNodeProp(J.NodeProp.DATE, state.node);

        let numPropsShowing = this.countPropsShowing();

        return new ButtonBar([
            new Button("Save", () => {
                this.saveNode();
                this.close();
            }, null, "btn-primary"),

            new Button("Cancel", this.cancelEdit, null, "btn-secondary bigMarginRight"),

            this.uploadButton = (!hasAttachment && allowUpload) ? new Button("Attach", this.upload) : null,
            allowShare ? new Button("Share", this.share) : null,

            new Button("Type", this.openChangeNodeTypeDlg),
            !customProps ? new Button("Encrypt", this.openEncryptionDlg) : null,
            allowPropertyAdd && numPropsShowing === 0 ? new Button("Props", this.addProperty) : null,

            // show delete button only if we're in a fullscreen viewer (like Calendar view)
            S.meta64.fullscreenViewerActive(this.appState)
                ? new Button("Delete", () => {
                    S.edit.deleteSelNodes(null, state.node.id);
                    this.close();
                }) : null,

            new Icon({
                className: "fa fa-clock-o fa-lg insertTimeIcon",
                title: "Insert current time at editor cursor.",
                onClick: this.insertTime
            }),
            !datePropExists ? new Icon({
                className: "fa fa-calendar fa-lg insertTimeIcon",
                title: "Insert Date property on node",
                onClick: this.addDateProperty
            }) : null
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

        if (dlg.nameState.getValue()) {
            if (!state.node.properties) {
                state.node.properties = [];
            }
            state.node.properties.push({
                name: dlg.nameState.getValue(),
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

    addDateProperty = (): void => {
        let state = this.getState();
        if (!state.node.properties) {
            state.node.properties = [];
        }

        if (S.props.getNodeProp(J.NodeProp.DATE, state.node)) {
            return;
        }

        state.node.properties.push({
            name: J.NodeProp.DATE,
            value: new Date().getTime()
        });

        state.node.properties.push({
            name: J.NodeProp.DURATION,
            value: "01:00"
        });

        // Ensure the have the panel expanded so we can see the new date.
        EditNodeDlg.morePanelExpanded = true;
        this.mergeState({ state });
    }

    openChangeNodeTypeDlg = (): void => {
        new ChangeNodeTypeDlg(this.getState().node.type, this.setNodeType, this.appState).open();
    }

    share = async (): Promise<void> => {
        let state = this.getState();
        await S.share.editNodeSharing(this.appState, state.node);
        this.mergeState({ node: state.node });
        return null;
    }

    upload = async (): Promise<void> => {
        let state = this.getState();

        let dlg = new UploadFromFileDropzoneDlg(state.node.id, "", state.toIpfs, null, false, true, this.appState, async () => {
            await this.refreshBinaryPropsFromServer(state.node);
            this.initPropStates(state.node, true);
            this.mergeState({ node: state.node });
            this.binaryDirty = true;
        });
        await dlg.open();
    }

    /* Queries the server for the purpose of just loading the binary properties into node, and leaving everything else intact */
    refreshBinaryPropsFromServer = (node: J.NodeInfo): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            S.util.ajax<J.RenderNodeRequest, J.RenderNodeResponse>("renderNode", {
                nodeId: node.id,
                upLevel: false,
                siblingOffset: 0,
                renderParentIfLeaf: false,
                offset: 0,
                goToLastPage: false,
                forceIPFSRefresh: false,
                singleNode: true
            },
                (res: J.RenderNodeResponse) => {
                    try {
                        if (res.node.properties) {
                            S.props.transferBinaryProps(res.node, node);
                        }
                    }
                    finally {
                        resolve();
                    }
                });

        });
    }

    deleteUpload = async (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let state = this.getState();

                /* Note: This doesn't resolve until either user clicks no on confirmation dialog or else has clicked yes and the delete
                call has fully completed. */
                let deleted: boolean = await S.attachment.deleteAttachment(state.node, this.appState);

                if (deleted) {
                    S.attachment.removeBinaryProperties(state.node);
                    this.initPropStates(state.node, true);
                    this.mergeState({ node: state.node });
                    this.binaryDirty = true;
                }
            } finally {
                resolve();
            }
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

            /* only if the encryption setting changed do we need to do anything here */
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

                        let skdp: SymKeyDataPackage = await S.encryption.encryptSharableString(null, content);
                        state.node.content = J.Constant.ENC_TAG + skdp.cipherText;

                        /* Set ENC_KEY to be the encrypted key, which when decrypted can be used to decrypt
                        the content of the node. This ENC_KEY was encrypted with the public key of the owner of this node,
                        and so can only be decrypted with their private key. */
                        S.props.setNodePropVal(J.NodeProp.ENC_KEY, state.node, skdp.cipherKey);
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
            propName
        }, (res) => {
            if (S.util.checkSuccess("Delete property", res)) {
                let state = this.getState();
                S.props.deleteProp(state.node, propName);
                this.mergeState(state);
            }
        });
    }

    // Takes all the propStates values and converts them into node properties on the node
    savePropsToNode = () => {
        let state = this.getState();
        if (state.node.properties) {
            state.node.properties.forEach((prop: J.PropertyInfo) => {
                // console.log("Save prop iterator: name=" + prop.name);
                let propState = this.propStates.get(prop.name);
                if (propState) {

                    // hack to store dates as numeric prop (todo-1: need a systematic way to assign JSON types to properties)
                    if (prop.name === J.NodeProp.DATE && (typeof propState.getValue() === "string")) {
                        try {
                            prop.value = parseInt(propState.getValue());
                        }
                        catch (e) {
                            console.error("failed to parse date number: " + propState.getValue());
                        }
                    }
                    else {
                        prop.value = propState.getValue();
                        // console.log("   val=" + prop.value);
                    }
                }
            });
        }
    }

    saveNode = async (): Promise<void> => {
        let state = this.getState();
        return new Promise<void>(async (resolve, reject) => {

            let content: string;
            if (this.contentEditor) {
                content = this.contentEditor.getValue();

                // todo-2: an optimization can be done here such that if we just ENCRYPTED the node, we use this.skpd.symKey because that
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
            state.node.name = this.nameState.getValue();

            let askToSplit = state.node.content && ((state.node as J.NodeInfo).content.indexOf("{split}") !== -1 ||
                (state.node as J.NodeInfo).content.indexOf("\n\n\n") !== -1);

            this.savePropsToNode();

            // console.log("calling saveNode(). PostData=" + S.util.prettyPrint(state.node));

            S.util.ajax<J.SaveNodeRequest, J.SaveNodeResponse>("saveNode", {
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

    makePropEditor = (typeHandler: TypeHandlerIntf, propEntry: J.PropertyInfo, allowCheckbox: boolean, rows: number): EditPropsTableRow => {
        let tableRow = new EditPropsTableRow();
        let allowEditAllProps: boolean = this.appState.isAdminUser;
        let isReadOnly = S.render.isReadOnlyProperty(propEntry.name);

        let formGroup = new FormGroup();
        let propVal = propEntry.value;

        let label = typeHandler ? typeHandler.getEditLabelForProp(propEntry.name) : propEntry.name;
        let propValStr = propVal || "";
        propValStr = S.util.escapeForAttrib(propValStr);
        // console.log("making single prop editor: prop[" + propEntry.name + "] val[" + propEntry.value + "]");

        let propState: ValidatedState<any> = this.propStates.get(propEntry.name);
        if (!propState) {
            propState = new ValidatedState<any>(propEntry.value);
            this.propStates.set(propEntry.name, propState);
        }

        // WARNING: propState.setValue() calls will have been done in initStates, and should NOT be set here, because this can run during render callstacks
        // which is not a valid time to be updating states

        // todo-1: actually this is wrong to just do a Textarea when it's readonly. It might be a non-multiline item here
        // and be better with a Textfield based editor
        if (!allowEditAllProps && isReadOnly) {
            let textarea = new TextArea(label + " (read-only)", {
                readOnly: "readOnly",
                disabled: "disabled"
            }, propState);

            formGroup.addChild(textarea);
        }
        else {
            if (allowCheckbox) {
                let checkbox: Checkbox = new Checkbox(label, { className: "checkboxContainerHeight" }, {
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
                formGroup.addChild(checkbox);
            }
            else {
                formGroup.addChild(new Label(label));
            }

            let valEditor: CompIntf = null;
            let multiLine = rows > 1;

            if (multiLine) {
                if (C.ENABLE_ACE_EDITOR) {
                    valEditor = new AceEditPropTextarea(propEntry.value, "" + rows + "em", null, false);
                }
                else {
                    valEditor = new TextArea(null, {
                        rows: "" + rows
                    }, propState);
                }
            }
            else {
                /* todo-1: eventually we will have data types, but for now we use a hack
                to detect to treat a string as a date based on its property name. */
                if (propEntry.name === J.NodeProp.DATE) {
                    valEditor = new DateTimeField(propState);
                }
                else {
                    // console.log("Creating TextField for property: " + propEntry.name + " value=" + propValStr);
                    valEditor = new TextField(null, false, null, S.props.getInputClassForType(propEntry.name), false, propState);
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
                                        this.contentEditorState.setError("Decryption Failed");
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
            this.contentEditor = new TextArea(null, { rows }, this.contentEditorState);

            let wrap: boolean = S.props.getNodePropVal(J.NodeProp.NOWRAP, this.appState.node) !== "1";
            this.contentEditor.setWordWrap(wrap);

            this.contentEditor.whenElm((elm: HTMLElement) => {
                if (encrypted) {
                    // console.log("decrypting: " + value);
                    let cipherText = value.substring(J.Constant.ENC_TAG.length);
                    (async () => {
                        let cipherKey = S.props.getCryptoKey(node, this.appState);
                        if (cipherKey) {
                            let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

                            if (clearText == null) {
                                this.contentEditorState.setError("Decryption Failed");
                            }
                            else {
                                // console.log("decrypted to:" + value);
                                this.contentEditorState.setValue(clearText);
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
        /* todo-1: This was a quick and dirty approach, calling the server for each property to delete. Should
        simply allow the server to accept an array */
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

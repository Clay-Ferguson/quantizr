import { dispatch, getAppState } from "../AppRedux";
import { Comp } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { CollapsiblePanel } from "../comp/core/CollapsiblePanel";
import { DateTimeField } from "../comp/core/DateTimeField";
import { Div } from "../comp/core/Div";
import { Header } from "../comp/core/Header";
import { HelpButton } from "../comp/core/HelpButton";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { Icon } from "../comp/core/Icon";
import { IconButton } from "../comp/core/IconButton";
import { Label } from "../comp/core/Label";
import { Selection } from "../comp/core/Selection";
import { Span } from "../comp/core/Span";
import { TextArea } from "../comp/core/TextArea";
import { TextContent } from "../comp/core/TextContent";
import { TextField } from "../comp/core/TextField";
import { NodeCompBinary } from "../comp/node/NodeCompBinary";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { DialogMode } from "../enums/DialogMode";
import { NodeActionType } from "../enums/NodeActionType";
import * as I from "../Interfaces";
import { ValueIntf } from "../Interfaces";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PropValueHolder } from "../PropValueHolder";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { ChangeNodeTypeDlg } from "./ChangeNodeTypeDlg";
import { LS } from "./EditNodeDlgState";
import { EditNodeDlgUtil } from "./EditNodeDlgUtil";
import { SelectTagsDlg } from "./SelectTagsDlg";

/**
 * Node Editor Dialog
 */
export class EditNodeDlg extends DialogBase {

    static autoSaveTimer: any = null;
    static currentInst: EditNodeDlg = null;

    static pendingUploadFile: File = null;

    utl: EditNodeDlgUtil = new EditNodeDlgUtil();

    static embedInstance: EditNodeDlg;
    editorHelp: string = null;
    header: Header;
    public contentEditor: I.TextEditorIntf;
    contentEditorState: ValidatedState<any> = new ValidatedState<any>();
    nameState: ValidatedState<any> = new ValidatedState<any>();
    tagsState: ValidatedState<any> = new ValidatedState<any>();

    // holds a map of states by property names.
    propStates: Map<string, ValidatedState<any>> = new Map<string, ValidatedState<any>>();

    // todo-1: these should be in our local state really
    static morePanelExpanded: boolean = false;
    static propsPanelExpanded: boolean = false;

    pendingEncryptionChange: boolean = false;

    // if user uploads or deletes an upload we set this, to force refresh when dialog closes even if they don't click save.
    binaryDirty: boolean = false;

    /* Since some of our property editing (the Selection components) modify properties 'in-place' in the node we have
    this initialProps clone so we can 'rollback' properties if use clicks cancel */
    initialProps: J.PropertyInfo[];

    allowEditAllProps: boolean = false;

    constructor(node: J.NodeInfo, private encrypt: boolean, private showJumpButton: boolean, mode: DialogMode, public afterEditAction: Function) {
        super("[none]", mode === DialogMode.EMBED ? "app-embed-content" : "app-modal-content", false, mode);

        // we have this inst just so we can let the autoSaveTimer be static and always reference the latest one.
        EditNodeDlg.currentInst = this;

        if (mode === DialogMode.EMBED) {
            if (EditNodeDlg.embedInstance) {
                /* we get here if user starts editing another node and abandons the one currently being edited.
                 for now we just let this happen, but we could have asked the user if they MEANT to do that.
                 */
            }
            EditNodeDlg.embedInstance = this;
        }

        if (S.edit.pendingContent && node.id === S.edit.pendingContentId) {
            node.content = S.edit.pendingContent;
            S.edit.pendingContent = null;
            S.edit.pendingContentId = null;
        }

        this.mergeState<LS>({
            node,
            // selected props is used as a set of all 'selected' (via checkbox) property names
            selectedProps: new Set<string>()
        });

        this.allowEditAllProps = getAppState().isAdminUser;
        this.utl.initStates(this);
        this.initialProps = S.util.arrayClone(node.properties);

        /* This 'encrypt' will trigger this node to be encrypted whenever we're replying to
        an encrypted node. (i.e. the parent of this node is encrypted) */
        if (encrypt) {
            setTimeout(() => {
                this.utl.setEncryption(this, true);
            }, 500);
        }

        if (EditNodeDlg.pendingUploadFile) {
            setTimeout(async () => {
                await this.utl.upload(EditNodeDlg.pendingUploadFile, this);
                EditNodeDlg.pendingUploadFile = null;

                // Let's not save automatically, so user can enter text if they want.
                // this.save();
            }, 250);
        }

        // create one timer one time (singleton pattern)
        if (!EditNodeDlg.autoSaveTimer) {
            // save editor state every 3 seconds so user can recover editing if anything goes wrong.
            // This should be CLEARED upon successful saves only, and have this static var set back to null
            EditNodeDlg.autoSaveTimer = setInterval(async () => {
                const state = EditNodeDlg.currentInst.getState<LS>();
                await S.localDB.setVal(C.STORE_EDITOR_DATA, {
                    nodeId: state.node.id,
                    content: EditNodeDlg.currentInst.contentEditorState.getValue()
                });
            }, 3000);
        }
    }

    resetAutoSaver = async () => {
        if (EditNodeDlg.autoSaveTimer) {
            clearInterval(EditNodeDlg.autoSaveTimer);
            EditNodeDlg.autoSaveTimer = null;
        }
        await S.localDB.setVal(C.STORE_EDITOR_DATA, null);
    }

    createLayoutSelection = (): Selection => {
        const selection: Selection = new Selection(null, "Layout", [
            { key: "v", val: "1 col" },
            { key: "c2", val: "2 col" },
            { key: "c3", val: "3 col" },
            { key: "c4", val: "4 col" },
            { key: "c5", val: "5 col" },
            { key: "c6", val: "6 col" }
        ], null, "layoutSelection", new PropValueHolder(this.getState<LS>().node, J.NodeProp.LAYOUT, "v"));
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
        ], null, "col-3", new PropValueHolder(this.getState<LS>().node, J.NodeProp.PRIORITY, "0"));
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

        return new Selection(null, label, options, null, extraClasses, valueIntf);
    }

    getTitleIconComp(): CompIntf {
        const state = this.getState<LS>();
        let span: Span = null;

        const typeHandler = S.plugin.getTypeHandler(state.node.type);
        if (typeHandler) {
            const iconClass = typeHandler.getIconClass();
            if (iconClass) {
                span = span || new Span();
                span.addChild(new Icon({
                    title: `Node is a '${typeHandler.getName()}' type.`,
                    className: iconClass + " iconMarginRight clickable",
                    onClick: this.openChangeNodeTypeDlg
                }));
            }
            span.addChild(new Span(typeHandler.getName(), { className: "marginRight" }));
        }

        if (S.props.getPropStr(J.NodeProp.DATE, state.node)) {
            span = span || new Span();
            span.addChild(new Icon({
                title: "Node has a 'Date' property.",
                className: "fa fa-calendar fa-lg iconMarginRight"
            }));
        }

        if (this.showJumpButton) {
            span = span || new Span();
            span.addChild(new Icon({
                title: "Jump to Node",
                className: "fa fa-arrow-right fa-lg jumpButton",
                onClick: () => {
                    this.utl.cancelEdit(this);
                    S.nav.closeFullScreenViewer(getAppState());
                    S.view.jumpToId(state.node.id);
                }
            }));
        }
        return span;
    }

    getExtraTitleBarComps(): CompIntf[] {
        const state = this.getState<LS>();
        if (S.props.isEncrypted(state.node)) {
            return [
                new Icon({
                    className: "fa fa-lock fa-lg iconMarginLeft"
                })
            ];
        }
        return null;
    }

    renderDlg(): CompIntf[] {
        const state = this.getState<LS>();
        const hasAttachment: boolean = S.props.hasBinary(state.node);

        this.editorHelp = null;
        const typeHandler = S.plugin.getTypeHandler(state.node.type);
        let customProps: string[] = null;
        if (typeHandler) {
            customProps = typeHandler.getCustomProperties();
            typeHandler.ensureDefaultProperties(state.node);
            this.editorHelp = typeHandler.getEditorHelp();
        }

        const allowContentEdit: boolean = typeHandler ? typeHandler.getAllowContentEdit() : true;
        let propertyEditFieldContainer: Div = null;
        const children = [
            S.speech.speechActive ? new TextContent("Speech-to-Text active. Mic listening...", "alert alert-primary") : null,
            new Div(null, null, [
                new Div(null, {
                }, [
                    propertyEditFieldContainer = new Div("", {
                    })
                ])
            ])
        ];

        const flowPanel: Div = new Div(null, { className: "marginTop d-flex flex-row flex-wrap" });

        if (state.node.hasChildren) {
            flowPanel.addChild(this.createLayoutSelection());
            flowPanel.addChild(this.createImgSizeSelection("Images", true, "imagesSelection", //
                new PropValueHolder(this.getState<LS>().node, J.NodeProp.CHILDREN_IMG_SIZES, "n")));
        }

        flowPanel.addChildren(this.makeCheckboxesRow(state, customProps));

        // This is the table that contains the custom editable properties inside the collapsable panel at the bottom.
        let propsTable: Comp = null;
        let mainPropsTable: Comp = null;

        // if customProps exists then the props are all added into 'editPropsTable' instead of the collapsible panel
        if (!customProps) {
            propsTable = new Div(null, {
                className: "edit-props-table form-group-border marginBottom"
            });
            // This is the container that holds the custom properties if provided, or else the name+content textarea at the top of not
            mainPropsTable = new Div(null, {
                className: "marginBottom"
            });
        }
        else {
            // This is the container that holds the custom properties if provided, or else the name+content textarea at the top of not
            mainPropsTable = new Div(null, {
                className: "edit-props-table form-group-border marginBottom"
            });
        }

        const propsParent: CompIntf = customProps ? mainPropsTable : propsTable;
        const isWordWrap = !S.props.getPropStr(J.NodeProp.NOWRAP, state.node);

        let nodeNameTextField: TextField = null;
        if (!customProps) {
            nodeNameTextField = new TextField({ label: "Node Name", outterClass: "col-9", val: this.nameState });
        }

        if (allowContentEdit) {
            const hasContentProp = typeHandler && typeHandler.hasCustomProp("content");
            let rows = getAppState().mobileMode ? "8" : "10";
            if (customProps && hasContentProp) {
                rows = "4";
            }

            if (!customProps || hasContentProp) {
                const contentTableRow = this.makeContentEditor(state.node, isWordWrap, rows);
                mainPropsTable.addChild(contentTableRow);
                this.contentEditor.setWordWrap(isWordWrap);
            }
        }

        this.buildPropertiesEditing(propsParent, state, typeHandler, customProps);
        const binarySection = hasAttachment ? this.makeAttachmentPanel(state) : null;

        const shareComps: Comp[] = S.nodeUtil.getSharingNames(getAppState(), state.node, this);
        const isPublic = S.props.isPublic(state.node);

        // #unpublish-disabled
        // let unpublishedStr = S.props.getProp(J.NodeProp.UNPUBLISHED, state.node) ? "Unpublished" : "";

        let sharingDiv = null;
        let sharingDivClearFix = null;
        if (shareComps) {
            sharingDiv = new Div(null, {
                className: "float-end clickable marginBottom"
            }, [
                new Span("Shared to: ", { onClick: () => this.utl.share(this) }),
                ...shareComps,
                !isPublic ? new IconButton("fa-globe", "Add Public", { onClick: () => { this.makePublic(state, true); } }, "btn-secondary marginLeft") : null
                // #unpublish-disabled
                // unpublishedStr ? new Icon({
                //     className: "fa fa-eye-slash fa-lg marginLeft"
                // }) : null
            ]);
            sharingDivClearFix = new Clearfix();
        }

        // if this props table would be empty don't display it (set to null)
        if (propsTable && !propsTable.hasChildren()) {
            propsTable = null;
        }

        let propsCollapsablePanel: CollapsiblePanel = null;
        if (propsTable) {
            propsCollapsablePanel = new CollapsiblePanel("Properties", "Hide Properties", null, [
                propsTable
            ], false,
                (state: boolean) => {
                    EditNodeDlg.propsPanelExpanded = state;
                }, EditNodeDlg.propsPanelExpanded, "", "propsPanelExpanded", "propsPanelCollapsed float-end", "div");
        }

        const tagsEditRow: Div = new Div(null, { className: "marginBottom row align-items-end" }, [
            new TextField({ label: "Tags", outterClass: "col-10", val: this.tagsState }),
            this.createTagsIconButtons()
        ]);

        const collapsiblePanel = !customProps ? new CollapsiblePanel("Advanced", "Hide Advanced", null, [
            this.tagsState.getValue() ? null : tagsEditRow,
            new Div(null, { className: "row align-items-end" }, [
                nodeNameTextField,
                this.createPrioritySelection()
            ]),
            flowPanel
        ], false,
            (state: boolean) => {
                EditNodeDlg.morePanelExpanded = state;
            }, EditNodeDlg.morePanelExpanded, "marginRight", "", "", "div") : null;

        const morePanel = new Div(null, { className: "marginBottom" }, [
            collapsiblePanel
        ]);

        const propsPanel = new Div(null, null, [
            propsCollapsablePanel
        ]);

        // Allows user to drag-n-drop files onto editor to upload
        S.util.setDropHandler(this.attribs, true, (evt: DragEvent) => {
            const data = evt.dataTransfer.items;

            for (let i = 0; i < data.length; i++) {
                const d = data[i];
                // console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);
                if (d.kind === "file") {
                    const file: File = data[i].getAsFile();
                    const state = this.getState<LS>();
                    this.utl.upload(file, this);
                    return;
                }
            }
        });

        propertyEditFieldContainer.setChildren([mainPropsTable, sharingDiv, sharingDivClearFix, binarySection,
            this.tagsState.getValue() ? tagsEditRow : null,
            propsPanel, morePanel, new Clearfix(), this.renderButtons()]);
        return children;
    }

    makePublic = async (state: LS, allowAppends: boolean) => {
        const encrypted = S.props.isEncrypted(state.node);
        if (encrypted) {
            S.util.showMessage("This node is encrypted, and therefore cannot be made public.", "Warning");
            return;
        }

        await S.util.ajax<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: state.node.id,
            principal: "public",
            privileges: allowAppends ? [J.PrivilegeType.READ, J.PrivilegeType.WRITE] : [J.PrivilegeType.READ]
        });

        const res = await S.util.ajax<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: state.node.id,
            includeAcl: true,
            includeOwners: true
        });
        state.node.ac = res.aclEntries;

        this.mergeState<LS>({ node: state.node });
    }

    buildPropertiesEditing = (propsParent: CompIntf, state: LS, typeHandler: TypeHandlerIntf, customProps: string[]) => {
        let numPropsShowing: number = 0;
        if (state.node.properties) {
            // This loop creates all the editor input fields for all the properties
            state.node.properties.forEach((prop: J.PropertyInfo) => {
                // console.log("prop=" + S.util.prettyPrint(prop));

                if (!this.allowEditAllProps && !S.render.allowPropertyEdit(state.node, prop.name, getAppState())) {
                    // console.log("Hiding property: " + prop.name);
                    return;
                }

                if (this.allowEditAllProps || (
                    !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {

                    if (!this.isGuiControlBasedProp(prop)) {
                        const allowSelection = !customProps || !customProps.find(p => p === prop.name);
                        const tableRow = this.makePropEditor(typeHandler, prop, allowSelection, typeHandler ? typeHandler.getEditorRowsForProp(prop.name) : 1);
                        numPropsShowing++;
                        propsParent.addChild(tableRow);
                    }
                }
            });
        }

        const allowPropAdd: boolean = typeHandler ? typeHandler.getAllowPropertyAdd() : true;
        if (allowPropAdd) {
            if (numPropsShowing > 0) {
                const state = this.getState<LS>();
                const propsButtonBar: ButtonBar = new ButtonBar([
                    new IconButton("fa-plus-circle", null, {
                        onClick: async () => {
                            EditNodeDlg.propsPanelExpanded = true;
                            await this.utl.addProperty(this);
                        },
                        title: "Add property"
                    }),
                    state.selectedProps.size > 0 ? new IconButton("fa-trash", null, {
                        onClick: () => this.utl.deletePropertiesButtonClick(this),
                        title: "Delete property"
                    }) : null
                ], null, "float-end");

                // adds the button bar to the top of the list of children.
                propsParent.insertFirstChild(propsButtonBar);
            }
        }
    }

    createTagsIconButtons = (): Comp => {
        return new ButtonBar([
            new IconButton("fa-tag fa-lg", "", {
                onClick: async () => {
                    const dlg: SelectTagsDlg = new SelectTagsDlg("edit", this.tagsState.getValue());
                    await dlg.open();
                    this.addTagsToTextField(dlg);
                },
                title: "Select Hashtags"
            }, "btn-primary", "off")
        ], "col-2");
    }

    /* todo-1: put typesafety here on dlgState */
    addTagsToTextField = (dlg: any) => {
        let val = "";
        dlg.getState().selectedTags.forEach(tag => {
            if (val) val += " ";
            val += tag;
        });
        this.tagsState.setValue(val);
    }

    // Generate GUI for handling the display info about any Node Attachments
    makeAttachmentPanel = (state: LS) => {
        const ipfsLink = S.props.getPropStr(J.NodeProp.IPFS_LINK, state.node);
        const mime = S.props.getPropStr(J.NodeProp.BIN_MIME, state.node);

        let pinCheckbox: Checkbox = null;
        if (ipfsLink) {
            pinCheckbox = new Checkbox("Pin", { className: "ipfsPinnedCheckbox" }, {
                setValue: (checked: boolean) => {
                    if (checked) {
                        this.utl.deleteProperties(this, [J.NodeProp.IPFS_REF]);
                    }
                    else {
                        S.props.setPropVal(J.NodeProp.IPFS_REF, this.getState<LS>().node, "1");
                    }
                },
                getValue: (): boolean => S.props.getProp(J.NodeProp.IPFS_REF, state.node) ? false : true
            });
        }

        const imgSizeSelection = S.props.hasImage(state.node) ? this.createImgSizeSelection("Image Size", false, "float-end", //
            new PropValueHolder(this.getState<LS>().node, J.NodeProp.IMG_SIZE, "100%")) : null;

        const topBinRow = new HorizontalLayout([
            new NodeCompBinary(state.node, true, false, null),

            new HorizontalLayout([
                new Div(null, { className: "bigPaddingRight" }, [
                    new Div((ipfsLink ? "IPFS " : "") + "Attachment", {
                        className: "smallHeading"
                    }),
                    new Button("Remove", () => this.utl.deleteUpload(this), {
                        className: "marginRight",
                        title: "Remove this attachment"
                    })
                ]),
                imgSizeSelection,
                pinCheckbox
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

        return new Div(null, { className: "marginLeft binaryEditorSection editBinaryContainer" }, [
            topBinRow, bottomBinRow
        ]);
    }

    makeCheckboxesRow = (state: LS, customProps: string[]): Comp[] => {
        const encryptCheckBox: Checkbox = !customProps ? new Checkbox("Encrypt", null, {
            setValue: (checked: boolean) => this.utl.setEncryption(this, checked),
            getValue: (): boolean => S.props.isEncrypted(state.node)
        }) : null;

        const wordWrapCheckbox = new Checkbox("Word Wrap", null, {
            setValue: (checked: boolean) => {
                // this is counter-intuitive that we invert here because 'NOWRAP' is a negation of "wrap"
                S.props.setPropVal(J.NodeProp.NOWRAP, state.node, checked ? null : "1");
                if (this.contentEditor) {
                    this.contentEditor.setWordWrap(checked);
                }
            },
            getValue: (): boolean => S.props.getPropStr(J.NodeProp.NOWRAP, state.node) !== "1"
        });

        const inlineChildrenCheckbox = state.node.hasChildren ? new Checkbox("Inline Children", null,
            this.makeCheckboxPropValueHandler(J.NodeProp.INLINE_CHILDREN)) : null;

        return [inlineChildrenCheckbox, wordWrapCheckbox, encryptCheckBox];
    }

    makeCheckboxPropValueHandler(propName: string): I.ValueIntf {
        return {
            setValue: (checked: boolean) => S.props.setPropVal(propName, this.getState<LS>().node, checked ? "1" : null),
            getValue: (): boolean => S.props.getPropStr(propName, this.getState<LS>().node) === "1"
        };
    }

    save = () => {
        this.utl.saveNode(this);
        this.close();
        if (this.afterEditAction) {
            this.afterEditAction();
        }
    }

    renderButtons(): CompIntf {
        const state = this.getState<LS>();
        // let hasAttachment: boolean = S.props.hasBinary(state.node);

        const typeHandler = S.plugin.getTypeHandler(state.node.type);
        if (typeHandler) {
            typeHandler.ensureDefaultProperties(state.node);
        }

        // let allowContentEdit: boolean = typeHandler ? typeHandler.getAllowContentEdit() : true;
        // //regardless of value, if this property is present we consider the type locked
        // let typeLocked = !!S.props.getNodePropVal(J.NodeProp.TYPE_LOCK, state.node);

        const allowUpload: boolean = typeHandler ? (getAppState().isAdminUser || typeHandler.allowAction(NodeActionType.upload, state.node, getAppState())) : true;
        const allowShare: boolean = typeHandler ? (getAppState().isAdminUser || typeHandler.allowAction(NodeActionType.share, state.node, getAppState())) : true;

        // let typeLocked = !!S.props.getNodePropVal(J.NodeProp.TYPE_LOCK, state.node);
        const datePropExists = S.props.getProp(J.NodeProp.DATE, state.node);

        const numPropsShowing = this.utl.countPropsShowing(this);
        const advancedButtons: boolean = !!this.contentEditor;
        const allowPropAdd: boolean = typeHandler ? typeHandler.getAllowPropertyAdd() : true;

        return new ButtonBar([
            new Button("Save", this.save, { title: "Save this node and close editor." }, "attentionButton"),

            new Button("Cancel", () => this.utl.cancelEdit(this), null, "btn-secondary float-end"),

            allowUpload ? new IconButton("fa-upload", null, {
                onClick: () => this.utl.upload(null, this),
                title: "Upload file attachment"
            }) : null,

            allowShare ? new IconButton("fa-share-alt", null, {
                onClick: () => this.utl.share(this),
                title: "Share Node"
            }) : null,

            allowPropAdd && numPropsShowing === 0 ? new IconButton("fa-plus-circle", null, {
                onClick: async () => {
                    EditNodeDlg.propsPanelExpanded = true;
                    await this.utl.addProperty(this);
                },
                title: "Add Property"
            }) : null,

            // show delete button only if we're in a fullscreen viewer (like Calendar view)
            S.util.fullscreenViewerActive(getAppState())
                ? new Button("Delete", () => {
                    S.edit.deleteSelNodes(null, state.node.id);
                    this.close();
                }) : null,

            advancedButtons ? new IconButton((S.speech.speechActive ? "fa-microphone-slash" : "fa-microphone"), null, {
                title: "Toggle on/off Speech Recognition to input text",
                onClick: () => this.utl.speechRecognition(this)
            }) : null,

            advancedButtons ? new IconButton("fa-clock-o", null, {
                title: "Insert current time at cursor",
                onClick: () => this.utl.insertTime(this)
            }) : null,

            advancedButtons && !datePropExists ? new IconButton("fa-calendar", null, {
                title: "Add 'date' property to node (makes Calendar entry)",
                onClick: () => this.utl.addDateProperty(this)
            }) : null,

            advancedButtons ? new IconButton("fa-user", null, {
                title: "Insert username/mention at cursor",
                onClick: () => this.utl.insertMention(this)
            }) : null,

            advancedButtons ? new IconButton("fa-smile-o", null, {
                title: "Insert emoji at cursor",
                onClick: () => this.utl.insertEmoji(this)
            }) : null,

            this.editorHelp ? new HelpButton(() => this.editorHelp) : null
        ]);
    }

    super_closeByUser = this.closeByUser;
    closeByUser = () => {
        this.super_closeByUser();
        this.resetAutoSaver();
    }

    super_close = this.close;
    close = () => {
        this.super_close();
        if (this.mode === DialogMode.EMBED) {
            EditNodeDlg.embedInstance = null;
            dispatch("endEditing", s => {
                s.editNode = null;
                s.editNodeOnTab = null;
                s.editNodeReplyToId = null;
                S.quanta.newNodeTargetId = null;
                S.quanta.newNodeTargetOffset = -1;
                s.editShowJumpButton = false;
                s.editEncrypt = false;
                return s;
            });
        }
    }

    isGuiControlBasedProp = (prop: J.PropertyInfo): boolean => {
        return !!S.props.controlBasedPropertyList.has(prop.name);
    }

    toggleShowReadOnly = () => {
        // alert("not yet implemented.");
        // see saveNode for how to iterate all properties, although I wonder why I didn't just use a map/set of
        // properties elements
        // instead so I don't need to parse any DOM or domIds inorder to iterate over the list of them????
    }

    openChangeNodeTypeDlg = () => {
        new ChangeNodeTypeDlg(this.getState<LS>().node.type, (type: string) => this.utl.setNodeType(this, type)).open();
    }

    makePropEditor = (typeHandler: TypeHandlerIntf, propEntry: J.PropertyInfo, allowCheckbox: boolean, rows: number): Div => {
        const tableRow = new Div(null, { className: "marginBottomIfNotLast" });

        const allowEditAllProps: boolean = getAppState().isAdminUser;
        const isReadOnly = S.render.isReadOnlyProperty(propEntry.name);
        const editItems = [];
        const label = typeHandler ? typeHandler.getEditLabelForProp(propEntry.name) : propEntry.name;
        // console.log("making single prop editor: prop[" + propEntry.name + "] val[" + propEntry.value + "]");

        let propState: ValidatedState<any> = this.propStates.get(propEntry.name);
        if (!propState) {
            propState = new ValidatedState<any>(propEntry.value);
            this.propStates.set(propEntry.name, propState);
        }

        // WARNING: propState.setValue() calls will have been done in initStates, and should NOT be set here, because this can run during render callstacks
        // which is not a valid time to be updating states

        // todo-2: actually this is wrong to just do a Textarea when it's readonly. It might be a non-multiline item here
        // and be better with a Textfield based editor
        if (!allowEditAllProps && isReadOnly) {
            const textarea = new TextArea(label + " (read-only)", {
                placeholder: "Enter property value...",
                readOnly: "readOnly",
                disabled: "disabled"
            }, propState);

            editItems.push(textarea);
        }
        else {
            if (allowCheckbox) {
                const checkbox: Checkbox = new Checkbox(label, null, {
                    setValue: (checked: boolean) => {
                        const state = this.getState<LS>();
                        if (checked) {
                            state.selectedProps.add(propEntry.name);
                        }
                        else {
                            state.selectedProps.delete(propEntry.name);
                        }
                        this.mergeState<LS>({ selectedProps: state.selectedProps });
                    },
                    getValue: (): boolean => this.getState<LS>().selectedProps.has(propEntry.name)
                });
                editItems.push(checkbox);
            }
            else {
                editItems.push(new Label(label));
            }

            let valEditor: CompIntf = null;
            const multiLine = rows > 1;

            if (multiLine) {
                valEditor = new TextArea(null, {
                    rows: "" + rows,
                    id: "prop_" + this.getState<LS>().node.id
                }, propState, "textarea-min-4 displayCell");
            }
            else {
                /* todo-2: eventually we will have data types, but for now we use a hack
                to detect to treat a string as a date based on its property name. */
                if (propEntry.name === J.NodeProp.DATE) {
                    valEditor = new DateTimeField(propState);
                }
                else {
                    // console.log("Creating TextField for property: " + propEntry.name + " value=" + propValStr);
                    valEditor = new TextField({
                        placeholder: "Enter property value...",
                        inputClass: S.props.getInputClassForType(propEntry.name),
                        val: propState
                    });
                }
            }

            editItems.push(valEditor as any as Comp);
        }
        tableRow.setChildren(editItems);
        return tableRow;
    }

    makeContentEditor = (node: J.NodeInfo, isWordWrap: boolean, rows: string): Div => {
        const value = node.content || "";
        const editItems = [];
        const encrypted = value.startsWith(J.Constant.ENC_TAG);

        // if this is the first pass thru here (not a re-render) then allow focus() to get called
        const allowFocus = !this.contentEditor;
        // console.log("making field editor for val[" + value + "]");

        this.contentEditor = new TextArea(null, {
            id: C.ID_PREFIX_EDIT + this.getState<LS>().node.id,
            rows
        }, this.contentEditorState, "font-inherit displayCell", true);

        const wrap: boolean = S.props.getPropStr(J.NodeProp.NOWRAP, getAppState().node) !== "1";
        this.contentEditor.setWordWrap(wrap);

        this.contentEditor.onMount((elm: HTMLElement) => {
            if (encrypted) {
                // console.log("decrypting: " + value);
                const cipherText = value.substring(J.Constant.ENC_TAG.length);
                (async () => {
                    const cipherKey = S.props.getCryptoKey(node, getAppState());
                    if (cipherKey) {
                        const clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

                        if (!clearText) {
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

        editItems.push(this.contentEditor as any as Comp);
        return new Div(null, null, editItems);
    }
}

import { dispatch, getAppState } from "../AppContext";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { CollapsiblePanel } from "../comp/core/CollapsiblePanel";
import { DateTimeField } from "../comp/core/DateTimeField";
import { Div } from "../comp/core/Div";
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
import { DialogBase, DialogMode } from "../DialogBase";
import * as I from "../Interfaces";
import { ValueIntf } from "../Interfaces";
import { NodeActionType, TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import * as J from "../JavaIntf";
import { PropValueHolder } from "../PropValueHolder";
import { S } from "../Singletons";
import { Validator } from "../Validator";
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
    public utl: EditNodeDlgUtil = new EditNodeDlgUtil();
    static embedInstance: EditNodeDlg;
    editorHelp: string = null;
    public contentEditor: I.TextEditorIntf;
    contentEditorState: Validator = new Validator();
    nameState: Validator = new Validator();
    tagsState: Validator = new Validator();

    // holds a map of states by property names.
    // todo-1: it would be good if there were a way to have this state management using the ACTUAL 'appState.editNode'
    // as the holder of the property value so everything is always in sync easier.
    propStates: Map<string, Validator> = new Map<string, Validator>();

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
    contentScrollPos = new ScrollPos();

    constructor(private encrypt: boolean, private showJumpButton: boolean, mode: DialogMode, public afterEditAction: Function) {
        super("[none]", (mode === DialogMode.EMBED ? "app-embed-content" : "app-modal-content") + " " + C.TAB_MAIN, false, mode);
        const appState = getAppState();

        // need a deterministic id here, that can be found across renders, for scrolling.
        this.setId("EditNodeDlg_" + appState.editNode.id);

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

        this.mergeState<LS>({
            // selected props is used as a set of all 'selected' (via checkbox) property names
            selectedProps: new Set<string>()
        });

        this.allowEditAllProps = getAppState().isAdminUser;
        this.utl.initStates(this);
        this.initialProps = S.util.arrayClone(appState.editNode.properties);

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
                const appState = getAppState();
                if (!appState || !appState.editNode) return;
                await S.localDB.setVal(C.STORE_EDITOR_DATA, {
                    nodeId: appState.editNode.id,
                    content: EditNodeDlg.currentInst.contentEditorState.getValue()
                });
            }, 6000);
        }
    }

    resetAutoSaver = async () => {
        if (EditNodeDlg.autoSaveTimer) {
            clearInterval(EditNodeDlg.autoSaveTimer);
            EditNodeDlg.autoSaveTimer = null;
        }
        S.localDB.setVal(C.STORE_EDITOR_DATA, null);
    }

    createLayoutSelection = (): Selection => {
        const appState = getAppState();
        const selection: Selection = new Selection(null, "Subnode Layout", [
            { key: "v", val: "1 column" },
            { key: "c2", val: "2 columns" },
            { key: "c3", val: "3 columns" },
            { key: "c4", val: "4 columns" },
            { key: "c5", val: "5 columns" },
            { key: "c6", val: "6 columns" }
        ], null, "layoutSelection", new PropValueHolder(appState.editNode, J.NodeProp.LAYOUT, "v"));
        return selection;
    }

    createPrioritySelection = (): Selection => {
        const appState = getAppState();
        return new Selection(null, "Priority", [
            { key: "0", val: "none" },
            { key: "1", val: "Top" },
            { key: "2", val: "High" },
            { key: "3", val: "Medium" },
            { key: "4", val: "Low" },
            { key: "5", val: "Backlog" }
        ], null, "col-3", new PropValueHolder(appState.editNode, J.NodeProp.PRIORITY, "0"));
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
        const appState = getAppState();
        let span: Span = null;

        const typeHandler = S.plugin.getTypeHandler(appState.editNode.type);
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
            if (S.props.getPropStr(J.NodeProp.DATE, appState.editNode)) {
                span = span || new Span();
                span.addChild(new Icon({
                    title: "Node has a 'Date' property.",
                    className: "fa fa-calendar fa-lg iconMarginRight"
                }));
            }
            span.addChild(new Span(typeHandler.getName(), { className: "marginRight" }));
        }

        if (this.showJumpButton) {
            span = span || new Span();
            span.addChild(new Icon({
                title: "Jump to Node",
                className: "fa fa-arrow-right fa-lg jumpButton",
                onClick: () => {
                    this.utl.cancelEdit(this);
                    S.nav.closeFullScreenViewer(getAppState());
                    S.view.jumpToId(appState.editNode.id);
                }
            }));
        }
        return span;
    }

    getExtraTitleBarComps(): CompIntf[] {
        const appState = getAppState();
        if (S.props.isEncrypted(appState.editNode)) {
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
        const appState = getAppState();
        const hasAttachment: boolean = S.props.hasBinary(appState.editNode);

        this.editorHelp = null;
        const typeHandler = S.plugin.getTypeHandler(appState.editNode.type);
        let customProps: string[] = null;
        if (typeHandler) {
            customProps = typeHandler.getCustomProperties();
            typeHandler.ensureDefaultProperties(appState.editNode);
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

        if (appState.editNode.hasChildren) {
            flowPanel.addChild(this.createLayoutSelection());
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
        const isWordWrap = !S.props.getPropStr(J.NodeProp.NOWRAP, appState.editNode);

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
                mainPropsTable.addChild(this.makeContentEditor(appState.editNode, isWordWrap, rows));
                this.contentEditor.setWordWrap(isWordWrap);
            }
        }

        this.buildPropsEditing(propsParent, state, typeHandler, customProps);
        const binarySection = hasAttachment ? this.makeAllAttachmentsPanel(state) : null;
        const shareComps: Comp[] = S.nodeUtil.getSharingNames(appState, appState.editNode, this);
        const isPublic = S.props.isPublic(appState.editNode);

        let sharingDiv = null;
        let sharingDivClearFix = null;
        if (shareComps) {
            const unpublished = S.props.getPropStr(J.NodeProp.UNPUBLISHED, appState.editNode);
            sharingDiv = new Div(null, {
                className: "float-end clickable marginBottom"
            }, [
                new Span("Shared to: ", { onClick: () => this.utl.share(this) }),
                ...shareComps,
                !isPublic ? new Button("Make Public", () => { this.makePublic(state, true); }, { className: "marginLeft" }) : null,
                unpublished ? new Icon({
                    className: "fa fa-eye-slash fa-lg sharingIcon marginLeft",
                    title: "Node is Unpublished\n\nWill not appear in feed"
                }) : null
            ]);
            sharingDivClearFix = new Clearfix();
        }

        // if this props table would be empty don't display it (set to null)
        if (propsTable && !propsTable.hasChildren()) {
            propsTable = null;
        }

        let propsCollapsePanel: CollapsiblePanel = null;
        if (propsTable) {
            propsCollapsePanel = new CollapsiblePanel("Properties", "Hide Properties", null, [
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

        const collapsePanel = !customProps ? new CollapsiblePanel("Advanced", "Hide Advanced", null, [
            this.tagsState.getValue() ? null : tagsEditRow,
            new Div(null, { className: "row align-items-end" }, [
                nodeNameTextField,
                this.createPrioritySelection()
            ]),
            flowPanel
        ], false,
            (state: boolean) => {
                EditNodeDlg.morePanelExpanded = state;
            }, EditNodeDlg.morePanelExpanded, "marginRight btn-primary", "", "", "div") : null;

        const morePanel = new Div(null, { className: "marginBottom" }, [
            collapsePanel
        ]);

        const propsPanel = new Div(null, null, [
            propsCollapsePanel
        ]);

        // Allows user to drag-n-drop files onto editor to upload
        S.domUtil.setDropHandler(this.attribs, true, (evt: DragEvent) => {
            for (const item of evt.dataTransfer.items) {
                if (item.kind === "file") {
                    const file = item.getAsFile();
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
        const appState = getAppState();
        const encrypted = S.props.isEncrypted(appState.editNode);
        if (encrypted) {
            S.util.showMessage("This node is encrypted, and therefore cannot be made public.", "Warning");
            return;
        }

        await S.rpcUtil.rpc<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: appState.editNode.id,
            principals: ["public"],
            privileges: allowAppends ? [J.PrivilegeType.READ, J.PrivilegeType.WRITE] : [J.PrivilegeType.READ]
        });

        const res = await S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: appState.editNode.id
        });
        appState.editNode.ac = res.aclEntries;

        S.edit.updateNode(appState.editNode);
    }

    buildPropsEditing = (propsParent: CompIntf, state: LS, typeHandler: TypeHandlerIntf, customProps: string[]) => {
        let numPropsShowing: number = 0;
        const appState = getAppState();
        if (appState.editNode.properties) {
            // This loop creates all the editor input fields for all the properties
            appState.editNode.properties.forEach((prop: J.PropertyInfo) => {
                // console.log("prop=" + S.util.prettyPrint(prop));

                if (!this.allowEditAllProps && !S.render.allowPropertyEdit(appState.editNode, prop.name, getAppState())) {
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
    addTagsToTextField = (dlg: SelectTagsDlg) => {
        let val = "";
        dlg.getState().selectedTags.forEach((tag: string) => {
            if (val) val += " ";
            val += tag;
        });
        this.tagsState.setValue(val);
    }

    makeAllAttachmentsPanel = (state: LS): Div => {
        const appState = getAppState();
        const node: J.NodeInfo = appState.editNode;
        if (!node.attachments) return null;
        const children: CompIntf[] = [];
        S.props.getOrderedAttachments(node).forEach((att: any) => {
            // having 'att.key' is a client-side only hack, and only generated during the ordering.
            children.push(this.makeAttachmentPanel(state, att));
        });
        // Object.keys(node.attachments).forEach(key => {
        //     children.push(this.makeAttachmentPanel(state, key, node.attachments[key]));
        // });
        return new Div(null, { className: "binaryEditorSection" }, children);
    }

    // Generate GUI for handling the display info about any Node Attachments
    makeAttachmentPanel = (state: LS, att: J.Attachment): Div => {
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
            ? this.createImgSizeSelection("Image Size", false, "float-end", //
                {
                    setValue(val: string): void {
                        const att: J.Attachment = S.props.getAttachment(key, appState.editNode);
                        if (att) {
                            att.c = val;
                            this.binaryDirty = true;
                        }
                    },

                    getValue(): string {
                        const att: J.Attachment = S.props.getAttachment(key, appState.editNode);
                        return att && att.c;
                    }
                }) : null;

        const topBinRow = new HorizontalLayout([
            new NodeCompBinary(appState.editNode, key, true, false),

            new HorizontalLayout([
                // todo-0: WIP (implement)
                // new Div(null, null, [
                //     new Icon({
                //         className: "fa fa-lg fa-arrow-up",
                //         title: "Move Attachment Up",
                //         onClick: () => { this.moveAttachmentUp(att, appState.editNode); }
                //     }),
                //     new Icon({
                //         className: "fa fa-lg fa-arrow-down",
                //         title: "Move Attachment Down",
                //         onClick: () => { this.moveAttachmentDown(att, appState.editNode); }
                //     })
                // ]),
                new Div(null, { className: "bigPaddingRight" }, [
                    ipfsLink ? new Div("IPFS", {
                        className: "smallHeading"
                    }) : null,
                    new Button("Remove", () => this.utl.deleteUpload(this, key), {
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

        return new Div(null, { className: "binaryEditorItem" }, [
            topBinRow, bottomBinRow
        ]);
    }

    // todo-0: WIP (implement)
    // moveAttachmentUp = (att: J.Attachment, node: J.NodeInfo) => {
    // }

    // moveAttachmentDown = (att: J.Attachment, node: J.NodeInfo) => {
    // }

    makeCheckboxesRow = (state: LS, customProps: string[]): Comp[] => {
        const appState = getAppState();
        const encryptCheckBox = !customProps ? new Checkbox("Encrypt", null, {
            setValue: (checked: boolean) => this.utl.setEncryption(this, checked),
            getValue: (): boolean => S.props.isEncrypted(appState.editNode)
        }) : null;

        const wordWrapCheckbox = new Checkbox("Word Wrap", null, {
            setValue: (checked: boolean) => {
                // this is counter-intuitive that we invert here because 'NOWRAP' is a negation of "wrap"
                S.props.setPropVal(J.NodeProp.NOWRAP, appState.editNode, checked ? null : "1");
                if (this.contentEditor) {
                    this.contentEditor.setWordWrap(checked);
                }
            },
            getValue: (): boolean => S.props.getPropStr(J.NodeProp.NOWRAP, appState.editNode) !== "1"
        });

        const inlineChildrenCheckbox = appState.editNode.hasChildren ? new Checkbox("Inline Subnodes", null,
            this.makeCheckboxPropValueHandler(J.NodeProp.INLINE_CHILDREN)) : null;

        return [inlineChildrenCheckbox, wordWrapCheckbox, encryptCheckBox];
    }

    makeCheckboxPropValueHandler(propName: string): I.ValueIntf {
        const appState = getAppState();
        return {
            setValue: (checked: boolean) => S.props.setPropVal(propName, appState.editNode, checked ? "1" : null),
            getValue: (): boolean => S.props.getPropStr(propName, appState.editNode) === "1"
        };
    }

    save = () => {
        // it's important to call saveNode before close, because close destroys some of our state, what we need
        // to complete the updating and page refresh.
        this.utl.saveNode(this);
        this.close();
        if (this.afterEditAction) {
            this.afterEditAction();
        }
    }

    renderButtons(): CompIntf {
        const appState = getAppState();
        // let hasAttachment: boolean = S.props.hasBinary(state.node);

        const typeHandler = S.plugin.getTypeHandler(appState.editNode.type);
        if (typeHandler) {
            typeHandler.ensureDefaultProperties(appState.editNode);
        }

        // let allowContentEdit: boolean = typeHandler ? typeHandler.getAllowContentEdit() : true;
        // //regardless of value, if this property is present we consider the type locked
        // let typeLocked = !!S.props.getNodePropVal(J.NodeProp.TYPE_LOCK, state.node);

        const allowUpload: boolean = typeHandler ? (getAppState().isAdminUser || typeHandler.allowAction(NodeActionType.upload, appState.editNode, getAppState())) : true;
        const allowShare: boolean = typeHandler ? (getAppState().isAdminUser || typeHandler.allowAction(NodeActionType.share, appState.editNode, getAppState())) : true;

        // let typeLocked = !!S.props.getNodePropVal(J.NodeProp.TYPE_LOCK, state.node);
        const datePropExists = S.props.getProp(J.NodeProp.DATE, appState.editNode);

        const numPropsShowing = this.utl.countPropsShowing(this);
        const advancedButtons: boolean = !!this.contentEditor;
        const allowPropAdd: boolean = typeHandler ? typeHandler.getAllowPropertyAdd() : true;

        return new ButtonBar([
            new Button("Save", this.save, { title: "Save this node and close editor." }, "attentionButton"),
            new Button("Cancel", () => this.utl.cancelEdit(this), null, "btn-secondary float-end"),

            allowUpload ? new IconButton("fa-paperclip", "Attach", {
                onClick: () => this.utl.upload(null, this),
                title: "Upload file attachment"
            }) : null,

            allowShare ? new IconButton("fa-share-alt", "Share", {
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
                    S.edit.deleteSelNodes(null, appState.editNode.id);
                    this.close();
                }) : null,

            advancedButtons && !datePropExists ? new IconButton("fa-calendar", null, {
                title: "Add 'date' property to node\n\nMakes node a Calendar Entry)",
                onClick: () => this.utl.addDateProperty(this)
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
        const appState = getAppState();
        new ChangeNodeTypeDlg(appState.editNode.type, (type: string) => this.utl.setNodeType(this, type)).open();
    }

    makePropEditor = (typeHandler: TypeHandlerIntf, propEntry: J.PropertyInfo, allowCheckbox: boolean, rows: number): Div => {
        const appState = getAppState();
        const tableRow = new Div(null, { className: "marginBottomIfNotLast" });

        const allowEditAllProps: boolean = getAppState().isAdminUser;
        const isReadOnly = S.render.isReadOnlyProperty(propEntry.name);
        const editItems = [];
        const label = typeHandler ? typeHandler.getEditLabelForProp(propEntry.name) : propEntry.name;
        // console.log("making single prop editor: prop[" + propEntry.name + "] val[" + propEntry.value + "]");

        let propState: Validator = this.propStates.get(propEntry.name);
        if (!propState) {
            propState = new Validator(propEntry.value);
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
                const checkbox = new Checkbox(label, null, {
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
                editItems.push(new Label(label, { className: "marginTop" }));
            }

            let valEditor: CompIntf = null;
            const multiLine = rows > 1;

            if (multiLine) {
                valEditor = new TextArea(null, {
                    rows: "" + rows,
                    id: "prop_" + appState.editNode.id
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
        const appState = getAppState();
        const value = node.content || "";
        const editItems: Comp[] = [];
        const encrypted = value.startsWith(J.Constant.ENC_TAG);

        // if this is the first pass thru here (not a re-render) then allow focus() to get called
        const allowFocus = !this.contentEditor;
        // console.log("making field editor for val[" + value + "]");

        this.contentEditor = new TextArea(null, {
            id: C.ID_PREFIX_EDIT + appState.editNode.id,
            rows
        }, this.contentEditorState, "font-inherit displayCell", true, this.contentScrollPos);

        const wrap: boolean = S.props.getPropStr(J.NodeProp.NOWRAP, getAppState().node) !== "1";
        this.contentEditor.setWordWrap(wrap);

        if (S.crypto.avail) {
            this.contentEditor.onMount((elm: HTMLElement) => {
                if (encrypted) {
                    // console.log("decrypting: " + value);
                    const cipherText = value.substring(J.Constant.ENC_TAG.length);
                    (async () => {
                        const cipherKey = S.props.getCryptoKey(node, getAppState());
                        if (cipherKey) {
                            const clearText: string = await S.crypto.decryptSharableString(null, { cipherKey, cipherText });

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
        }

        if (allowFocus) {
            this.contentEditor.focus();
        }

        editItems.push(new ButtonBar([
            new Icon({
                className: (S.speech.speechActive ? "fa fa-lg fa-microphone-slash editorIcon" : "fa fa-microphone editorIcon"),
                title: "Toggle on/off Speech Recognition to input text",
                onClick: () => this.utl.speechRecognition(this)
            }),

            new Icon({
                className: "fa fa-lg fa-clock-o editorIcon",
                title: "Insert current time at cursor",
                onClick: () => this.utl.insertTime(this)
            }),

            new Icon({
                className: "fa fa-lg fa-smile-o editorIcon",
                title: "Insert emoji at cursor",
                onClick: () => this.utl.insertEmoji(this)
            })
        ], "float-end microMarginBottom"));
        editItems.push(this.contentEditor as any as Comp);

        return new Div(null, null, editItems);
    }

    addSharingToContentText = () => {
        const appState = getAppState();
        if (appState.editNode.ac?.length > 0) {
            let content: string = this.contentEditorState.getValue();
            let newLine = false;
            let accum = 0;
            for (const ac of appState.editNode.ac) {
                if (ac.principalName !== J.PrincipalName.PUBLIC) {
                    const insertName = "@" + ac.principalName;
                    if (content.indexOf(insertName) === -1) {
                        if (!newLine) {
                            content += "\n";
                            newLine = true;
                        }
                        content += insertName + " ";

                        // new line afer every 7 names.
                        if (++accum >= 7) {
                            content += "\n";
                            accum = 0;
                        }
                    }
                }
            }
            this.contentEditorState.setValue(content.trim());
        }
    }
}

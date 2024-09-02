import { dispatch, getAs } from "../AppContext";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Clearfix } from "../comp/core/Clearfix";
import { CollapsiblePanel } from "../comp/core/CollapsiblePanel";
import { DateTimeField } from "../comp/core/DateTimeField";
import { Div } from "../comp/core/Div";
import { EditAttachmentsPanel } from "../comp/core/EditAttachmentsPanel";
import { Icon } from "../comp/core/Icon";
import { IconButton } from "../comp/core/IconButton";
import { Label } from "../comp/core/Label";
import { Selection } from "../comp/core/Selection";
import { Span } from "../comp/core/Span";
import { TextArea } from "../comp/core/TextArea";
import { TextContent } from "../comp/core/TextContent";
import { TextField } from "../comp/core/TextField";
import { Constants as C } from "../Constants";
import { DialogBase, DialogMode } from "../DialogBase";
import * as I from "../Interfaces";
import { EditorOptions } from "../Interfaces";
import { NodeActionType, TypeIntf } from "../intf/TypeIntf";
import * as J from "../JavaIntf";
import { PrincipalName, PropertyInfo } from "../JavaIntf";
import { PropValueHolder } from "../PropValueHolder";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { EditNodeDlgUtil } from "./EditNodeDlgUtil";
import { PickNodeTypeDlg } from "./PickNodeTypeDlg";
import { SelectTagsDlg, LS as SelectTagsDlgLS } from "./SelectTagsDlg";

export interface LS {
    selectedProps?: Set<string>;
    selectedAttachments?: Set<string>;
    speechActive?: boolean;
    signCheckboxVal?: boolean;
    encryptCheckboxVal?: boolean;
    rerenderAfterClose?: boolean
}

/**
 * Node Editor Dialog
 */
export class EditNodeDlg extends DialogBase {
    static autoSaveTimer: any = null;
    static pendingUploadFile: File = null;
    static dlg: EditNodeDlg = null;
    public utl: EditNodeDlgUtil = null;
    public contentEditor: I.TextEditorIntf;
    contentEditorState: Validator = new Validator();
    decryptFailed: boolean = false;
    nameState: Validator = new Validator();
    tagsState: Validator = new Validator();
    newTagState: Validator = new Validator();

    // holds a map of states by property names.
    propStates: Map<string, Validator> = new Map<string, Validator>();

    // Holds all the filenames for attachments
    attFileNames: Map<string, Validator> = new Map<string, Validator>();

    pendingEncryptionChange: boolean = false;

    // if user uploads or deletes an upload we set this, to force refresh when dialog closes even if
    // they don't click save.
    binaryDirty: boolean = false;

    /* Since some of our property editing (the Selection components) modify properties 'in-place' in
    the node we have this initialProps clone so we can 'rollback' properties if use clicks cancel */
    initialProps: PropertyInfo[];

    allowEditAllProps: boolean = false;
    contentScrollPos = new ScrollPos();
    tagTextField: TextField;

    constructor(encrypt: boolean, private showJumpButton: boolean, mode: DialogMode) {
        super("[none]", "appModalCont " + C.TAB_MAIN, null, mode);
        const ast = getAs();
        EditNodeDlg.dlg = this;
        this.utl = new EditNodeDlgUtil(this);

        let signCheckboxVal = false;
        let encryptCheckboxVal = false;
        if (S.crypto.avail) {
            // set checkbox to always on if this is admin user, otherwise set based on if it's
            // already signed or not
            signCheckboxVal = ast.isAdminUser ? true : !!S.props.getPropStr(J.NodeProp.CRYPTO_SIG, ast.editNode);
            encryptCheckboxVal = S.props.isEncrypted(ast.editNode);
        }

        this.mergeState<LS>({
            // selected props is used as a set of all 'selected' (via checkbox) property names
            selectedProps: new Set<string>(),
            selectedAttachments: new Set<string>(),
            signCheckboxVal,
            encryptCheckboxVal
        });

        this.allowEditAllProps = ast.isAdminUser;
        this.utl.initStates();
        this.initialProps = S.util.arrayClone(ast.editNode.properties);

        /* This 'encrypt' will trigger this node to be encrypted whenever we're replying to
        an encrypted node. (i.e. the parent of this node is encrypted) */
        if (encrypt) {
            setTimeout(() => {
                this.utl.setEncryption(true);
            }, 500);
        }

        if (EditNodeDlg.pendingUploadFile) {
            setTimeout(() => {
                // DO NOT DELETE. Leave this here as an FYI.
                // await this.utl.upload(EditNodeDlg.pendingUploadFile, this);
                this.immediateUploadFiles([EditNodeDlg.pendingUploadFile]);
                EditNodeDlg.pendingUploadFile = null;
            }, 250);
        }

        // create one timer one time (singleton pattern)
        if (!EditNodeDlg.autoSaveTimer) {
            // save editor state every few seconds so user can recover editing if anything goes
            // wrong. This should be CLEARED upon successful saves only, and have this static var
            // set back to null
            EditNodeDlg.autoSaveTimer = setInterval(() => {
                const ast = getAs();
                if (!ast || !ast.editNode) return;
                S.localDB.setVal(C.STORE_EDITOR_DATA, {
                    nodeId: ast.editNode.id,
                    content: EditNodeDlg.dlg.contentEditorState.getValue()
                });
            }, 5000);
        }

        // if we're editing a DATE property expand properties panel automatically
        if (S.props.getProp(J.NodeProp.DATE, ast.editNode)) {
            dispatch("setPropsPanelExpanded", s => s.propsPanelExpanded = true, true);
        }
    }

    async immediateUploadFiles(files: File[]) {
        const ast = getAs();
        await S.domUtil.uploadFilesToNode(files, ast.editNode.id, false);
        await S.edit.refreshFromServer(ast.editNode);
        S.edit.updateNode(ast.editNode);
        this.binaryDirty = true;
    }

    async resetAutoSaver() {
        if (EditNodeDlg.autoSaveTimer) {
            clearInterval(EditNodeDlg.autoSaveTimer);
            EditNodeDlg.autoSaveTimer = null;
        }
        S.localDB.setVal(C.STORE_EDITOR_DATA, null);
    }

    createLayoutSelection(): Selection {
        const ast = getAs();
        const selection: Selection = new Selection(null, "Layout", [
            { key: "v", val: "1 col" },
            { key: "c2", val: "2 cols" },
            { key: "c3", val: "3 cols" },
            { key: "c4", val: "4 cols" },
            { key: "c5", val: "5 cols" },
            { key: "c6", val: "6 cols" }
        ], null, "layoutSelection", new PropValueHolder(ast.editNode, J.NodeProp.LAYOUT, "v"));
        return selection;
    }

    createPrioritySelection(): Selection {
        const ast = getAs();
        return new Selection(null, "Priority", [
            { key: "0", val: "none" },
            { key: "1", val: "Top (P1)" },
            { key: "2", val: "High (P2)" },
            { key: "3", val: "Medium (P3)" },
            { key: "4", val: "Low (P4)" },
            { key: "5", val: "Backlog (P5)" }
        ], null, "col-3", new PropValueHolder(ast.editNode, J.NodeProp.PRIORITY, "0"));
    }

    override getTitleIconComp(): Comp {
        const ast = getAs();
        let span: Span = null;

        const type = S.plugin.getType(ast.editNode.type);
        if (type) {
            const iconClass = type.getIconClass();
            if (iconClass) {
                span = span || new Span();
                span.addChild(new Icon({
                    title: `Node Type: ${type.getName()}`,
                    className: iconClass + " dlgIcon clickable",
                    onClick: this._openChangeNodeTypeDlg
                }));
            }

            if (S.props.getPropStr(J.NodeProp.DATE, ast.editNode)) {
                span = span || new Span();
                span.addChild(new Icon({
                    title: "Node has a 'Date' property.",
                    className: "fa fa-calendar fa-lg dlgIcon"
                }));
            }
            span.addChild(new Span(type.getName(), {
                className: "marginRight clickable",
                onClick: this._openChangeNodeTypeDlg
            }));
        }
        else {
            span = span || new Span();
            span.addChild(new Icon({
                title: "Node Type: Unknown",
                className: "fa fa-question-circle fa-lg dlgIcon clickable",
                onClick: this._openChangeNodeTypeDlg
            }));
            span.addChild(new Span("Unknown Type", { className: "marginRight" }));
        }

        if (this.showJumpButton) {
            span = span || new Span();
            span.addChild(new Icon({
                title: "Jump to Node",
                className: "fa fa-arrow-right fa-lg jumpButton",
                onClick: () => {
                    this.utl.cancelEdit();
                    S.nav.closeFullScreenViewer();
                    S.view.jumpToId(ast.editNode.id);
                }
            }));
        }
        return span;
    }

    override getExtraTitleBarComps(): Comp[] {
        let comps: Comp[] = null;

        if (this.getState<LS>().signCheckboxVal) {
            comps = comps || [];

            const sigIcon: Icon = S.render.getSignatureIcon(getAs().editNode);
            if (sigIcon) {
                comps.push(sigIcon);
            }

            if (getAs().isAdminUser) {
                comps.push(new Span("<-Admin"));
            }
        }

        if (this.getState<LS>().encryptCheckboxVal) {
            comps = comps || [];
            comps.push(new Icon({
                title: "Node is Encrypted",
                className: "fa fa-lock fa-lg bigLockIcon iconMarginLeft"
            }));
        }
        return comps;
    }

    renderDlg(): Comp[] {
        const state = this.getState<LS>();
        const ast = getAs();
        const hasAttachment: boolean = S.props.hasBinary(ast.editNode);

        const type = S.plugin.getType(ast.editNode.type);
        let customProps: string[] = null;
        let editorOpts: EditorOptions = {};
        let autoExpandProps = false;
        if (type) {
            editorOpts = type.getEditorOptions();
            customProps = type.getCustomProperties();
            type.ensureDefaultProperties(ast.editNode);
            autoExpandProps = type.getAutoExpandProps(ast.editNode);
        }

        const allowContentEdit: boolean = type ? type.getAllowContentEdit() : true;
        let propEditFieldContainer: Div = null;

        const children = [
            S.speech.speechActive ? new TextContent("Speech-to-Text active. Mic listening...", "alert alert-primary") : null,
            new Div(null, null, [
                new Div(null, {
                }, [
                    propEditFieldContainer = new Div("", {
                    })
                ])
            ])
        ];

        const advFlowPanel: Div = new Div(null, { className: "marginTop d-flex flex-row flex-wrap" });

        if (ast.editNode.hasChildren) {
            advFlowPanel.addChild(this.createLayoutSelection());
        }

        advFlowPanel.addChildren(this.makeCheckboxesRow(editorOpts));

        // This is the table that contains the custom editable properties inside the collapsable panel at the bottom.
        let propsTable: Comp = null;
        let mainPropsTable: Comp = null;

        const flexPropsEditPanel = !customProps;
        let propsParent: Div = null;
        if (!customProps) {
            propsParent = new Div(null, {
                className: "editPropsTable" + (flexPropsEditPanel ? " flexPropsEditPanel" : "")
            });

            propsTable = propsParent;
            // This is the container that holds the custom properties if provided, or else the
            // name+content textarea at the top of not
            mainPropsTable = new Div(null, {
                className: "marginBottom"
            });
        }
        else {
            propsParent = new Div(null, {
                className: "editPropsTable marginBottom" + (flexPropsEditPanel ? " flexPropsEditPanel" : "")
            });
            mainPropsTable = propsParent;
        }

        const isWordWrap = !S.props.getPropStr(J.NodeProp.NOWRAP, ast.editNode);

        let nodeNameTextField: TextField = null;
        if (editorOpts.nodeName) {
            nodeNameTextField = new TextField({
                label: "Node Name",
                outterClass: "col-9",
                val: this.nameState,
                labelClass: "none"
            });
        }

        let propsVisible: boolean = false;
        if (allowContentEdit /* && !type.schemaOrg (I like having content even on schemaOrg types */) {
            let rows = "1";

            // only take some number of default rows greater than 1 if this is a non-schemaOrg type
            if (!type?.schemaOrg) {
                rows = getAs().mobileMode ? "8" : "10";
            }

            mainPropsTable.addChild(this.makeContentEditor(rows, type?.schemaOrg ? 1 : 3));
            this.contentEditor.setWordWrap(isWordWrap);
            propsVisible = true;
        }

        const tagsEditRow = editorOpts.tags ? new Div(null, { className: "editorTagsSection float-end" }, [
            this.tagsState.getValue() ? S.render.renderTagsStrDiv(this.tagsState.getValue(), null, this._removeTag, this._selectTags) : null,
            this.utl.renderLinksEditing()
        ]) : null;

        if (tagsEditRow && tagsEditRow.hasChildren()) {
            mainPropsTable.addChild(tagsEditRow);
            mainPropsTable.addChild(new Clearfix());
        }

        let propsHeaderBar: Div = null;
        if (this.buildPropsEditPanel({ propsParent, state, type, customProps, flexPropsEditPanel })) {
            propsVisible = true;

            if (type.getAllowPropertyAdd()) {
                const state = this.getState<LS>();
                propsHeaderBar = new Div(null, { className: "editTypesPanelHeader" }, [
                    type?.schemaOrg?.comment ? new Span(type?.schemaOrg?.comment) : null,
                    new Div(null, { className: "float-end" }, [
                        // ADD PROP ICON
                        new Icon({
                            className: "fa fa-plus-circle fa-lg clickable marginRight tinyMarginBottom",
                            onClick: async () => {
                                dispatch("setPropsPanelExpanded", s => {
                                    s.propsPanelExpanded = true;
                                });
                                await this.utl.addProperty();
                            },
                            title: "Add property"
                        }),
                        // DELETE PROP ICON
                        state.selectedProps.size > 0 ? new Icon({
                            className: "fa fa-trash fa-lg clickable marginRight tinyMarginBottom",
                            onClick: () => this.utl.deletePropsGesture(),
                            title: "Delete property"
                        }) : null
                    ])
                ]);
            }
        }

        if (!propsVisible || !mainPropsTable.hasChildren()) {
            mainPropsTable = null;
        }

        const binarySection = hasAttachment || ast.cutAttachments ? new EditAttachmentsPanel(ast.editNode, this) : null;
        const shareComps: Comp[] = S.nodeUtil.getSharingNames(ast.editNode, this);
        const isPublic = S.props.isPublic(ast.editNode);

        let sharingDiv = null;
        let sharingDivClearFix = null;
        if (shareComps) {
            const unpublished = S.props.getPropStr(J.NodeProp.UNPUBLISHED, ast.editNode);
            sharingDiv = new Div(null, {
                className: "float-end clickable marginBottom"
            }, [
                new Span("Shared to: ", {
                    title: "Node Sharing",
                    onClick: () => {
                        this.utl.share();
                    }
                }),
                ...shareComps,
                !isPublic ? new Button("Make Public", () => this.makePublic(true), { className: "marginLeft" }) : null,
                unpublished ? new Icon({
                    className: "fa fa-eye-slash fa-lg sharingIcon marginLeft microMarginRight",
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
        let propsPanel: Div = null;
        const propsDiv = new Div(null, { className: "editPropsCont" }, [
            propsHeaderBar,
            propsTable
        ]);

        if (propsTable) {
            // only if not schema.org type do we want to have properties collapsible
            if (!type.schemaOrg) {
                propsCollapsePanel = new CollapsiblePanel("Show Properties", "Hide Properties", null, [
                    new Clearfix(),
                    propsDiv
                ], true,
                    (expanded: boolean) => {
                        if (autoExpandProps) return;
                        dispatch("setPropsPanelExpanded", s => {
                            s.propsPanelExpanded = expanded;
                        });
                    }, getAs().propsPanelExpanded || autoExpandProps, "", "propsPanelExpanded", "propsPanelCollapsed float-end", "div");
            }
            // if schema.org type show properties in visible panel always
            else {
                propsPanel = propsDiv;
            }
        }

        let editorSubPanel: Comp = null;
        if (type) {
            editorSubPanel = type.renderEditorSubPanel(ast.editNode);
        }

        let advCollapsePanel = null;
        let advCollapsePanelContainer = null;
        const hasAdvControls = advFlowPanel?.hasChildren() || //
            editorOpts.nodeName || editorOpts.priority;

        if (hasAdvControls) {
            const advancedDiv = new Div(null, { className: "advancedCont" }, [
                new Div(null, { className: "row align-items-end" }, [
                    editorOpts.nodeName ? nodeNameTextField : null,
                    editorOpts.priority ? this.createPrioritySelection() : null
                ]),
                advFlowPanel
            ]);

            advCollapsePanel = !customProps ? new CollapsiblePanel("Show Advanced", "Hide Advanced", null, [
                advancedDiv
            ], true,
                (expanded: boolean) => {
                    dispatch("setMorePanelExpanded", s => {
                        s.morePanelExpanded = expanded;
                    });
                }, getAs().morePanelExpanded, "marginRight btn-primary", "", "", "div") : null;

            advCollapsePanelContainer = new Div(null, { className: "marginBottom" }, [
                advCollapsePanel
            ]);
        }

        // Note: for schema.org types we will have already created propsPanel and have no propsCollapsePanel.
        if (!propsPanel) {
            propsPanel = new Div(null, null, [
                propsCollapsePanel
            ]);
        }

        this.attribs[C.NODE_ID_ATTR] = ast.editNode.id;
        // Allows user to drag-n-drop files onto editor to upload
        S.domUtil.setDropHandler(this.attribs, async (evt: DragEvent) => {
            const files: File[] = [...evt.dataTransfer.files];
            let hasEmail = false;
            files.forEach((file: File) => {
                const name = file.name;
                const lcName = name.toLowerCase();
                if (lcName.endsWith(".eml")) {
                    hasEmail = true;
                }
            });

            if (hasEmail) {
                const ret: J.UploadResponse = await S.domUtil.parseFiles(files);
                let val = this.contentEditorState.getValue();
                ret.payloads?.forEach((payload: any) => {
                    val += "\n" + payload;
                });
                this.contentEditorState.setValue(val);
            }
            else {
                this.immediateUploadFiles(files);
            }
        });

        // -------------------------
        // DO NOT DELETE:
        // This kind of code pattern *might* be needed at some point again.
        // S.domUtil.setDropHandler(this.attribs, (evt: DragEvent) => {
        //     for (const item of evt.dataTransfer.items) {
        //         if (item.kind === "file") {
        //             const file = item.getAsFile();
        //             this.utl.upload(file, this);
        //             return;
        //         }
        //     }
        // });
        // -------------------------

        propEditFieldContainer.children = [editorSubPanel, mainPropsTable, sharingDiv, sharingDivClearFix, binarySection,
            propsPanel, advCollapsePanelContainer, new Clearfix(), this.renderButtons()];

        return children;
    }

    async makePublic(allowAppends: boolean) {
        const ast = getAs();
        if (this.getState<LS>().encryptCheckboxVal) {
            S.util.showMessage("This node is encrypted, and therefore cannot be made public.", "Warning");
            return;
        }

        await S.rpcUtil.rpc<J.AddPrivilegeRequest, J.AddPrivilegeResponse>("addPrivilege", {
            nodeId: ast.editNode.id,
            principals: [PrincipalName.PUBLIC],
            privileges: allowAppends ? [J.PrivilegeType.READ, J.PrivilegeType.WRITE] : [J.PrivilegeType.READ]
        });

        const res = await S.rpcUtil.rpc<J.GetNodePrivilegesRequest, J.GetNodePrivilegesResponse>("getNodePrivileges", {
            nodeId: ast.editNode.id
        });
        ast.editNode.ac = res.aclEntries;
        S.edit.updateNode(ast.editNode);
    }

    /* returns true if props table is not empty. */
    buildPropsEditPanel(_: { propsParent: Comp, state: LS, type: TypeIntf, customProps: string[], flexPropsEditPanel: boolean }): boolean {
        let ret = false;
        const ast = getAs();

        if (ast.editNode.properties) {
            const durationProp = S.props.getProp(J.NodeProp.DURATION, ast.editNode);

            // This loop creates all the editor input fields for all the properties
            ast.editNode.properties.forEach(prop => {
                if (prop.name === durationProp?.name) return;

                if (!this.allowEditAllProps && !S.render.allowPropertyEdit(ast.editNode, prop.name)) {
                    return;
                }

                if (this.allowEditAllProps || (
                    !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {

                    if (!S.props.isGuiControlBasedProp(prop) && !S.props.isHiddenProp(prop)) {
                        let allowSelection = !_.customProps || _.type?.hasSelectableProp(prop.name);
                        if (_.type && !_.type.allowDeleteProperty(prop.name)) {
                            allowSelection = false;
                        }
                        const tableRow = this.makePropEditField(_.type, prop, durationProp, allowSelection, _.type ? _.type.getEditorRowsForProp(prop.name) : 1, _.flexPropsEditPanel);
                        _.propsParent.addChild(tableRow);
                        ret = true;
                    }
                }
            });
        }
        _.propsParent.ordinalSortChildren();
        return ret;
    }

    hasTag(tag: string): boolean {
        const tags = this.tagsState.getValue().split(" ");
        return tags.includes(tag);
    }

    _addTag = (tag: string) => {
        let val = this.tagsState.getValue();
        val = val.trim();
        if (val) val += " ";
        val += tag;
        this.tagsState.setValue(this.sortTags(val));
        this.mergeState({});
    }

    _removeTag = (removeTag: string) => {
        let val = this.tagsState.getValue();
        val = val.trim();
        const tags: string[] = val.split(" ");
        let newTags = "";

        tags.forEach(tag => {
            if (removeTag !== tag) {
                if (newTags) newTags += " ";
                newTags += tag;
            }
        });

        this.tagsState.setValue(newTags);
        this.mergeState({});
    }

    sortTags(tagStr: string) {
        if (!tagStr) return tagStr;
        let tags: string[] = tagStr.split(" ");
        tags = Array.from(new Set(tags)); // removes duplicates
        tags.sort();
        return tags.join(" ");
    }

    addTagsToTextField(dlg: SelectTagsDlg) {
        let val = this.tagsState.getValue();
        val = val.trim();
        const tags: string[] = val.split(" ");
        dlg.getState<SelectTagsDlgLS>().selectedTags.forEach(tag => {
            if (!tag.startsWith("#")) {
                tag = "#" + tag;
            }
            if (!tags.includes(tag)) {
                if (val) val += " ";
                val += tag;
            }
        });
        this.tagsState.setValue(this.sortTags(val));
        this.mergeState({});
    }

    makeCheckboxesRow(advancedOpts: EditorOptions): Comp[] {
        const ast = getAs();

        const encryptCheckBox = advancedOpts.encrypt ? new Checkbox("Encrypt", null, {
            setValue: (checked: boolean) => {
                if (S.crypto.encKeyOk()) {
                    this.utl.setEncryption(checked);
                }
            },
            getValue: (): boolean => this.getState<LS>().encryptCheckboxVal
        }) : null;

        const signCheckBox = S.crypto.avail ? new Checkbox("Sign", null, {
            setValue: (checked: boolean) => {
                if (checked && S.crypto.sigKeyOk()) {
                    this.mergeState({ signCheckboxVal: checked });
                }
            },
            getValue: (): boolean => this.getState<LS>().signCheckboxVal
        }) : null;

        const wordWrapCheckbox = advancedOpts.wordWrap ? new Checkbox("Word Wrap", null, {
            setValue: (checked: boolean) => {
                // this is counter-intuitive that we invert here because 'NOWRAP' is a negation of "wrap"
                S.props.setPropVal(J.NodeProp.NOWRAP, ast.editNode, checked ? null : "1");
                if (this.contentEditor) {
                    this.contentEditor.setWordWrap(checked);
                }
            },
            getValue: (): boolean => S.props.getPropStr(J.NodeProp.NOWRAP, ast.editNode) !== "1"
        }) : null;

        return [wordWrapCheckbox, encryptCheckBox, signCheckBox];
    }

    makeCheckboxPropValueHandler(propName: string): I.ValueIntf {
        const ast = getAs();
        return {
            setValue: (checked: boolean) => S.props.setPropVal(propName, ast.editNode, checked ? "1" : null),
            getValue: (): boolean => S.props.getPropStr(propName, ast.editNode) === "1"
        };
    }

    _save = async () => {
        // it's important to call saveNode before close, because close destroys some of our state,
        // what we need to complete the updating and page refresh.
        const savedOk: boolean = await this.utl.saveNode();
        if (savedOk) {
            this.close();
        }

        dispatch("endEditing", s => {
            s.threadViewQuestionId = null;
        }, true);
    }

    _askAI = async () => {
        // it's important to call saveNode before close, because close destroys some of our state,
        // what we need to complete the updating and page refresh.
        const savedOk: boolean = await this.utl.saveNode();
        if (savedOk) {
            this.close();
        }

        const agentic = getAs().userPrefs.aiAgentMode;
        S.edit.askAiQuestion(getAs().editNode.id, agentic);
    }

    renderButtons(): Comp {
        const ast = getAs();

        const type = S.plugin.getType(ast.editNode.type);
        if (type) {
            type.ensureDefaultProperties(ast.editNode);
        }

        const allowUpload: boolean = type ? (getAs().isAdminUser || type.allowAction(NodeActionType.upload, ast.editNode)) : true;
        const allowShare: boolean = type ? (getAs().isAdminUser || type.allowAction(NodeActionType.share, ast.editNode)) : true;
        const datePropExists = S.props.getProp(J.NodeProp.DATE, ast.editNode);
        const numPropsShowing = this.utl.countPropsShowing();
        const advancedButtons: boolean = !!this.contentEditor;
        const allowPropAdd: boolean = type ? type.getAllowPropertyAdd() : true;

        let activeAiService = S.aiUtil.getActiveService()?.description;
        if (activeAiService) {
            activeAiService = "Active AI Service: " + activeAiService;
        }

        return new ButtonBar([
            new Button("Save", this._save, { title: "Save this node and close editor." }, "btn-primary ui-editor-save"),

            allowUpload ? new IconButton("fa-upload", null, {
                onClick: () => this.utl.upload(null),
                title: "Upload file attachment"
            }) : null,


            allowShare ? new IconButton("fa-share-alt", null, {
                onClick: () => this.utl.share(),
                title: "Share Node"
            }, "ui-editor-share") : null,

            allowPropAdd && numPropsShowing === 0 ? new IconButton("fa-plus-circle", null, {
                onClick: async () => {
                    dispatch("setPropsPanelExpanded", s => {
                        s.propsPanelExpanded = true;
                    });
                    await this.utl.addProperty();
                },
                title: "Add Property"
            }) : null,

            !this.tagsState.getValue() ? new IconButton("fa-tag fa-lg", "", {
                onClick: this._selectTags,
                title: "Select Hashtags"
            }) : null,

            // show delete button only if we're in a fullscreen viewer (like Calendar view)
            S.util.fullscreenViewerActive()
                ? new Button("Delete", () => {
                    S.edit.deleteOneNode(null, ast.editNode.id);
                    this.close();
                }) : null,

            // show Calendar Entry button only if this node is not a Calendar Entry nor CALENDAR type.
            // Note: CALENDAR types contain Calendar Entries but are not themselves Calendar Entries.
            advancedButtons && !datePropExists && ast.editNode.type !== J.NodeType.CALENDAR ? new IconButton("fa-calendar-plus-o", null, {
                title: "Add 'date' property to node\n\nMakes node a Calendar Entry",
                onClick: () => this.utl.addDateProperty()
            }) : null,

            ast.activeTab !== C.TAB_FEED ? new IconButton("fa-android fa-lg", "Ask AI", {
                onClick: this._askAI,
                title: "Query AI, using this Node as the Question.\n\n" + activeAiService
            }) : null,


            new Button("Cancel", () => this.utl.cancelEdit(), null, "btn-secondary"),
        ]);
    }

    _selectTags = async () => {
        const dlg = new SelectTagsDlg("edit", this.tagsState.getValue(), false);
        await dlg.open();
        this.addTagsToTextField(dlg);
    }

    override closeByUser() {
        super.closeByUser();
        this.resetAutoSaver();
    }

    override close = () => {
        setTimeout(() => S.speech.stopListening(), 100);
        super.close();

        dispatch("endEditing", s => {
            s.editNode = null;
            s.afterEditJumpToId = null;
            s.editNodeReplyToId = null;
            S.quanta.newNodeTargetId = null;
            S.quanta.newNodeTargetOffset = -1;
            s.editShowJumpButton = false;
            s.editEncrypt = false;
        });

        if (this.getState<LS>().rerenderAfterClose) {
            S.quanta.refresh();
        }
    }

    _openChangeNodeTypeDlg = async () => {
        const ast = getAs();
        const dlg = new PickNodeTypeDlg(ast.editNode.type);
        await dlg.open();
        if (dlg.chosenType) {
            ast.editNode.type = dlg.chosenType;
            S.edit.updateNode(ast.editNode);
        }
    }

    /* Creates the editing field for a single property 'propEntry' */
    makePropEditField(type: TypeIntf, propEntry: PropertyInfo, durationPropEntry: PropertyInfo,
        allowCheckbox: boolean, rows: number, flexPropsEditPanel: boolean): Div {
        const ast = getAs();

        // Warning: Don't put any left/right margins on this row because the widths to allow widths
        // that sum to precisely 100% to work correctly. Adding a margin would make it wrap
        // prematurely.
        const rowAttribs: any = { className: "marginBottom" };
        const propConfig = type?.getPropConfig(propEntry.name);
        const ordinal: number = propConfig?.ord || 200; // 200 is just a high enough number to fall below numered ones
        const tableRow = new Div(null, rowAttribs);
        const allowEditAllProps: boolean = getAs().isAdminUser;
        const isReadOnly = S.render.isReadOnlyProperty(propEntry.name);
        const editItems: any[] = [];
        const label = propConfig?.label || (type ? type.getEditLabelForProp(ast.editNode, propEntry.name) : propEntry.name);
        const propType = type?.getType(propEntry.name);

        if (flexPropsEditPanel) {
            const w: number = propConfig?.width || 100;
            const widthStr = "" + w + "%";
            rowAttribs.style = { width: widthStr, maxWidth: widthStr };
        }

        let propState: Validator = this.propStates.get(propEntry.name);
        if (!propState) {
            propState = new Validator(propEntry.value);
            this.propStates.set(propEntry.name, propState);
        }

        this.addPropCheckboxOrLabel(allowCheckbox, label, propEntry, editItems);
        let valEditor: Comp = null;
        const multiLine = rows > 1;

        // We have the one special case that a property named 'date' is assumed to be a "Date" type
        // always DATE TYPE
        if (propType === I.DomainType.Date || propEntry.name === J.NodeProp.DATE) {
            let durationState: Validator = null;
            if (durationPropEntry) {
                durationState = this.propStates.get(durationPropEntry.name);
                if (!durationState) {
                    durationState = new Validator(durationPropEntry.value);
                    this.propStates.set(durationPropEntry.name, durationState);
                }
            }

            let addTagFunc = null;
            if (propEntry.name === J.NodeProp.DATE && !this.hasTag("#due")) {
                addTagFunc = this._addTag;
            }

            valEditor = new DateTimeField(propState, durationState, !propConfig || propConfig.showTime, addTagFunc);
        }
        // TEXT/TEXTAREA TYPE
        else if (propType === I.DomainType.Text) {
            if (multiLine) {
                valEditor = new TextArea(null, {
                    rows: "" + rows,
                    id: "prop_" + ast.editNode.id
                }, propState, "textareaMin4 marginRight");
            }
            else {
                valEditor = new TextField({
                    outterClass: "marginRight",
                    inputClass: S.props.getInputClassForType(propEntry.name),
                    val: propState
                });
            }
        }
        // NUMBER TYPE
        else if (propType === I.DomainType.Number) {
            valEditor = new TextField({
                inputType: "number",
                outterClass: "marginRight",
                inputClass: S.props.getInputClassForType(propEntry.name),
                val: propState
            });
        }
        else {
            console.error("Unsupported type: " + type?.getType(propEntry.name));
        }

        if (valEditor && !allowEditAllProps && isReadOnly) {
            valEditor.attribs.readOnly = "readOnly";
            valEditor.attribs.disabled = "disabled";
        }

        editItems.push(valEditor as any as Comp);
        tableRow.children = editItems;
        tableRow.ordinal = ordinal;
        return tableRow;
    }

    private addPropCheckboxOrLabel(allowCheckbox: boolean, label: string, propEntry: PropertyInfo, editItems: any[]) {
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
    }

    async initContent(): Promise<void> {
        const ast = getAs();
        const value = ast.editNode.content || "";

        const encrypted = value.startsWith(J.Constant.ENC_TAG);
        if (!encrypted) {
            this.contentEditorState.setValue(value);
            this.decryptFailed = false;
        }
        else {
            if (S.crypto.avail) {
                // console.log("decrypting: " + value);
                const cipherText = value.substring(J.Constant.ENC_TAG.length);
                const cipherKey = S.props.getCryptoKey(ast.editNode);
                if (cipherKey) {
                    const clearText: string = await S.crypto.decryptSharableString(null, { cipherKey, cipherText });

                    // Warning clearText can be "" (which is a 'falsy' value and a valid decrypted string!)
                    if (clearText === null) {
                        this.contentEditorState.setError("Decryption Failed");
                        this.decryptFail();
                    }
                    else {
                        // console.log("decrypted to:" + value);
                        this.contentEditorState.setValue(clearText);
                    }
                }
                else {
                    this.contentEditorState.setError("Decryption Failed. No Key available.");
                    this.decryptFail();
                }
            }
            else {
                this.contentEditorState.setError("Decryption Failed (Crypto not available)");
                this.decryptFail();
            }
        }
    }

    decryptFail(): void {
        this.decryptFailed = true;
        if (this.contentEditor) {
            this.contentEditor.setEnabled(false);
        }
    }

    makeContentEditor(rows: string, minRows: number): Div {
        const ast = getAs();
        const editItems: Comp[] = [];

        // if this is the first pass thru here (not a re-render) then allow focus() to get called
        const allowFocus = !this.contentEditor;

        this.contentEditor = new TextArea(null, {
            id: C.ID_PREFIX_EDIT + ast.editNode.id,
            rows
        }, this.contentEditorState, "fontInherit", true, minRows, this.contentScrollPos);
        if (this.decryptFailed) {
            this.contentEditor.setEnabled(false);
        }

        const wrap: boolean = S.props.getPropStr(J.NodeProp.NOWRAP, ast.editNode) !== "1";
        this.contentEditor.setWordWrap(wrap);

        if (allowFocus) {
            this.contentEditor.focus();
        }

        editItems.push(new ButtonBar([
            new Icon({
                className: (S.speech.speechActive ? "fa fa-lg fa-microphone-slash editorIcon" : "fa fa-microphone editorIcon"),
                title: "Toggle on/off Speech Recognition to input text",
                onClick: () => this.utl.toggleRecognition()
            }),

            new Icon({
                className: "fa fa-lg fa-smile-o editorIcon",
                title: "Insert emoji at cursor",
                onClick: () => this.utl.insertEmoji()
            }),

            new Icon({
                className: "fa fa-lg fa-user editorIcon",
                title: "Insert Username(s) at cursor",
                onClick: () => this.utl.insertUserNames()
            }),

            !ast.isAnonUser && !ast.mobileMode && S.speech.ttsSupported() ? new Icon({
                className: "fa fa-lg fa-volume-up editorIcon",
                onMouseOver: () => { S.quanta.selectedForTts = window.getSelection().toString(); },
                onMouseOut: () => { S.quanta.selectedForTts = null; },
                onClick: () => this.utl.speakerClickInEditor(),
                title: "Text-to-Speech: Editor Text or Selection"
            }) : null,
            new Selection(null, null, [
                { key: "h0", val: "" },
                { key: "h1", val: "H1" },
                { key: "h2", val: "H2" },
                { key: "h3", val: "H3" },
                { key: "h4", val: "H4" },
                { key: "h5", val: "H5" },
                { key: "h6", val: "H6" }
            ], "compactFormSelect", "headingDropDown", {
                setValue: (val: string) => {
                    this.utl.setHeadingLevel(val);
                },
                getValue: (): string => this.utl.getHeadingLevel()
            })
        ], "float-end microMarginBottom"));
        editItems.push(this.contentEditor as any as Comp);

        return new Div(null, { className: "contentEditor" }, editItems);
    }
}

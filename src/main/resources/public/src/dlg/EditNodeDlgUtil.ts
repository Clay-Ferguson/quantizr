import { dispatch, getAs, promiseDispatch } from "../AppContext";
import { AppState } from "../AppState";
import { SymKeyDataPackage } from "../Crypto";
import * as J from "../JavaIntf";
import { Attachment, NodeInfo, PropertyInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Span } from "../comp/core/Span";
import { AskNodeLinkNameDlg } from "./AskNodeLinkNameDlg";
import { ConfirmDlg } from "./ConfirmDlg";
import { EditNodeDlg, LS as EditNodeDlgState } from "./EditNodeDlg";
import { EditPropertyDlg, LS as EditPropertyDlgState } from "./EditPropertyDlg";
import { EmojiPickerDlg, LS as EmojiPickerDlgState } from "./EmojiPickerDlg";
import { FriendsDlg, LS as FriendsDlgState } from "./FriendsDlg";
import { UploadFromFileDropzoneDlg } from "./UploadFromFileDropzoneDlg";

export class EditNodeDlgUtil {
    public countPropsShowing = (dlg: EditNodeDlg): number => {
        const ast = getAs();
        const type = S.plugin.getType(ast.editNode.type);
        if (type) {
            type.ensureDefaultProperties(ast.editNode);
        }

        let numPropsShowing: number = 0;

        // This loop creates all the editor input fields for all the properties
        ast.editNode.properties?.forEach(prop => {
            if (!dlg.allowEditAllProps && !S.render.allowPropertyEdit(ast.editNode, prop.name)) {
                return;
            }

            if (dlg.allowEditAllProps || (
                !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {

                if (!S.props.isGuiControlBasedProp(prop) && !S.props.isHiddenProp(prop)) {
                    numPropsShowing++;
                }
            }
        });
        return numPropsShowing;
    }

    public saveNode = async (dlg: EditNodeDlg): Promise<boolean> => {
        const ast = getAs();
        const editNode = ast.editNode;

        let content: string;
        let clearText: string;
        if (dlg.contentEditor) {
            content = clearText = dlg.contentEditor.getValue();

            if (S.crypto.avail) {
                const cipherKey = S.props.getCryptoKey(editNode);
                if (cipherKey) {
                    content = await S.crypto.symEncryptStringWithCipherKey(cipherKey, content);
                    content = J.Constant.ENC_TAG + content;
                }
            }
        }

        if (content) {
            content = content.trim();
        }

        if (clearText) {
            clearText = clearText.trim();
        }

        editNode.content = content;
        editNode.name = dlg.nameState.getValue();
        editNode.tags = dlg.tagsState.getValue();

        this.savePropsToNode(editNode, dlg);
        this.saveAttFileNamesToNode(editNode, dlg);

        /*
        Note: if this is an encrypted node we will be signing the cipher text (encrypted string),
        because content has already  been encrypted just above.

        todo-2: Note: We only sign if admin for now, by design */

        if (dlg.getState<EditNodeDlgState>().signCheckboxVal) {
            if (S.crypto.avail) {
                // Note: this needs to come AFTER the 'savePropsToNode' call above because we're
                // overriding what was possibly in there.
                await S.crypto.signNode(editNode);
            }
        }
        else {
            S.props.setPropVal(J.NodeProp.CRYPTO_SIG, editNode, "[null]");
        }

        dlg.resetAutoSaver();
        await S.edit.saveNode(editNode, true);
        return true;
    }

    // Takes all the propStates values and converts them into node properties on the node
    savePropsToNode = (editNode: NodeInfo, dlg: EditNodeDlg) => {
        const type = S.plugin.getType(editNode.type);
        editNode.properties?.forEach(prop => {
            const propState = dlg.propStates.get(prop.name);

            if (propState) {
                // hack to store dates as numeric prop (todo-2: need a systematic way to assign JSON
                // types to properties)
                if (prop.name === J.NodeProp.DATE && (typeof propState.getValue() === "string")) {
                    try {
                        prop.value = parseInt(propState.getValue());
                    }
                    catch (e) {
                        S.util.logErr(e, "failed to parse date number: " + propState.getValue());
                    }
                }
                else {
                    const dataType = type.getType(prop.name);
                    if (dataType === "Number") {
                        prop.value = parseFloat(propState.getValue());
                    }
                    else {
                        prop.value = propState.getValue();
                    }
                }
            }
        });
    }

    saveAttFileNamesToNode = (editNode: NodeInfo, dlg: EditNodeDlg) => {
        const list: Attachment[] = S.props.getOrderedAtts(editNode);
        for (const att of list) {
            const propState = dlg.attFileNames.get((att as any).key);
            if (propState) {
                att.f = propState.getValue();
            }
        }
    }

    addProperty = async (dlg: EditNodeDlg): Promise<void> => {
        const ast = getAs();
        const state: EditNodeDlgState = dlg.getState<EditNodeDlgState>();
        const propDlg = new EditPropertyDlg(ast.editNode);
        await propDlg.open();

        if (propDlg.nameState.getValue()) {
            ast.editNode.properties = ast.editNode.properties || [];
            const prop: PropertyInfo = {
                name: propDlg.nameState.getValue(),
                value: ""
            }
            ast.editNode.properties.push(prop);

            // this forces a rerender, even though it looks like we're doing nothing to state.
            dlg.mergeState<EditNodeDlgState>(state);
            this.initPropState(dlg, ast.editNode, prop);
        }
        else {
            propDlg.getState<EditPropertyDlgState>().selections.forEach(sop => {
                ast.editNode.properties = ast.editNode.properties || [];

                // if this 'sop' is ALREADY a property we have, ignore it. Don't dupliate it.
                if (ast.editNode.properties.find(prop => prop.name === sop.label)) return;

                const prop: PropertyInfo = {
                    name: sop.label,
                    value: ""
                }
                ast.editNode.properties.push(prop);
                this.initPropState(dlg, ast.editNode, prop);
            });

            // this forces a rerender, even though it looks like we're doing nothing to state.
            dlg.mergeState<EditNodeDlgState>(state);
        }
        // we don't need to return an actual promise here
        return null;
    }

    addDateProperty = async (dlg: EditNodeDlg) => {
        const state = dlg.getState<EditNodeDlgState>();
        const ast = getAs();
        ast.editNode.properties = ast.editNode.properties || [];

        if (S.props.getProp(J.NodeProp.DATE, ast.editNode)) {
            return;
        }

        await promiseDispatch("setPropsPanelExpanded", s => { s.propsPanelExpanded = true; });

        ast.editNode.properties.push({
            name: J.NodeProp.DATE,
            value: new Date().getTime()
        }, {
            name: J.NodeProp.DURATION,
            value: "01:00"
        });

        const tags = dlg.tagsState.getValue();
        if (!tags || tags.indexOf("due") === -1) {
            dlg.tagsState.setValue(tags ? (tags + " #due") : "#due");
        }

        dlg.mergeState<EditNodeDlgState>(state);
    }

    share = async (dlg: EditNodeDlg) => {
        const ast = getAs();
        await S.edit.editNodeSharing(dlg, ast.editNode);
        S.edit.updateNode(ast.editNode);
    }

    upload = async (file: File, dlg: EditNodeDlg) => {
        const ast = getAs();

        const uploadDlg = new UploadFromFileDropzoneDlg(ast.editNode.id, "", file, false, true, async () => {
            await S.edit.refreshFromServer(ast.editNode);
            S.edit.updateNode(ast.editNode);
            dlg.binaryDirty = true;
        }, true);
        await uploadDlg.open();
    }

    deleteProperties = async (dlg: EditNodeDlg, propNames: string[]) => {
        if (!propNames) return;
        const ast = getAs();
        const type = S.plugin.getType(ast.editNode.type);
        if (type) {
            propNames = propNames.filter(v => type.allowDeleteProperty(v));
        }
        const res = await S.rpcUtil.rpc<J.DeletePropertyRequest, J.DeletePropertyResponse>("deleteProperties", {
            nodeId: ast.editNode.id,
            propNames
        });

        if (S.util.checkSuccess("Delete property", res)) {
            const state = dlg.getState<EditNodeDlgState>();
            propNames.forEach(propName => S.props.deleteProp(ast.editNode, propName));
            dlg.mergeState<EditNodeDlgState>(state);
        }
    }

    deletePropsGesture = async (dlg: EditNodeDlg) => {
        const confirmDlg = new ConfirmDlg("Delete the selected properties?", "Confirm Delete",
            "btn-danger", "alert alert-danger");
        await confirmDlg.open();
        if (confirmDlg.yes) {
            this.deleteSelectedProperties(dlg);
        }
    }

    deleteSelectedProperties = (dlg: EditNodeDlg) => {
        const keys: string[] = [];
        const delProps = dlg.getState<EditNodeDlgState>().selectedProps;

        // special case: If user is deleting a date also delete the duration, because these go together.
        if (delProps.has("date")) {
            delProps.add("duration");
        }
        delProps.forEach(prop => keys.push(prop));
        this.deleteProperties(dlg, keys);
    }

    setEncryption = async (dlg: EditNodeDlg, encrypt: boolean) => {
        dlg.mergeState({ encryptCheckboxVal: encrypt });
        const state = dlg.getState<EditNodeDlgState>();
        const ast = getAs();
        if (encrypt && S.props.isPublic(ast.editNode)) {
            S.util.showMessage("Cannot encrypt a node that is shared to public. Remove public share first.", "Warning");
            return;
        }
        if (dlg.pendingEncryptionChange) return;

        const encrypted: boolean = S.props.isEncrypted(ast.editNode);

        /* only if the encryption setting changed do we need to do anything here */
        if (encrypted !== encrypt) {
            dlg.pendingEncryptionChange = true;
            try {
                /* If we're turning off encryption for the node */
                if (!encrypt) {
                    /* Take what's in the editor and put that into this.node.content, because it's
                    the correct and only place the correct updated text is guaranteed to be in the
                    case where the user made some changes before disabling encryption. */
                    ast.editNode.content = dlg.contentEditor.getValue();
                    S.props.setPropVal(J.NodeProp.ENC_KEY, ast.editNode, null);
                }
                /* Else need to ensure node is encrypted */
                else {
                    // if we need to encrypt and the content is not currently encrypted.
                    if (S.crypto.avail && !ast.editNode.content?.startsWith(J.Constant.ENC_TAG)) {
                        const content = dlg.contentEditor.getValue();
                        const skdp: SymKeyDataPackage = await S.crypto.encryptSharableString(null, content);

                        if (skdp.cipherKey && skdp.cipherKey) {
                            ast.editNode.content = J.Constant.ENC_TAG + skdp.cipherText;

                            /* Set ENC_KEY to be the encrypted key, which when decrypted can be used
                            to decrypt the content of the node. This ENC_KEY was encrypted with the
                            public key of the owner of this node, and so can only be decrypted with
                            their private key. */
                            S.props.setPropVal(J.NodeProp.ENC_KEY, ast.editNode, skdp.cipherKey);
                        }
                    }
                }

                dlg.mergeState<EditNodeDlgState>(state);
            }
            finally {
                dlg.pendingEncryptionChange = false;
            }
        }
    }

    cutUploads = async (dlg: EditNodeDlg) => {
        const attSet = dlg.getState<EditNodeDlgState>().selectedAttachments;
        if (!attSet || attSet.size === 0) return;

        dispatch("cutAttachments", (s: AppState) => {
            s.cutAttachmentsFromId = s.editNode.id;
            s.cutAttachments = new Set(attSet);
        });

        dlg.mergeState<EditNodeDlgState>({
            selectedAttachments: new Set<string>()
        });
    }

    deleteUploads = async (dlg: EditNodeDlg) => {
        if (dlg.getState<EditNodeDlgState>().selectedAttachments?.size === 0) return;

        const confirmDlg = new ConfirmDlg("Delete the selected Attachments?", "Confirm Delete",
            "btn-danger", "alert alert-danger");
        await confirmDlg.open();
        if (!confirmDlg.yes) return;

        const ast = getAs();
        let delAttKeys = "";
        dlg.getState<EditNodeDlgState>().selectedAttachments?.forEach(prop => {
            delete ast.editNode.attachments[prop];

            if (delAttKeys) {
                delAttKeys += ",";
            }
            delAttKeys = prop;
        });

        if (delAttKeys) {
            await S.rpcUtil.rpc<J.DeleteAttachmentRequest, J.DeleteAttachmentResponse>("deleteAttachment", {
                nodeId: ast.editNode.id,
                attName: delAttKeys
            });
        }

        if (S.util.getPropertyCount(ast.editNode.attachments) === 0) {
            ast.editNode.attachments = null;
        }

        dlg.mergeState<EditNodeDlgState>({
            selectedAttachments: new Set<string>()
        });

        S.edit.updateNode(ast.editNode);
        dlg.binaryDirty = true;
    }

    initPropState = (dlg: EditNodeDlg, node: NodeInfo, propEntry: PropertyInfo) => {
        const allowEditAllProps: boolean = getAs().isAdminUser;
        const isReadOnly = S.render.isReadOnlyProperty(propEntry.name);
        const propVal = propEntry.value;
        const propValStr = propVal || "";
        // console.log("making single prop editor: prop[" + propEntry.property.name + "] val[" + propEntry.property.value
        //     + "] fieldId=" + propEntry.id);

        let propState: Validator = dlg.propStates.get(propEntry.name);
        if (!propState) {
            propState = new Validator(propVal);
            dlg.propStates.set(propEntry.name, propState);
        }

        if (!allowEditAllProps && isReadOnly) {
            propState.setValue(propValStr);
        }
        else {
            const val = S.props.getPropStr(propEntry.name, node);
            propState.setValue(val);

            /* todo-2: eventually we will have data types, but for now we use a hack
            to detect to treat a string as a date based on its property name. */
            if (propEntry.name === J.NodeProp.DATE) {
                // Ensure we have set the default time if none is yet set.
                if (!propState.getValue()) {
                    propState.setValue("" + new Date().getTime());
                }
            }
        }
    }

    toggleRecognition = (dlg: EditNodeDlg) => {
        S.speech.setListenerCallback((transcript: string) => {
            if (dlg.contentEditor && transcript) {
                dlg.contentEditor.insertTextAtCursor(transcript + " ");
            }
        });

        const speechActive = !dlg.getState<EditNodeDlgState>().speechActive;
        if (speechActive) {
            S.speech.startListening();
        }
        else {
            S.speech.stopListening();
        }
        dlg.mergeState<EditNodeDlgState>({ speechActive });

        setTimeout(() => {
            if (dlg.contentEditor) {
                dlg.contentEditor.focus();
            }
        }, 250);
    }

    initStates = (dlg: EditNodeDlg) => {
        const ast = getAs();

        dlg.onMount((_elm: HTMLElement) => {
            dlg.initContent();
        });

        /* Initialize node name state */
        dlg.nameState.setValue(ast.editNode.name);
        dlg.tagsState.setValue(ast.editNode.tags);
        this.initPropStates(dlg, ast.editNode);
    }

    /* Initializes the propStates for every property in 'node', and optionally if
    'onlyBinaries==true' then we process ONLY the properties on node that are in
    'S.props.allBinaryProps' list, which is how we have to update the propStates after an upload has
    been added or removed.
    */
    initPropStates = (dlg: EditNodeDlg, node: NodeInfo): any => {
        const type = S.plugin.getType(node.type);
        if (type) {
            type.ensureDefaultProperties(node);
        }

        if (node.properties) {
            node.properties.forEach(prop => {
                if (!dlg.allowEditAllProps && !S.render.allowPropertyEdit(node, prop.name)) {
                    return;
                }

                if (dlg.allowEditAllProps || (
                    !S.render.isReadOnlyProperty(prop.name) || S.edit.showReadOnlyProperties)) {

                    if (!S.props.isGuiControlBasedProp(prop) && !S.props.isHiddenProp(prop)) {
                        this.initPropState(dlg, node, prop);
                    }
                }
            });
        }
    }

    getHeadingLevel = (dlg: EditNodeDlg): string => {
        const content = dlg.contentEditor?.getValue() || getAs().editNode.content;
        const level = S.util.countLeadingChars(content, "#");
        if (level > 6) {
            return "h6";
        }
        return "h" + level;
    }

    // Makes sure the editor text starts with 'level' number of "#" characters (markdown headings)
    setHeadingLevel = (dlg: EditNodeDlg, level: string) => {
        // get integer from second character in string
        const levelInt = parseInt(level.substring(1));

        let content = dlg.contentEditor?.getValue();
        const curLevel = S.util.countLeadingChars(content, "#");
        if (levelInt == curLevel) return;
        content = S.util.stripAllLeading(content, "#");
        if (!content.startsWith(" ")) {
            content = " " + content;
        }
        content = "#".repeat(levelInt) + content;
        content = content.trim();
        dlg.contentEditor?.setValue(content);
    }

    insertEmoji = async (dlg: EditNodeDlg) => {
        if (!dlg.contentEditor) return;
        // we have to capture the cursor position BEFORE we open a dialog, because the loss of focus
        // will make us also loose the cursor position.
        const selStart = dlg.contentEditor.getSelStart();
        const eDlg: EmojiPickerDlg = new EmojiPickerDlg();
        await eDlg.open();
        if (eDlg.getState<EmojiPickerDlgState>().selectedEmoji) {
            dlg.contentEditor.insertTextAtCursor(eDlg.getState<EmojiPickerDlgState>().selectedEmoji, selStart);
        }
    }

    insertUserNames = async (dlg: EditNodeDlg) => {
        if (!dlg.contentEditor) return;
        // get the selStart immediately or it can be wrong, after renders.
        const selStart = dlg.contentEditor.getSelStart();
        // we have to capture the cursor position BEFORE we open a dialog, because the loss of focus
        // will make us also loose the cursor position.

        const friendsDlg: FriendsDlg = new FriendsDlg("Friends", null, false);
        await friendsDlg.open();

        if (friendsDlg.getState<FriendsDlgState>().selections?.size > 0) {
            const names: string[] = [];
            friendsDlg.getState<FriendsDlgState>().selections.forEach(n => names.push("@" + n));
            const namesStr = names.join(" ");
            dlg.contentEditor.insertTextAtCursor(" " + namesStr + " ", selStart);
        }
    }

    speakerClickInEditor = (dlg: EditNodeDlg) => {
        if (getAs().speechSpeaking) {
            S.speech.stopSpeaking();
        }
        else {
            const content = S.quanta.selectedForTts ? S.quanta.selectedForTts : dlg.contentEditorState.getValue();
            if (content) {
                S.speech.speakText(content, false);
            }
        }
    }

    cancelEdit = (dlg: EditNodeDlg) => {
        const ast = getAs();
        dlg.closeByUser();
        dlg.close();

        // rollback properties.
        ast.editNode.properties = dlg.initialProps;

        if (dlg.binaryDirty) {
            S.quanta.refresh();
        }

        dispatch("endEditing", s => {
            s.threadViewQuestionId = null;
        }, true);
    }

    renderLinksEditing = (): Div => {
        const ast = getAs();
        if (!ast.editNode.links) return null;

        let hasLinks = false;
        const linkComps: Comp[] = [];
        if (ast.editNode.links) {
            linkComps.push(new Span("RDF: ", { className: "linksPrompt" }));
            ast.editNode.links.forEach((link: J.NodeLink) => {
                hasLinks = true;
                linkComps.push(new Span(link.name, {
                    className: "nodeLink",
                    title: "Click to Edit Link",
                    onClick: () => this.editLink(link.name)
                }));
            });
        }
        return hasLinks ? new Div(null, { className: "linksPanelInEditor" }, linkComps) : null;
    }

    editLink = async (name: string) => {
        const link = getAs().editNode.links.find(link => link.name == name);
        const dlg = new AskNodeLinkNameDlg(link);
        await dlg.open();
    }
}

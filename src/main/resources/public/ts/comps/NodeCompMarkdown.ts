import * as marked from "marked";
import { useSelector } from "react-redux";
import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Html } from "../widget/Html";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMarkdown extends Html {

    // This flag makes encrypted text always decrypt and display immediately. Setting to true works, but the markdown rendering part is
    // not working and it shows up without markdown formatting. Will fix later (todo-1)
    private autoDecrypting: boolean = false;

    constructor(public node: J.NodeInfo, private appState: AppState) {
        super();

        // Set the content display to wider if there is a code block. This makes the non-code text also wrap at a wider
        // width but we have to tolerate that for now, becasue there's not a cleaner 'easy' solution.
        let widthStyle = node.content && node.content.indexOf("```") !== 1 ? "content-medium" : "content-narrow";
        this.attribs.className = "markdown-content " + widthStyle;

        let content = node.content || "";
        let att: any = {
        };

        // console.log("Rendering NodeID=" + node.id + " content=" + node.content);

        if (content.startsWith(J.Constant.ENC_TAG)) {
            att.content = "[Encrypted]";
            att.pendingDecrypt = content;
        }
        else {
            let val = this.renderRawMarkdown(node);
            val = S.render.injectSubstitutions(val);
            att.content = val;
        }

        this.mergeState(att);

        if (this.appState.userPreferences.editMode && node.owner === appState.userName) {
            let hltNode = S.meta64.getHighlightedNode(appState);
            if (hltNode && hltNode.id === node.id) {

                // currently disabled. We don't do 'click to edit' any more because it's really annoying if you click the screen
                // to be sure it has focus and it inadvertently goes into editing when you didn't want that.
                if (C.clickToEditNodes) {
                    this.attribs.className += " mousePointer";
                    this.attribs.title = "Click to edit";
                    this.attribs.onClick = this.clickToEdit;

                    // This was an experiment to help users know where to click, and it does that, but
                    // the margin makes the web page content 'shift' around when user is only just clicking around
                    // and that is super ugly.
                    // this.attribs.style = {
                    //     border: "1px solid rgb(118, 109, 97)",
                    //     borderRadius: ".6em",
                    //     margin: "6px"
                    // };
                }
            }
        }
    }

    clickToEdit = (evt: any): void => {

        // if user clicks an anchor tag inside this markdown we want to ignore that here.
        if (evt.target.href) {
            return;
        }

        // if already editing inline editing a row ignore this click.
        if (this.appState.inlineEditId) return;

        S.util.ajax<J.InitNodeEditRequest, J.InitNodeEditResponse>("initNodeEdit", {
            nodeId: this.node.id
        }, (res) => {
            S.edit.initNodeEditResponse(res, this.appState, false);
        });
    }

    renderRawMarkdown(node: J.NodeInfo): string {
        let content = node.content || "";
        let val = "";

        if (node.type === J.NodeType.PLAIN_TEXT) {

            let nowrapProp: J.PropertyInfo = S.props.getNodeProp(J.NodeProp.NOWRAP, node);
            let wordWrap = !(nowrapProp && nowrapProp.value === "1");

            if (content) {
                if (wordWrap) {
                    let contentFormatted = S.util.escapeHtml(content);
                    contentFormatted = S.util.replaceAll(contentFormatted, "\n\r", "<br>");
                    contentFormatted = S.util.replaceAll(contentFormatted, "\n", "<br>");
                    contentFormatted = S.util.replaceAll(contentFormatted, "\r", "<br>");
                    val = "<div class='fixedFont'>" + contentFormatted + "</div>";
                }
                else {
                    val = "<pre>" + S.util.escapeHtml(content) + "</pre>";
                }
            }
            else {
                val = "";
            }
        }
        else {
            S.render.initMarkdown();

            // todo-1: put some more thought into this...
            // turning this off because when it appears in a url, blows up the link. Need to find some better way.
            // if (S.srch.searchText) {
            //     /* This results in a <strong><em> wrapping the text, which we have a special styling for with a green background for each
            //     search term so it's easy to see them highlighted on the page */
            //     content = content.replace(S.srch.searchText, "**_" + S.srch.searchText + "_**");
            // }

            val = S.util.markdown(content);
        }
        return val;
    }

    preRender(): void {
        let state = this.getState();

        if (this.autoDecrypting && state.pendingDecrypt) {
            let cipherText = state.pendingDecrypt.substring(J.Constant.ENC_TAG.length);
            let cipherHash: string = S.util.hashOfString(cipherText);

            // if we have already decrypted this data use the result.
            if (S.meta64.decryptCache[cipherHash]) {
                this.mergeState({
                    content: S.meta64.decryptCache[cipherHash],
                    pendingDecrypt: null
                });
            }
            else {
                setTimeout(async () => {
                    this.decrypt();
                }, 10);
            }
        }
    }

    decrypt = async () => {
        let state = this.getState();
        if (!state.pendingDecrypt) return;
        let appState: AppState = store.getState();

        // todo-1: for performance we could create a map of the hash of the encrypted content (key) to the
        // decrypted text (val), and hold that map so that once we decrypt a message we never use encryption again at least
        // until of course browser refresh
        let cipherText = state.pendingDecrypt.substring(J.Constant.ENC_TAG.length);
        // console.log("decrypting CIPHERTEXT: " + cipherText);

        let cipherKey = S.props.getCryptoKey(this.node, appState);
        if (cipherKey) {
            let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

            if (clearText === null) {
                clearText = "[Decrrypt Failed]";
            }

            this.mergeState({
                content: clearText,
                pendingDecrypt: null
            });
        }
    }
}

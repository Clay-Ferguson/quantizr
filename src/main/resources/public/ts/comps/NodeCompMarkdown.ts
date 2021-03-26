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

    /* This makes the encrypted text visible without editing the node which is important to have
    on so nodes shared to you can be seen, because a user can't edit nodes they don't own */
    private autoDecrypting: boolean = true;

    constructor(public node: J.NodeInfo, private appState: AppState) {
        super();

        // Set the content display to wider if there is a code block. This makes the non-code text also wrap at a wider
        // width but we have to tolerate that for now, becasue there's not a cleaner 'easy' solution.
        let widthStyle = node.content && node.content.indexOf("```") !== 1 ? "content-medium" : "content-narrow";
        this.attribs.className = "markdown-content " + widthStyle;

        let content = node.content || "";
        let att: any = {
        };

        /* If this content is encrypted we set it in 'pendingDecrypt' to decrypt it asynchronously */
        if (content.startsWith(J.Constant.ENC_TAG)) {
            att.content = "[Encrypted]";
            att.pendingDecrypt = content;
        }
        /* otherwise it's not encrypted and we display the normal way */
        else {
            let val = this.renderRawMarkdown(node);
            val = S.render.injectSubstitutions(node, val);
            att.content = val;
        }

        this.mergeState(att);
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

            // todo-2: put some more thought into this...
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
            if (S.meta64.decryptCache.get(cipherHash)) {
                this.mergeState({
                    content: S.meta64.decryptCache.get(cipherHash),
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

        let cipherText = state.pendingDecrypt.substring(J.Constant.ENC_TAG.length);
        // console.log("decrypting CIPHERTEXT (in NodeCompMarkdown): " + cipherText);

        let cipherKey = S.props.getCryptoKey(this.node, appState);
        if (cipherKey) {
            // console.log("CIPHERKEY " + cipherKey);
            let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

            if (clearText === null) {
                clearText = "[Decrypt Failed]";
            }

            // todo-0: verify markdown is preserved and rendered correctly (this code probably will do it)
            // let val = this.renderRawMarkdown(node);
            // val = S.render.injectSubstitutions(node, val);
            // att.content = val;

            this.mergeState({
                content: clearText,
                pendingDecrypt: null
            });
        }
    }
}

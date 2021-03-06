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

    // When the rendered content contains urls we will load the "Open Graph" data and display it below the content.
    urls: string[];

    constructor(public node: J.NodeInfo, private appState: AppState) {
        super(null, { key: "ncmkd_" + node.id });

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
            att.content = this.renderRawMarkdown(node);
        }

        this.mergeState(att);
    }

    /* If content is passed in it will be used. It will only be passed in when the node is encrypted and the text
    has been decrypted and needs to be rendered, in which case we don't need the node.content, but use the 'content' parameter here */
    renderRawMarkdown(node: J.NodeInfo, content: string = null): string {
        content = content || node.content || "";
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

            val = S.render.injectSubstitutions(node, content);
            val = S.util.markdown(val);

            /* parse tags, to build OpenGraph */
            let state: AppState = store.getState();
            this.parseAnchorTags(val, content);
        }
        return val;
    }

    parseAnchorTags = (val: string, content: string): void => {
        if (val.indexOf("<") === -1 ||
            val.indexOf(">") === -1) return;

        this.urls = [];
        let elm = document.createElement("html");
        elm.innerHTML = val;
        elm.querySelectorAll("a").forEach((e: any) => {
            if (!e.href) return;
            let href = e.href.trim();
            href = S.util.stripIfEndsWith(href, "/");

            /* Mastodon has HTML content that uses hrefs for each mention or hashtag, so in order to avoid
            trying to process those for OpenGraph we detect using the 'mention' and 'hashtag' classes */
            if (e.classList.contains("mention") ||
                e.classList.contains("hashtag")) return;

            // Detect if this link is part of a Markdown Named link and if so then we don't generate the OpenGraph for that either
            if (content.indexOf("(" + href + ")") !== -1) return;
            if (content.indexOf("* " + href) !== -1) return;

            this.urls.push(href);
        });
    }

    preRender(): void {
        let state = this.getState();

        if (this.autoDecrypting && state.pendingDecrypt) {
            let cipherText = state.pendingDecrypt.substring(J.Constant.ENC_TAG.length);
            let cipherHash: string = S.util.hashOfString(cipherText);

            // if we have already decrypted this data use the result.
            if (S.meta64.decryptCache.get(cipherHash)) {

                let clearText = S.meta64.decryptCache.get(cipherHash);
                clearText = this.renderRawMarkdown(this.node, clearText);

                this.mergeState({
                    content: clearText,
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

            clearText = this.renderRawMarkdown(this.node, clearText);

            this.mergeState({
                content: clearText,
                pendingDecrypt: null
            });
        }
    }
}

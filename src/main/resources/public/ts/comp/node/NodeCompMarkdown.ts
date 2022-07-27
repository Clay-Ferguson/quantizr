import { store } from "../../AppRedux";
import { AppState } from "../../AppState";
import { Html } from "../../comp/core/Html";
import * as J from "../../JavaIntf";
import { S } from "../../Singletons";

interface LS {
    content: string;
    pendingDecrypt?: string;
}

export class NodeCompMarkdown extends Html {

    /* This makes the encrypted text visible without editing the node which is important to have
    on so nodes shared to you can be seen, because a user can't edit nodes they don't own */
    private autoDecrypting: boolean = true;

    // When the rendered content contains urls we will load the "Open Graph" data and display it below the content.
    urls: string[];

    constructor(public node: J.NodeInfo, private appState: AppState) {
        super(null, { key: "ncmkd_" + node.id });

        if (!appState.mobileMode) {
            let widthStyle = node.content && node.content.indexOf("```") !== -1 ? "content-wide" : "content-narrow";
            this.attribs.className = "markdown-content " + widthStyle;
        }
        else {
            this.attribs.className = "markdown-content";
        }

        let content = node.content || "";
        let att: LS = {
            content: null
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

        this.mergeState<LS>(att);
    }

    /* If content is passed in it will be used. It will only be passed in when the node is encrypted and the text
    has been decrypted and needs to be rendered, in which case we don't need the node.content, but use the 'content' parameter here */
    renderRawMarkdown(node: J.NodeInfo, content: string = null): string {
        content = content || node.content || "";
        let val = "";

        if (node.type === J.NodeType.PLAIN_TEXT) {
            let nowrapProp = S.props.getProp(J.NodeProp.NOWRAP, node);
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
            // todo-2: put some more thought into this...
            // turning this off because when it appears in a url, blows up the link. Need to find some better way.
            // if (S.srch.searchText) {
            //     /* This results in a <strong><em> wrapping the text, which we have a special styling for with a green background for each
            //     search term so it's easy to see them highlighted on the page */
            //     content = content.replace(S.srch.searchText, "**_" + S.srch.searchText + "_**");
            // }

            val = S.render.injectSubstitutions(node, content);
            val = S.util.markdown(val);
            val = S.util.insertActPubTags(val, node);

            /* parse tags, to build OpenGraph */
            let state: AppState = store.getState();
            this.parseAnchorTags(val, content);
        }
        return val;
    }

    parseAnchorTags = (val: string, content: string) => {
        if (val.indexOf("<") === -1 ||
            val.indexOf(">") === -1) return;

        this.urls = null;
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

            // lazy instantiate
            if (!this.urls) {
                this.urls = [];
            }
            this.urls.push(href);
        });
    }

    preRender(): void {
        let state: LS = this.getState<LS>();

        if (this.autoDecrypting && state.pendingDecrypt) {
            let cipherText = state.pendingDecrypt.substring(J.Constant.ENC_TAG.length);
            let cipherHash: string = S.util.hashOfString(cipherText);

            // if we have already decrypted this data use the result.
            if (S.quanta.decryptCache.get(cipherHash)) {

                let clearText = S.quanta.decryptCache.get(cipherHash);
                clearText = this.renderRawMarkdown(this.node, clearText);

                this.mergeState<LS>({
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
        let state: LS = this.getState<LS>();
        if (!state.pendingDecrypt) return;
        let appState: AppState = store.getState();
        let cipherText = state.pendingDecrypt.substring(J.Constant.ENC_TAG.length);
        // console.log("decrypting CIPHERTEXT (in NodeCompMarkdown): " + cipherText);

        let cipherKey = S.props.getCryptoKey(this.node, appState);
        if (cipherKey) {
            // console.log("CIPHERKEY " + cipherKey);
            let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

            if (!clearText) {
                clearText = "[Decrypt Failed]";
            }

            clearText = this.renderRawMarkdown(this.node, clearText);

            this.mergeState<LS>({
                content: clearText,
                pendingDecrypt: null
            });
        }
    }
}

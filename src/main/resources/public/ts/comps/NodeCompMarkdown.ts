import * as marked from "marked";
import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { MarkdownDiv } from "../widget/MarkdownDiv";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

/* General Widget that doesn't fit any more reusable or specific category other than a plain Div, but inherits capability of Comp class */
export class NodeCompMarkdown extends MarkdownDiv {

    /*
    This flag makes the text ALWAYS decrypt and display onscreen if the person owning the content is viewing it, but this
    is most likely never wanted, because it's insecure in screen-share context, or when someone can see your screen for any reason.
    todo-1: We could make this a user preference so users in a secure location can just view all encrypted data.

    UPDATE: turning this ON for now, because for testing 'shared' nodes we don't have editing capability and thus need a way to decrypt

    todo-0: this is not working fully, it shows [encrypted] upon rendering and doesn't decrypt until the row is clicked.
    */
    private immediateDecrypting: boolean = false;

    constructor(public node: J.NodeInfo, private appState: AppState) {
        super();

        // Set the content display to wider if there is a code block. This makes the non-code text also wrap at a wider
        // width but we have to tolerate that for now, becasue there's not a cleaner 'easy' solution.
        let widthStyle = node.content && node.content.indexOf("```") !== 1 ? "content-medium" : "content-narrow";
        this.attribs.className = "markdown-content markdown-html " + widthStyle;

        if (this.appState.userPreferences.editMode && node.owner === appState.userName) {
            let hltNode = S.meta64.getHighlightedNode(appState);
            if (hltNode && hltNode.id === node.id) {
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

            // Do the actual markdown rendering here.
            val = marked(content);

            // the marked adds a 'p tag' wrapping we don't need so we remove it just to speed up DOM as much as possible
            val = val.trim();
            val = S.util.stripIfStartsWith(val, "<p>");
            val = S.util.stripIfEndsWith(val, "</p>");
            // console.log("MARKDOWN OUT: " + mc);
        }
        return val;
    }

    preRender(): void {
        let state: AppState = useSelector((state: AppState) => state);
        let node = this.node;
        let content = node.content || "";

        let val;
        if (content.startsWith(J.Constant.ENC_TAG)) {
            val = "[Encrypted]";
        }
        else {
            val = this.renderRawMarkdown(node);
        }

        val = S.render.injectSubstitutions(val);

        // NOTE: markdown-html doesn't apply any actual styling but instead is used in a JS dom lookup to find all the
        // images under each markdown element to apply a styling update post-render.
        // todo-1: need to research the built-in support in React that allows these kinds of 'post-render' updates.
        // see: https://reactjs.org/docs/hooks-reference.html#useeffect
        // let div = new MarkdownDiv(val, {
        //     className: clazz + " markdown-html",
        // });

        this.state.content = val;

        // We always alter all 'img' tags that may have been generated by the markdown engine, to make sure they have
        // the correct style we want, which is the 100% display across the 'document' area (not full browser, but the full
        // width across the same area the text is rendered inside).
        this.whenElm(async (elm: HTMLElement) => {

            if (this.immediateDecrypting && content.startsWith(J.Constant.ENC_TAG)) {
                setTimeout(async () => {
                    // todo-1: for performance we could create a map of the hash of the encrypted content (key) to the
                    // decrypted text (val), and hold that map so that once we decrypt a message we never use encryption again at least
                    // until of course browser refresh (would be Javascript hash)
                    let cipherText = content.substring(J.Constant.ENC_TAG.length);
                    // console.log("NODE DATA: CIPHERTEXT: "+cipherText);

                    let cipherKey = S.props.getCryptoKey(node, state);
                    if (cipherKey) {
                        let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

                        if (clearText === null) {
                            node.content = clearText;
                            let val2 = this.renderRawMarkdown(node);
                            this.state.content = val2;
                        }
                        else {
                            this.state.content = "[Decryption Failed]";
                        }
                    }
                }, 1);
            }
        });
    }
}

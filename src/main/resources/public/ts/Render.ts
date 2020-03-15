import * as J from "./JavaIntf";
import { Comp } from "./widget/base/Comp";
import { Button } from "./widget/Button";
import { ButtonBar } from "./widget/ButtonBar";
import { Checkbox } from "./widget/Checkbox";
import { Div } from "./widget/Div";
import { Span } from "./widget/Span";
import { Img } from "./widget/Img";
import { Anchor } from "./widget/Anchor";
import { Constants as C } from "./Constants";
import { RenderIntf } from "./intf/RenderIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import * as marked from 'marked';
import * as highlightjs from 'highlightjs';
import { Icon } from "./widget/Icon";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import { MarkdownDiv } from "./widget/MarkdownDiv";
import { HorizontalLayout } from "./widget/HorizontalLayout";
import { AudioPlayerDlg } from "./dlg/AudioPlayerDlg";
import { VideoPlayerDlg } from "./dlg/VideoPlayerDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class Render implements RenderIntf {
    private debug: boolean = false;
    private markedRenderer = null;

    //This flag makes the text ALWAYS decrypt and display onscreen if the person owning the content is viewing it, but this
    //is most likely never wanted, because it's insecure in screen-share context, or when someone can see your screen for any reason.
    //todo-1: We could make this a user preference so users in a secure location can just view all encrypted data.
    //
    //UPDATE: turning this ON for now, because for testing 'shared' nodes we don't have editing capability and thus need a way to decrypt
    private immediateDecrypting: boolean = true;

    /* Since js is singlethreaded we can have lastOwner get updated from any other function and use it to keep track
    during the rendering, what the last owner was so we can keep from displaying the same avatars unnecessarily */
    private lastOwner: string;

    private renderBinary = (node: J.NodeInfo): Comp => {
        /*
         * If this is an image render the image directly onto the page as a visible image
         */
        if (S.props.hasImage(node)) {
            return this.makeImageTag(node);
        }
        else if (S.props.hasVideo(node)) {
            return new ButtonBar([
                new Button("Play Video", () => {
                    new VideoPlayerDlg(this.getStreamUrlForNodeAttachment(node)).open();
                }),
                new Div("", {
                    className: "videoDownloadLink"
                }, [new Anchor(this.getUrlForNodeAttachment(node), "[Download Video]")])
            ], "marginAll");
        }
        else if (S.props.hasAudio(node)) {
            return new ButtonBar([
                new Button("Play Audio", () => {
                    new AudioPlayerDlg(this.getStreamUrlForNodeAttachment(node)).open();
                }),
                new Div("", {
                    className: "audioDownloadLink"
                }, [new Anchor(this.getUrlForNodeAttachment(node), "[Download Audio]")])
            ], "marginAll");
        }
        /*
         * If not an image we render a link to the attachment, so that it can be downloaded.
         */
        else {
            let anchor = new Anchor(this.getUrlForNodeAttachment(node), "[Download Attachment]");
            return new Div("", {
                className: "binary-link"
            }, [anchor]);
        }
    }

    buildRowHeader = (node: J.NodeInfo): Div => {
        let children = [];

        let priority = S.props.getNodePropVal(J.NodeProp.PRIORITY, node);
        priority = (priority && priority != "0") ? " P" + priority : "";

        if (node.name) {
            children.push(new Div("Name: " + node.name));
        }

        children.push(new Div(
            "ID:" + node.id + " " + //
            ((node.logicalOrdinal != -1) ? ("[" + node.logicalOrdinal + "] ") : "") + //
            "Type:" + node.type + //
            (node.lastModified ? " (Mod: " + S.util.formatDate(new Date(node.lastModified)) + ")" : "") + //
            priority));

        if (node.owner && node.owner != "?") {
            let clazz: string = (node.owner === S.meta64.userName) ? "created-by-me" : "created-by-other";
            children.push(new Span("Created By: " + node.owner, {
                className: clazz
            }));
        }

        return new Div(null, {
            className: "header-text"
        }, children);
    }

    injectSubstitutions = (val: string): string => {
        val = S.util.replaceAll(val, "{{locationOrigin}}", window.location.origin);

        if (val.indexOf("{{paypal-button}}") != -1) {
            val = S.util.replaceAll(val, "{{paypal-button}}", C.PAY_PAL_BUTTON);
        }
        return val;
    }

    /*
     * This is the function that renders each node in the main window. The rendering in here is very central to the
     * app and is what the user sees covering 90% of the screen most of the time. The *content* nodes.
     */
    renderNodeContent = (node: J.NodeInfo, rowStyling: boolean, showHeader: boolean): Comp[] => {
        //todo-3: bring back top right image support. disabling for now to simplify refactoring
        //let topRightImgTag = null; //this.getTopRightImageTag(node);
        //let ret: string = topRightImgTag ? topRightImgTag.render_Html() : "";

        let ret: Comp[] = [];
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);

        /* todo-2: enable headerText when appropriate here */
        if (S.meta64.showMetaData) {
            if (showHeader) {
                ret.push(this.buildRowHeader(node));
            }
        }

        if (S.meta64.showProperties) {
            let propTable = S.props.renderProperties(node.properties);
            if (propTable) {
                ret.push(propTable);
            }
        } else {
            let renderComplete: boolean = false;

            /*
             * Special Rendering for Nodes that have a plugin-renderer
             */
            if (typeHandler) {
                renderComplete = true;
                ret.push(typeHandler.render(node, rowStyling));
            }

            if (!renderComplete) {
                let retState: any = {};
                retState.renderComplete = renderComplete;
                ret.push(this.renderMarkdown(rowStyling, node, retState));
                renderComplete = retState.renderComplete;
            }

            if (!renderComplete) {
                let properties = S.props.renderProperties(node.properties);
                if (properties) {
                    ret.push(properties);
                }
            }
        }

        /* if node owner matches node id this is someone's account root node, so what we're doing here is not
        showing the normal attachment for this node, because that will the same as the avatar */
        let isAnAccountNode = node.ownerId && node.id == node.ownerId;

        if (S.props.hasBinary(node) && !isAnAccountNode) {
            let binary = this.renderBinary(node);

            /*
             * We append the binary image or resource link either at the end of the text or at the location where
             * the user has put {{insert-attachment}} if they are using that to make the image appear in a specific
             * location in the content text.
             *
             * NOTE: temporarily removing during refactoring.
             */
            // if (util.contains(ret, cnst.INSERT_ATTACHMENT)) {
            //     ret = S.util.replaceAll(ret, cnst.INSERT_ATTACHMENT, binary.render());
            // } else {
            ret.push(binary);
            //}
        }

        return ret;
    }

    /* Renders 'content' property as markdown. Note: rowStyling arg is not currently being used
    but will eventually be used again to tweak clazz, the way it originally was used for. */
    renderMarkdown = (rowStyling: boolean, node: J.NodeInfo, retState: any): Comp => {
        let content = node.content || "";
        retState.renderComplete = true;

        let clazz = "markdown-content content-narrow";

        let val;
        if (content.startsWith(J.Constant.ENC_TAG)) {
            val = "[Encrypted]";
        }
        else {
            val = this.renderRawMarkdown(node);
        }

        val = this.injectSubstitutions(val);

        // NOTE: markdown-html doesn't apply any actual styling but instead is used in a JS dom lookup to find all the 
        // images under each markdown element to apply a styling update post-render.
        // todo-1: need to research the built-in support in React that allows these kinds of 'post-render' updates.
        // see: https://reactjs.org/docs/hooks-reference.html#useeffect
        let div = new MarkdownDiv(val, {
            className: clazz + " markdown-html",
        });

        //We always alter all 'img' tags that may have been generated by the markdown engine, to make sure they have
        //the correct style we want, which is the 100% display across the 'document' area (not full browser, but the full 
        //width across the same area the text is rendered inside). 
        div.whenElm(async (elm: HTMLElement) => {
            this.setImageMaxWidths();

            if (this.immediateDecrypting && content.startsWith(J.Constant.ENC_TAG)) {
                setTimeout(async () => {
                    //todo-1: for performance we could create a map of the hash of the encrypted content (key) to the
                    //decrypted text (val), and hold that map so that once we decrypt a message we never use encryption again at least
                    //until of course browser refresh (would be Javascript hash)                    
                    let cipherText = content.substring(J.Constant.ENC_TAG.length);
                    //console.log("NODE DATA: CIPHERTEXT: "+cipherText);

                    let cipherKey = S.props.getCryptoKey(node);
                    if (cipherKey) {
                        let clearText: string = await S.encryption.decryptSharableString(null, { cipherKey, cipherText });

                        if (clearText) {
                            node.content = clearText;
                            let val2 = this.renderRawMarkdown(node);
                            div.setContent(val2);
                        }
                    }
                }, 1);
            }
        });

        return div;
    }

    renderRawMarkdown = (node: J.NodeInfo): string => {
        let content = node.content || "";
        let val = "";

        // Special case of a PRE-formatted node, we inject backticks to make it render all the content as preformatted markdown */
        let preProp: J.PropertyInfo = S.props.getNodeProp(J.NodeProp.PRE, node);
        if (preProp && preProp.value == "1") {

            let nowrapProp: J.PropertyInfo = S.props.getNodeProp(J.NodeProp.NOWRAP, node);
            let wordWrap = !(nowrapProp && nowrapProp.value == "1");

            if (!!content) {
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
            this.initMarkdown();

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
            //console.log("MARKDOWN OUT: " + mc);
        }
        return val;
    }

    /* todo-1: This is pretty ugly because images can render extremely large, and then noticably shrink, 
    and the user can see this and it's ugly. 
    
    NOTE: I think there's a way to do this cleaner with react 'effects' hooks 
    */
    setImageMaxWidths = (): void => {
        // S.util.domSelExec([".markdown-html", "img"], (elm: HTMLElement) => {
        //     elm.style.maxWidth = "100%";
        // });

        S.util.domSelExec([".attached-img"], (elm: HTMLElement) => {
            elm.style.maxWidth = "100%";
        });
    }

    /**
     * See: https://github.com/highlightjs/highlight.js
     */
    initMarkdown = (): void => {
        if (this.markedRenderer) return;
        this.markedRenderer = new marked.Renderer();

        this.markedRenderer.code = (code, language) => {
            // Check whether the given language is valid for highlight.js.
            const validLang = !!(language && highlightjs.getLanguage(language));

            // Highlight only if the language is valid.
            const highlighted = validLang ? highlightjs.highlight(language, code).value : code;

            // Render the highlighted code with `hljs` class.
            return `<pre><code class="hljs ${language}">${highlighted}</code></pre>`;
        };

        marked.setOptions({
            renderer: this.markedRenderer,

            //This appears to be working just fine, but i don't have the CSS styles added into the distro yet
            //so none of the actual highlighting works yet, so i'm just commenting out for now, until i add classes.
            //
            //Note: using the 'markedRenderer.code' set above do we still need this highlight call here? I have no idea. Need to check/test
            highlight: function (code) {
                return highlightjs.highlightAuto(code).value;
            },

            gfm: true,
            tables: true,
            breaks: false,
            pedantic: false,
            sanitize: true,
            smartLists: true,
            smartypants: false
        });
    }

    // renderJsonFileSearchResultProperty = (jsonContent: string): string => {
    //     let content: string = "";
    //     try {
    //         console.log("json: " + jsonContent);
    //         let list: any[] = JSON.parse(jsonContent);

    //         for (let entry of list) {
    //             content += S.tag.div({
    //                 "className": "systemFile",
    //                 //"onClick": () => {meta64.editSystemFile(entry.fileName);}
    //             }, entry.fileName);

    //             /* openSystemFile worked on linux, but i'm switching to full text file edit capability only and doing that
    //             inside meta64 from now on, so openSystemFile is no longer being used */
    //             // let localOpenLink = S.tag.button({
    //             //     "raised": "raised",
    //             //     "onClick": "meta64.openSystemFile('" + entry.fileName + "')"
    //             // }, "Local Open");
    //             //
    //             // let downloadLink = "";
    //             //haven't implemented download capability yet.
    //             // S.tag.button({
    //             //     "raised": "raised",
    //             //     "onClick": "meta64.downloadSystemFile('" + entry.fileName + "')"
    //             // }, "Download")
    //             // let linksDiv = tag("div", {
    //             // }, localOpenLink + downloadLink);
    //             // content += tag("div", {
    //             // }, fileNameDiv);
    //         }
    //     }
    //     catch (e) {
    //         S.util.logAndReThrow("render failed", e);
    //         content = "[render failed]"
    //     }
    //     return content;
    // }

    /*
     * This is the primary method for rendering each node (like a row) on the main HTML page that displays node
     * content. This generates the HTML for a single row/node.
     *
     * node is a NodeInfo.java JSON
     */
    renderNodeAsListItem = (node: J.NodeInfo, index: number, count: number, rowCount: number, level: number, layoutClass: string): Comp => {

        let id: string = node.id;
        let prevPageExists: boolean = S.nav.mainOffset > 0;
        let nextPageExists: boolean = !S.nav.endReached;

        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);

        // let editingAllowed: boolean = S.props.isOwnedCommentNode(node);
        // if (!editingAllowed) {
        //     editingAllowed = S.meta64.isAdminUser && !props.isNonOwnedCommentNode(node)
        //         && !props.isNonOwnedNode(node);
        // }
        let editingAllowed = S.edit.isEditAllowed(node);
        if (typeHandler) {
            editingAllowed = editingAllowed && typeHandler.allowAction("edit");
        }
        //console.log("Rendering Node Row[" + index + "] editingAllowed=" + editingAllowed);

        /*
         * if not selected by being the new child, then we try to select based on if this node was the last one
         * clicked on for this page.
         */
        // console.log("test: [" + parentIdToFocusIdMap[currentNodeId]
        // +"]==["+ node.id + "]")
        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode();
        let selected: boolean = (focusNode && focusNode.id === id);

        let allowAvatar = node.owner != this.lastOwner;
        let buttonBar: Comp = this.makeRowButtonBar(node, editingAllowed, allowAvatar);
        //let bkgStyle: string = this.getNodeBkgImageStyle(node);
        let indentLevel = layoutClass === "node-grid-item" ? 0 : level;
        let style = indentLevel > 0 ? { marginLeft: "" + ((indentLevel - 1) * 30) + "px" } : null;
        let cssId: string = "row_" + id;

        let activeClass;
        let inactiveClass;

        if (node.id == S.meta64.currentNodeData.node.id) {
            activeClass = "active-row-main";
            inactiveClass = "inactive-row-main";
        }
        else {
            activeClass = "active-row";
            inactiveClass = "inactive-row";
        }

        return new Div(null, {
            className: layoutClass + (selected ? (" " + activeClass) : (" " + inactiveClass)),
            onClick: (elm: HTMLElement) => { S.nav.clickOnNodeRow(id); }, //
            id: cssId,
            style: style
        },
            [
                buttonBar, new Div(null, {
                    "id": id + "_content"
                }, this.renderNodeContent(node, true, true))
            ]);
    }

    showNodeUrl = (): void => {
        let node: J.NodeInfo = S.meta64.getHighlightedNode();
        if (!node) {
            S.util.showMessage("You must first click on a node.");
            return;
        }

        S.meta64.selectTab("mainTab");
        let message: string = "ID-based URL: \n" + window.location.origin + "?id=" + node.id;
        if (node.name) {
            message += "\n\nName-based URL: \n" + window.location.origin + "?n=" + node.name;
        }

        S.util.showMessage(message, true);
    }

    getTopRightImageTag = (node: J.NodeInfo): Img => {
        let topRightImg: string = S.props.getNodePropVal("img.top.right", node);
        let topRightImgTag: Img;
        if (topRightImg) {
            topRightImgTag = new Img({
                "src": topRightImg,
                className: "top-right-image"
            });
        }
        return topRightImgTag;
    }

    getNodeBkgImageStyle = (node: J.NodeInfo): string => {
        let bkgImg: string = S.props.getNodePropVal('img.node.bkg', node);
        let bkgImgStyle: string = "";
        if (bkgImg) {
            bkgImgStyle = `background-image: url(${bkgImg});`;
        }
        return bkgImgStyle;
    }

    makeRowButtonBar = (node: J.NodeInfo, editingAllowed: boolean, allowAvatar: boolean): Comp => {
        let typeIcon: Icon;
        let encIcon: Icon;
        let sharedIcon: Icon;
        let openButton: Button;
        let selButton: Checkbox;
        let createSubNodeButton: Button;
        let editNodeButton: Button;
        let moveNodeUpButton: Button;
        let moveNodeDownButton: Button;
        let insertNodeButton: Button;
        let replyButton: Button;
        let deleteNodeButton: Button;
        let pasteInsideButton: Button;
        let pasteInlineButton: Button;

        //todo-1: need to DRY up places where this code block is repeated
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        if (typeHandler) {
            let iconClass = typeHandler.getIconClass(node);
            if (iconClass) {
                typeIcon = new Icon("", null, {
                    "style": { marginRight: '6px', verticalAlign: 'middle' },
                    className: iconClass
                });
            }
        }

        if (S.props.isEncrypted(node)) {
            encIcon = new Icon("", null, {
                "style": { marginRight: '6px', verticalAlign: 'middle' },
                className: "fa fa-lock fa-lg"
            });
        }

        if (S.props.isMine(node) && S.props.isShared(node)) {
            sharedIcon = new Icon("", null, {
                "style": { marginRight: '6px', verticalAlign: 'middle' },
                className: "fa fa-share-alt fa-lg"
            });
        }

        //todo-1: rename this to sn:inlineChildren
        let isInlineChildren = !!S.props.getNodePropVal(J.NodeProp.INLINE_CHILDREN, node);

        /* Construct Open Button.
        We always enable for fs:folder, to that by clicking to open a folder that will cause the server to re-check and see if there are
        truly any files in there or not because we really cannot possibly know until we look. The only way to make this Open button
        ONLY show when there ARE truly children fore sure would be to force a check of the file system for every folder type that is ever rendered
        on a page and we don't want to burn that much CPU just to prevent empty-folders from being explored. Empty folders are rare. */
        if (!isInlineChildren && //
            (this.nodeHasChildren(node.id) || node.type == "fs:folder" || node.type == "fs:lucene" || node.type == "ipfs:node")) {

            /* convert this button to a className attribute for styles */
            openButton = new Button("Open", () => { S.nav.openNodeById(node.id, true) }, null, "btn-primary");
        }

        /*
         * If in edit mode we always at least create the potential (buttons) for a user to insert content, and if
         * they don't have privileges the server side security will let them know. In the future we can add more
         * intelligence to when to show these buttons or not.
         */
        if (S.meta64.userPreferences.editMode) {
            // console.log("Editing allowed: " + nodeId);

            let selected: boolean = S.meta64.selectedNodes[node.id] ? true : false;

            if (editingAllowed && this.allowAction(typeHandler, "edit")) {
                selButton = new Checkbox(null, selected, {
                    onChange: () => {
                        S.nav.toggleNodeSel(selButton.getChecked(), node.id)
                    },
                });
            }

            let insertAllowed = true;
            if (typeHandler) {
                insertAllowed = typeHandler.allowAction("insert");
            }

            if (C.NEW_ON_TOOLBAR && insertAllowed && S.edit.isInsertAllowed(node)) {
                createSubNodeButton = new Button("New", () => { S.edit.createSubNode(node.id, null, true); });
            }

            if (C.INS_ON_TOOLBAR) {
                insertNodeButton = new Button("Ins", () => { S.edit.insertNode(node.id); });
            }

            if (editingAllowed) {
                editNodeButton = new Button(null, () => { S.edit.runEditNode(node.id); }, {
                    "iconclass": "fa fa-edit fa-lg"
                });

                if (C.MOVE_UPDOWN_ON_TOOLBAR) {

                    if (!node.firstChild) {
                        moveNodeUpButton = new Button(null, () => { S.edit.moveNodeUp(node.id); }, {
                            "iconclass": "fa fa-arrow-up fa-lg"
                        });
                    }

                    if (!node.lastChild) {
                        moveNodeDownButton = new Button(null, () => { S.edit.moveNodeDown(node.id); }, {
                            "iconclass": "fa fa-arrow-down fa-lg"
                        });
                    }
                }

                deleteNodeButton = new Button(null, () => { S.edit.deleteSelNodes([node.id]); }, {
                    "iconclass": "fa fa-trash fa-lg"
                });

                if (!S.meta64.isAnonUser && S.edit.nodesToMove != null && (S.meta64.state.selNodeIsMine || S.meta64.state.homeNodeSelected)) {
                    pasteInsideButton = new Button("Paste Inside", () => { S.edit.pasteSelNodes('inside'); }, {
                    });
                    pasteInlineButton = new Button("Paste Inline", () => { S.edit.pasteSelNodes('inline'); }, {
                    });
                }
            }
        }

        let avatarImg: Img;
        if (allowAvatar && node.owner != J.PrincipalName.ADMIN && node.avatarBinVer) {
            avatarImg = this.makeAvatarImage(node.ownerId, node.avatarBinVer);
        }

        let buttonBar = new ButtonBar([openButton, insertNodeButton, createSubNodeButton, editNodeButton, moveNodeUpButton, //
            moveNodeDownButton, deleteNodeButton, replyButton, pasteInsideButton, pasteInlineButton], null, "marginLeft marginTop");

        if (selButton || typeIcon || encIcon || sharedIcon) {
            return new HorizontalLayout([selButton, avatarImg, typeIcon, encIcon, sharedIcon, buttonBar]);
        }
        else {
            return new HorizontalLayout([avatarImg, buttonBar]);
        }
    }

    allowAction = (typeHandler: TypeHandlerIntf, action: string): boolean => {
        return typeHandler == null || typeHandler.allowAction(action);
    }

    /*
     * Returns true if the nodeId (see makeNodeId()) NodeInfo object has 'hasChildren' true
     */
    nodeHasChildren = (id: string): boolean => {
        var node: J.NodeInfo = S.meta64.idToNodeMap[id];
        if (!node) {
            console.log("Unknown nodeId in nodeHasChildren: " + id);
            return false;
        } else {
            return node.hasChildren;
        }
    }

    /* todo-1: this function is way to large. Break out a lot of this into functions */
    renderPageFromData = async (data?: J.RenderNodeResponse, scrollToTop?: boolean, targetNodeId?: string): Promise<void> => {
        //console.log("renderPageFromData(): scrollToTop="+scrollToTop);
        this.lastOwner = null;

        let elm = S.util.domElm("mainTab");
        if (elm) {
            elm.style.visibility = "hidden";
        }
        S.meta64.setOverlay(true);

        // this timeout forces the 'hidden' to be processed and hidden from view 
        const promise = new Promise<void>(async (resolve, reject) => {
            let output: Comp[] = [];

            setTimeout(async () => {
                try {
                    //console.log("Setting lastNode="+data.node.id);
                    if (data && data.node) {
                        S.localDB.setVal(C.LOCALDB_LAST_PARENT_NODEID, data.node.id);
                        S.localDB.setVal(C.LOCALDB_LAST_CHILD_NODEID, targetNodeId);
                    }

                    let newData: boolean = false;
                    if (!data) {
                        data = S.meta64.currentNodeData;
                    } else {
                        newData = true;
                    }

                    S.nav.endReached = data && data.endReached;

                    S.util.getElm("listView", (elm: HTMLElement) => {
                        if (!data || !data.node) {
                            S.util.setElmDisplayById("listView", false);
                            let contentDiv = new Div("No content available");
                            contentDiv.updateDOM("mainNodeContent");
                        } else {
                            S.util.setElmDisplayById("listView", true);
                        }
                    });

                    if (newData) {
                        S.meta64.idToNodeMap = {};

                        /*
                         * I'm choosing to reset selected nodes when a new page loads, but this is not a requirement. I just
                         * don't have a "clear selections" feature which would be needed so user has a way to clear out.
                         */
                        S.meta64.selectedNodes = {};

                        //todo-1: Isn't this map needed forever during the app lifetime? Is it better to not blow this away here?
                        //S.meta64.parentIdToFocusNodeMap = {};

                        S.meta64.initNode(data.node, true);
                        S.meta64.setCurrentNodeData(data);
                    }

                    let propCount: number = S.meta64.currentNodeData.node.properties ? S.meta64.currentNodeData.node.properties.length : 0;

                    if (this.debug) {
                        console.log("RENDER NODE: " + data.node.id + " propCount=" + propCount);
                    }

                    //let bkgStyle: string = this.getNodeBkgImageStyle(data.node);
                    /*
                     * NOTE: mainNodeContent is the parent node of the page content, and is always the node displayed at the top
                     * of the page above all the other nodes which are its child nodes.
                     */
                    let mainNodeContent: Comp[] = this.renderNodeContent(data.node, false, true);

                    //console.log("mainNodeContent: "+mainNodeContent);

                    //todo-1: it's getting super ugly that all this code is different (replicated) from the normal rows, non-root, not sure if i 
                    //want to keep this or consolidate.
                    if (mainNodeContent.length > 0) {
                        let id: string = data.node.id;
                        let cssId: string = "row_" + id;

                        //todo-1: lots of these buttons are replicated in both the 'page root node' and 'child node' renderings
                        //and to i need to consolidate it into a component?
                        let buttonBar: ButtonBar = null;
                        let editNodeButton: Button = null;
                        let createSubNodeButton: Button = null;
                        let replyButton: Button = null;
                        let pasteInsideButton: Button = null;
                        let pasteInlineButton: Button = null;

                        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(data.node.type);
                        var insertAllowed = true;
                        if (typeHandler) {
                            insertAllowed = typeHandler.allowAction("insert");
                        }

                        if (S.meta64.userPreferences.editMode && C.NEW_ON_TOOLBAR && insertAllowed && S.edit.isInsertAllowed(data.node)) {
                            createSubNodeButton = new Button("New", () => { S.edit.createSubNode(id, null, true); });
                        }

                        var editAllowed = true;
                        if (typeHandler) {
                            editAllowed = typeHandler.allowAction("edit");
                        }

                        /* Add edit button if edit mode and this isn't the root */
                        if (editAllowed && S.edit.isEditAllowed(data.node)) {

                            /* Construct Create Subnode Button */
                            editNodeButton = new Button(null, () => { S.edit.runEditNode(id); },
                                { "iconclass": "fa fa-edit fa-lg" });
                        }

                        if (editAllowed && !S.meta64.isAnonUser && S.edit.nodesToMove != null && (S.meta64.state.selNodeIsMine || S.meta64.state.homeNodeSelected)) {
                            pasteInsideButton = new Button("Paste Inside", () => { S.edit.pasteSelNodes('inside'); }, {
                            });
                            pasteInlineButton = new Button("Paste Inline", () => { S.edit.pasteSelNodes('inline'); }, {
                            });
                        }

                        let typeIcon: Icon = null;
                        if (typeHandler) {
                            /* For now let's only show type icons when we're in edit mode */
                            if (S.meta64.userPreferences.editMode) {
                                let iconClass = typeHandler.getIconClass(data.node);
                                if (iconClass) {
                                    //todo-1: do all icons have the 'middle'? (if so embed it into class)
                                    typeIcon = new Icon("", null, {
                                        style: { marginRight: '6px', verticalAlign: 'middle' },
                                        className: iconClass
                                    });
                                }
                            }
                        }

                        let encIcon: Icon = null;
                        if (S.props.isEncrypted(data.node)) {
                            encIcon = new Icon("", null, {
                                "style": { marginRight: '6px', verticalAlign: 'middle' },
                                className: "fa fa-lock fa-lg"
                            });
                        }

                        let sharedIcon: Icon = null;
                        if (S.props.isMine(data.node) && S.props.isShared(data.node)) {
                            sharedIcon = new Icon("", null, {
                                "style": { marginRight: '6px', verticalAlign: 'middle' },
                                className: "fa fa-share-alt fa-lg"
                            });
                        }

                        /* Construct Create Subnode Button */
                        let focusNode: J.NodeInfo = S.meta64.getHighlightedNode();
                        let selected: boolean = focusNode && focusNode.id === id;
                        if (selected) {
                            console.log("selected: focusNode.uid=" + focusNode.id + " selected=" + selected);
                        }

                        let avatarImg: Img;
                        if (data.node.owner != J.PrincipalName.ADMIN && data.node.avatarBinVer) {
                            avatarImg = this.makeAvatarImage(data.node.ownerId, data.node.avatarBinVer);
                        }

                        if (typeIcon || encIcon || sharedIcon || createSubNodeButton || editNodeButton || replyButton || pasteInsideButton || pasteInlineButton) {
                            buttonBar = new ButtonBar([typeIcon, encIcon, sharedIcon, createSubNodeButton, editNodeButton, replyButton, pasteInsideButton, pasteInlineButton],
                                null, "marginLeft marginTop");
                        }

                        let children = [];
                        if (buttonBar) {
                            children.push(new HorizontalLayout([avatarImg, buttonBar]));
                        }
                        else {
                            children.push(avatarImg);
                        }
                        children = children.concat(mainNodeContent);

                        let contentDiv = new Div(null, {
                            className: (selected ? "mainNodeContentStyle active-row-main" : "mainNodeContentStyle inactive-row-main"),
                            onClick: (elm: HTMLElement) => { S.nav.clickOnNodeRow(id); },
                            id: cssId
                        }, children);

                        S.util.setElmDisplayById("mainNodeContent", true);
                        contentDiv.updateDOM("mainNodeContent");

                    } else {
                        S.util.setElmDisplayById("mainNodeContent", false);
                    }

                    if (S.nav.mainOffset > 0) {
                        let firstButton: Comp = new Button("First Page", this.firstPage,
                            {
                                id: "firstPageButton",
                                iconclass: "fa fa-angle-double-left fa-lg"
                            });
                        let prevButton: Comp = new Button("Prev Page", this.prevPage,
                            {
                                id: "prevPageButton",
                                iconclass: "fa fa-angle-left fa-lg"
                            });
                        output.push(new ButtonBar([firstButton, prevButton], "text-center marginTop"));
                    }

                    this.lastOwner = data.node.owner;
                    if (data.node.children) {
                        output.push(this.renderChildren(data.node, newData, 1));
                    }

                    if (!data.endReached) {
                        let nextButton = new Button("Next Page", this.nextPage,
                            {
                                id: "nextPageButton",
                                iconclass: "fa fa-angle-right fa-lg"
                            });

                        //todo-1: last page button disabled pending refactoring
                        //let lastButton = this.makeButton("Last Page", "lastPageButton", this.lastPage);
                        output.push(new ButtonBar([nextButton], "text-center marginTop"));
                    }
                }
                catch (err) {
                    console.error("render fail.");
                    resolve();
                    return;
                }

                //console.log("rendering output=: " + S.util.toJson(output));
                S.util.getElm("listView", async (elm: HTMLElement) => {
                    try {
                        //console.log("listView found.");
                        let outputDiv = new Div(null, null, output);
                        outputDiv.updateDOM("listView");
                        S.meta64.selectTab("mainTab");

                        S.util.forEachElmBySel("a", (el, i) => {
                            el.setAttribute("target", "_blank");
                        });

                        if (S.meta64.pendingLocationHash) {
                            window.location.hash = S.meta64.pendingLocationHash;
                            //Note: the substring(1) trims the "#" character off.
                            await S.meta64.highlightRowById(S.meta64.pendingLocationHash.substring(1), true);
                            S.meta64.pendingLocationHash = null;
                        }
                        else if (targetNodeId) {
                            await S.meta64.highlightRowById(targetNodeId, true);
                        } //
                        else if (scrollToTop || !S.meta64.getHighlightedNode()) {
                            await S.view.scrollToTop();
                        } //
                        else {
                            await S.view.scrollToSelectedNode();
                        }
                    }
                    finally {
                        resolve();
                    }
                });
            }, 100);
        });

        promise.then(() => {
            let elm = S.util.domElm("mainTab");
            if (elm) {
                elm.style.visibility = "visible";
            }
            S.meta64.setOverlay(false);
            S.meta64.refreshAllGuiEnablement();
        });

        return promise;
    }

    private renderChildren = (node: J.NodeInfo, newData: boolean, level: number): Comp => {
        if (!node || !node.children) return null;

        let childCount: number = node.children.length;
        // console.log("childCount: " + childCount);
        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on
         * the client side for various reasons.
         */

        let layout = S.props.getNodePropVal(J.NodeProp.LAYOUT, node);
        if (!layout || layout == "v") {
            return this.renderVerticalLayout(node, newData, level);
        }
        else if (layout.indexOf("c") == 0) {
            return this.renderTableLayout(node, newData, level, layout);
        }
        else {
            throw new Error("Invalid layout");
        }
    }

    updateHighlightNode = (node: J.NodeInfo) => {
        if (!node || !S.meta64.state.highlightNode) {
            return;
        }

        if (S.meta64.state.highlightNode.id == node.id) {
            S.meta64.state.highlightNode = node;

            if (S.meta64.currentNodeData && S.meta64.currentNodeData.node) {
                S.meta64.parentIdToFocusNodeMap[S.meta64.currentNodeData.node.id] = node;
            }
        }
    }

    //todo-2: check background colord on vertical layout option also? or is that handled already?
    renderTableLayout = (node: J.NodeInfo, newData: boolean, level: number, layout: string): Comp => {
        let tableDiv = new Div(null, { style: { display: 'table', className: 'node-grid', width: '100%' } });
        let curRow = new Div(null, { style: { display: 'table-row', className: 'node-grid-cell' } });

        let layoutClass = "node-grid-item";
        let childCount: number = node.children.length;
        let rowCount: number = 0;
        let maxCols = 2;
        if (layout == "c2") {
            maxCols = 2;
        }
        if (layout == "c3") {
            maxCols = 3;
        }
        if (layout == "c4") {
            maxCols = 4;
        }
        let cellWidth = 100 / maxCols;

        let curCols = 0;
        for (let i = 0; i < node.children.length; i++) {
            let comps: Comp[] = [];
            let n: J.NodeInfo = node.children[i];

            if (!S.edit.nodesToMoveSet[n.id]) {
                this.updateHighlightNode(n);

                let row: Comp = this.generateRow(i, n, newData, childCount, rowCount, level, layoutClass);
                if (row) {
                    comps.push(row);
                    rowCount++;
                }
                this.lastOwner = n.owner;

                if (n.children) {
                    comps.push(this.renderChildren(n, newData, level + 1));
                }

                let curCol = new Div(null, {
                    className: 'node-grid-cell',
                    style: { display: 'table-cell', width: cellWidth + '%' }
                }, comps);
                curRow.children.push(curCol);

                if (++curCols == maxCols) {
                    tableDiv.children.push(curRow);
                    curRow = new Div(null, { style: { display: 'table-row' } });
                    curCols = 0;
                }
            }
        }

        //the last row might not have filled up yet but add it still
        if (curCols > 0) {
            tableDiv.children.push(curRow);
        }

        return tableDiv;
    }

    renderVerticalLayout = (node: J.NodeInfo, newData: boolean, level: number): Comp => {
        let layoutClass = "node-table-row";
        let childCount: number = node.children.length;
        let rowCount: number = 0;

        let comps: Comp[] = [];
        for (let i = 0; i < node.children.length; i++) {
            let n: J.NodeInfo = node.children[i];
            if (!S.edit.nodesToMoveSet[n.id]) {
                this.updateHighlightNode(n);

                let row: Comp = this.generateRow(i, n, newData, childCount, rowCount, level, layoutClass);
                if (row) {
                    comps.push(row);
                    rowCount++;
                }

                if (n.children) {
                    comps.push(this.renderChildren(n, newData, level + 1));
                }
            }
            this.lastOwner = n.owner;
        }
        return new Div(null, null, comps);
    }

    firstPage = (): void => {
        S.view.firstPage();
    }

    prevPage = (): void => {
        S.view.prevPage();
    }

    nextPage = (): void => {
        S.view.nextPage();
    }

    lastPage = (): void => {
        S.view.lastPage();
    }

    generateRow = (i: number, node: J.NodeInfo, newData: boolean, childCount: number, rowCount: number, level: number, layoutClass: string): Comp => {
        if (newData) {
            S.meta64.initNode(node, true);

            if (this.debug) {
                console.log(" RENDER ROW[" + i + "]: node.id=" + node.id);
            }
        }

        rowCount++; // warning: this is the local variable/parameter
        let row: Comp = this.renderNodeAsListItem(node, i, childCount, rowCount, level, layoutClass);
        // console.log("row[" + rowCount + "]=" + row);
        return row;
    }

    getUrlForNodeAttachment = (node: J.NodeInfo): string => {
        //todo-1: Change to node.id and then re-test this
        return S.util.getRpcPath() + "bin/f" + "-" + node.id + "-" + node.binVer + "?nodeId=" + encodeURIComponent(node.id) + "&ver=" + node.binVer;
    }

    getStreamUrlForNodeAttachment = (node: J.NodeInfo): string => {
        //todo-1: Change to node.id and then re-test this
        //do I need the versioning args here? or does the protocol time values take care of it?
        return S.util.getRpcPath() + "stream/" +node.id /* + "-" + node.binVer + "?nodeId=" + encodeURIComponent(node.id) */ + "?x=1&ver=" + node.binVer;
    }

    getAvatarImgUrl = (ownerId: string, binVer: number): string => {
        return S.util.getRpcPath() + "bin/avatar" + "-" + ownerId + "-" + binVer + "?nodeId=" + encodeURIComponent(ownerId) + "&ver=" + binVer;
    }

    makeImageTag = (node: J.NodeInfo): Img => {
        let src: string = this.getUrlForNodeAttachment(node);

        //NOTE: This property not working yet becasue we style img tags dynamically after created.
        let maxWidth: string = S.props.getNodePropVal(C.ATT_MAX_WIDTH, node);
        if (!maxWidth) {
            maxWidth = "100%";
        }

        //Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        let img: Img = new Img({
            "src": src,
            className: "attached-img",
            style: {
                maxWidth: maxWidth,
                cursor: "pointer",
                marginLeft: "20px",
                marginBottom: "15px",
                paddingRight: "20px"
            },
            "title": "Click image to enlarge/reduce"
        });

        img.whenElm((elm: HTMLElement) => {
            elm.addEventListener("click", () => {
                if (elm.style.maxWidth == "100%") {
                    elm.style.maxWidth = "";
                }
                else {
                    elm.style.maxWidth = "100%";
                }
            });
        });

        return img;
    }

    makeAvatarImage = (nodeId: string, binVer: number): Img => {
        let src: string = this.getAvatarImgUrl(nodeId, binVer);

        //Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        let img: Img = new Img({
            src: src,
            className: "avatarImage",
            title: "Click image to enlarge/reduce"
        });

        img.whenElm((elm: HTMLElement) => {
            elm.addEventListener("click", () => {
                if (elm.style.maxWidth == "100%") {
                    elm.style.maxWidth = "80px";
                }
                else {
                    elm.style.maxWidth = "100%";
                }
            });
        });

        return img;
    }

    allowPropertyToDisplay = (propName: string): boolean => {
        //if (S.meta64.isAdminUser) return true;
        if (propName.startsWith("sn:")) return false;

        let allow = !S.meta64.simpleModePropertyBlackList[propName];
        console.log("Allow Prop " + propName + " = " + allow);
        return allow;
    }

    /* Returns true of the logged in user and the type of node allow the property to be edited by the user */
    allowPropertyEdit = (node: J.NodeInfo, propName: string): boolean => {
        let typeHandler: TypeHandlerIntf = S.plugin.getTypeHandler(node.type);
        if (typeHandler) {
            return typeHandler.allowPropertyEdit(propName);
        }
        else {
            return this.allowPropertyToDisplay(propName);
        }
    }

    isReadOnlyProperty = (propName: string): boolean => {
        return S.meta64.readOnlyPropertyList[propName];
    }

    isBinaryProperty = (propName: string): boolean => {
        return S.meta64.binaryPropertyList[propName];
    }
}


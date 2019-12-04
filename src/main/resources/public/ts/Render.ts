console.log("Render.ts");

import * as I from "./Interfaces";
import { Comp } from "./widget/base/Comp";
import { Button } from "./widget/Button";
import { ButtonBar } from "./widget/ButtonBar";
import { Checkbox } from "./widget/Checkbox";
import { Div } from "./widget/Div";
import { Span } from "./widget/Span";
import { Img } from "./widget/Img";
import { Anchor } from "./widget/Anchor";
import { Heading } from "./widget/Heading";
import { Constants as cnst } from "./Constants";
import { RenderIntf } from "./intf/RenderIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants } from "./Constants";
import * as marked from 'marked';
import * as highlightjs from 'highlightjs';
import { Icon } from "./widget/Icon";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

declare var prettyPrint;

export class Render implements RenderIntf {

    private PRETTY_TAGS: boolean = true;
    private debug: boolean = false;
    private markedRenderer = null;

    private renderBinary = (node: I.NodeInfo): Comp => {
        /*
         * If this is an image render the image directly onto the page as a visible image
         */
        if (node.binaryIsImage) {
            return this.makeImageTag(node);
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

    buildRowHeader = (node: I.NodeInfo, showPath: boolean, showName: boolean): Div => {
        let commentBy: string = S.props.getNodePropertyVal(cnst.COMMENT_BY, node);
        let pathDiv: Div = null;
        let commentSpan: Span = null;
        let createdBySpan: Span = null;
        let ownerDisplaySpan: Span = null;
        let lastModifiedSpan: Span = null;

        if (cnst.SHOW_PATH_ON_ROWS) {
            let ordinalStr = node.logicalOrdinal != -1 ? " [" + node.logicalOrdinal + "] " : " ";
            pathDiv = new Div(node.path + ordinalStr + node.type, {
                className: "path-display"
            });
        }

        if (commentBy) {
            let clazz: string = (commentBy === S.meta64.userName) ? "created-by-me" : "created-by-other";
            commentSpan = new Span("Comment By: " + commentBy, {
                className: clazz
            });
        } //
        else if (node.owner) {
            let clazz: string = (node.owner === S.meta64.userName) ? "created-by-me" : "created-by-other";
            createdBySpan = new Span("Created By: " + node.owner, {
                className: clazz
            });
        }

        ownerDisplaySpan = new Span("");
        S.meta64.setNodeData(node.uid, { "ownerDisplaySpan": ownerDisplaySpan });

        if (node.lastModified) {
            let lastModStr = S.util.formatDate(new Date(node.lastModified));
            lastModifiedSpan = new Span(`  Mod: ${lastModStr}`);
        }

        let allSpansDiv = new Div(null, null, [commentSpan, createdBySpan, ownerDisplaySpan, lastModifiedSpan]);

        let nodeNameSpan: Span = null;
        /*
         * on root node name will be empty string so don't show that
         *
         * commenting: I decided users will understand the path as a single long entity with less confusion than
         * breaking out the name for them. They already unserstand internet URLs. This is the same concept. No need
         * to baby them.
         *
         * The !showPath condition here is because if we are showing the path then the end of that is always the
         * name, so we don't need to show the path AND the name. One is a substring of the other.
         */
        let nodeName = S.util.getNodeName(node);
        if (showName && !showPath && nodeName) {
            nodeNameSpan = new Span(`Name: ${nodeName} [uid=${node.uid}]`);
        }

        let children = [];
        if (S.meta64.showPath) {
            children.push(pathDiv);
        }
        if (S.meta64.showMetaData) {
            children.push(allSpansDiv, nodeNameSpan);
        }

        return new Div(null, {
            className: "header-text"
        }, children);
    }

    injectSubstitutions = (content: string): string => {
        return S.util.replaceAll(content, "{{locationOrigin}}", window.location.origin);
    }

    /*
     * This is the function that renders each node in the main window. The rendering in here is very central to the
     * app and is what the user sees covering 90% of the screen most of the time. The *content* nodes.
     */
    renderNodeContent = (node: I.NodeInfo, showPath, showName, renderBin, rowStyling, showHeader): Comp[] => {
        //todo-3; bring back top right image support. disabling for now to simplify refactoring
        //let topRightImgTag = null; //this.getTopRightImageTag(node);
        //let ret: string = topRightImgTag ? topRightImgTag.render_Html() : "";

        let ret: Comp[] = [];
        let typeHandler: TypeHandlerIntf = S.meta64.typeHandlers[node.type];

        /* todo-2: enable headerText when appropriate here */
        if (S.meta64.showMetaData || S.meta64.showPath) {
            if (showHeader) {
                ret.push(this.buildRowHeader(node, showPath, showName));
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
            if (!renderComplete && typeHandler) {
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
                if (node.path.trim() == "/") {
                    ret.push(new Heading(1, "Root Node"));
                }
                /* ret += "< div>[No Content Property]</div>"; */
                let properties = S.props.renderProperties(node.properties);
                if (properties) {
                    ret.push(properties);
                }
            }
        }

        if (renderBin && node.hasBinary) {
            let binary = this.renderBinary(node);

            /*
             * We append the binary image or resource link either at the end of the text or at the location where
             * the user has put {{insert-attachment}} if they are using that to make the image appear in a specific
             * locatio in the content text.
             *
             * NOTE: temporarily removing during refactoring into Widgets.
             */
            // if (util.contains(ret, cnst.INSERT_ATTACHMENT)) {
            //     ret = S.util.replaceAll(ret, cnst.INSERT_ATTACHMENT, binary.render());
            // } else {
            ret.push(binary);
            //}
        }
        let tags: string = S.props.getNodePropertyVal(cnst.TAGS, node);
        if (tags) {
            ret.push(new Div("Tags: " + tags, {
                className: "tags-content"
            }));
        }

        return ret;
    }

    /* Renders 'content' property as markdown */
    renderMarkdown = (rowStyling: boolean, node: I.NodeInfo, retState: any): Comp => {
        let div = null;
        let content = node.content || "";

        //console.log("contentProp: " + contentProp);
        retState.renderComplete = true;

        //console.log("MARKDOWN IN:\n"+jcrContent);

        let clazz = rowStyling ? "jcr-content" : "jcr-root-content";
        let val = "";

        // Special case of a PRE-formatted node, we inject backticks to make it render all the content as preformatted markdown */
        let preProp: I.PropertyInfo = S.props.getNodeProperty(cnst.PRE, node);
        if (preProp && preProp.value == "1") {

            let wrapProp: I.PropertyInfo = S.props.getNodeProperty(cnst.WRAP, node);
            let wordWrap = wrapProp && wrapProp.value == "1";

            if (!!content) {

                // todo-0: continue here. Took break from this to get new repository setup.
                // if (content.startsWith(cnst.ENC_TAG)) {
                //     let clearText = S.encryption.symDecryptString(null, content);
                //     if (clearText) {
                //         content 
                //     }  
                // }

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

            // Do the actual markdown rendering here.
            val = marked(content);

            // the marked adds a 'p tag' wrapping we don't need so we remove it just to speed up DOM as much as possible
            val = val.trim();
            val = S.util.stripIfStartsWith(val, "<p>");
            val = S.util.stripIfEndsWith(val, "</p>");
            //console.log("MARKDOWN OUT: " + mc);
        }

        //When doing server-side markdown we had this processing the HTML that was generated
        //but I haven't looked into how to get this back now that we are doing markdown on client.
        //jcrContent = injectSubstitutions(jcrContent);

        // NOTE: markdown-html doesn't apply any actual styling but instead is used in a JS dom lookup to find all the 
        // images under each markdown element to apply a styling update post-render.
        div = new Div(val, {
            className: clazz + " markdown-html",
        });
        div.renderRawHtml = true;

        //We always alter all 'img' tags that may have been generated by the markdown engine, to make sure they have
        //the correct style we want, which is the 100% display across the 'document' area (not full browser, but the full 
        //width across the same area the text is rendered inside). 
        div.whenElm(() => {
            this.setImageMaxWidths();
        });

        return div;
    }

    /* todo-1: This is pretty ugly because images can render extremely large, and then noticably shrink, 
    and the user can see this and it's ugly. */
    setImageMaxWidths = (): void => {
        S.util.domSelExec([".markdown-html", "img"], (elm: HTMLElement) => {
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
    renderNodeAsListItem = (node: I.NodeInfo, index: number, count: number, rowCount: number, level: number, layoutClass: string): Comp => {

        let uid: string = node.uid;
        let prevPageExists: boolean = S.nav.mainOffset > 0;
        let nextPageExists: boolean = !S.nav.endReached;
        let canMoveUp: boolean = (index > 0 && rowCount > 1) || prevPageExists;
        let canMoveDown: boolean = (index < count - 1) || nextPageExists;

        let typeHandler: TypeHandlerIntf = S.meta64.typeHandlers[node.type];
        if (typeHandler) {
            canMoveUp = typeHandler.allowAction("moveUp");
            canMoveDown = typeHandler.allowAction("moveDown");
        }

        // let editingAllowed: boolean = S.props.isOwnedCommentNode(node);
        // if (!editingAllowed) {
        //     editingAllowed = S.meta64.isAdminUser && !props.isNonOwnedCommentNode(node)
        //         && !props.isNonOwnedNode(node);
        // }
        let editingAllowed = S.edit.isEditAllowed(node); //meta64.userPreferences.editMode && S.meta64.isAdminUser || S.meta64.userName==node.owner;
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
        let focusNode: I.NodeInfo = S.meta64.getHighlightedNode();
        let selected: boolean = (focusNode && focusNode.uid === uid);

        let buttonBar: ButtonBar = this.makeRowButtonBar(node, canMoveUp, canMoveDown, editingAllowed);
        //let bkgStyle: string = this.getNodeBkgImageStyle(node);
        let indentLevel = layoutClass === "node-grid-item" ? 0 : level;
        let style = indentLevel > 0 ? { marginLeft: "" + ((indentLevel - 1) * 30) + "px" } : null;
        let cssId: string = "row_" + uid;

        let activeClass = "active-row";
        let inactiveClass = "inactive-row";

        return new Div(null, {
            className: layoutClass + (selected ? (" " + activeClass) : (" " + inactiveClass)),
            "onClick": (elm) => { S.meta64.clickOnNodeRow(uid); }, //
            "id": cssId,
            "style": style
        },
            [
                buttonBar, new Div(null, {
                    "id": uid + "_content"
                }, this.renderNodeContent(node, true, true, true, true, true))
            ]);
    }

    showNodeUrl = (): void => {
        let node: I.NodeInfo = S.meta64.getHighlightedNode();
        if (!node) {
            S.util.showMessage("You must first click on a node.");
            return;
        }

        // should include in this message if the node is shared or not, or at least a button to open sharing dialog, or even just
        // make the dialog using this open the sharing dialog instead?
        let url: string = window.location.origin + "?id=" + node.path;
        S.meta64.selectTab("mainTab");
        let message: string = "Full Path URL:\n" + url + "\n\n" +
            "Short URL: \n" + window.location.origin + "?id=" + node.id;

        S.util.showMessage(message, true);
    }

    getTopRightImageTag = (node: I.NodeInfo): Img => {
        let topRightImg: string = S.props.getNodePropertyVal("img.top.right", node);
        let topRightImgTag: Img;
        if (topRightImg) {
            topRightImgTag = new Img({
                "src": topRightImg,
                className: "top-right-image"
            });
        }
        return topRightImgTag;
    }

    getNodeBkgImageStyle = (node: I.NodeInfo): string => {
        let bkgImg: string = S.props.getNodePropertyVal('img.node.bkg', node);
        let bkgImgStyle: string = "";
        if (bkgImg) {
            bkgImgStyle = `background-image: url(${bkgImg});`;
        }
        return bkgImgStyle;
    }

    centeredButtonBar = (buttons: Comp[], classes?: string): Comp => {
        classes = classes || "";

        return new Div(null, {
            className: "horizontal center-justified layout vertical-layout-row " + classes
        }, buttons);
    }

    makeRowButtonBar = (node: I.NodeInfo, canMoveUp: boolean, canMoveDown: boolean, editingAllowed: boolean): ButtonBar => {

        let createdBy: string = node.owner;
        let commentBy: string = S.props.getNodePropertyVal(cnst.COMMENT_BY, node);
        let publicAppend: string = S.props.getNodePropertyVal(cnst.PUBLIC_APPEND, node);

        let typeIcon: Icon;
        let openButton: Button;
        let selButton: Checkbox;
        let createSubNodeButton: Button;
        let editNodeButton: Button;
        let moveNodeUpButton: Button;
        let moveNodeDownButton: Button;
        let insertNodeButton: Button;
        let replyButton: Button;
        let deleteNodeButton: Button;

        /*
         * Show Reply button if this is a publicly appendable node and not created by current user,
         * or having been added as comment by current user
         */
        if (publicAppend && createdBy != S.meta64.userName && commentBy != S.meta64.userName) {
            replyButton = new Button("Reply", () => { S.meta64.replyToComment(node.uid); });
        }

        let typeHandler: TypeHandlerIntf = S.meta64.typeHandlers[node.type];
        if (typeHandler) {
            /* For now let's only show type icons when we're in edit mode */
            if (S.meta64.userPreferences.editMode) {
                let iconClass = typeHandler.getIconClass(node);
                if (iconClass) {
                    typeIcon = new Icon("", null, {
                        "style": { margin: '8px', verticalAlign: 'middle' },
                        className: iconClass
                    });
                }
            }
        }

        let isInlineChildren = !!S.props.getNodePropertyVal("inlineChildren", node);

        /* Construct Open Button.
        We always enable for fs:folder, to that by clicking to open a folder that will cause the server to re-check and see if there are
        truly any files in there or not because we really cannot possibly know until we look. The only way to make this Open button
        ONLY show when there ARE truly children fore sure would be to force a check of the file system for every folder type that is ever rendered
        on a page and we don't want to burn that much CPU just to prevent empty-folders from being explored. Empty folders are rare. */
        if (!isInlineChildren && //
            (this.nodeHasChildren(node.uid) || node.type == "fs:folder" || node.type == "fs:lucene" || node.type == "ipfs:node")) {
            /* For some unknown reason the ability to style this with a class broke isn't working, so i used a 'style' attibute
                 as a last resort */
            openButton = new Button("Open", () => { S.nav.openNode(node.uid, true) }, {
                "style": {
                    backgroundColor: "#4caf50",
                    color: "white"
                }
            });
        }

        /*
         * If in edit mode we always at least create the potential (buttons) for a user to insert content, and if
         * they don't have privileges the server side security will let them know. In the future we can add more
         * intelligence to when to show these buttons or not.
         */
        if (S.meta64.userPreferences.editMode) {
            // console.log("Editing allowed: " + nodeId);

            let selected: boolean = S.meta64.selectedNodes[node.uid] ? true : false;

            if (editingAllowed && this.allowAction(typeHandler, "edit")) {
                selButton = new Checkbox(null, selected, {
                    style: { marginTop: '0px', marginLeft: '0px' },
                    onChange: () => {
                        S.nav.toggleNodeSel(selButton.getChecked(), node.uid)
                    },
                });
            }

            let insertAllowed = true;
            if (typeHandler) {
                insertAllowed = typeHandler.allowAction("insert");
            }

            if (cnst.NEW_ON_TOOLBAR && !commentBy && !S.meta64.isAnonUser && insertAllowed && S.edit.isInsertAllowed(node)) {
                /* Construct Create Subnode Button */
                createSubNodeButton = new Button("New", () => { S.meta64.createSubNode(node.uid, null, true); }, {
                    //"icon": "icons:picture-in-picture-alt", //"icons:more-vert",
                });
            }

            if (cnst.INS_ON_TOOLBAR && !commentBy) {
                /* Construct Create Subnode Button */
                insertNodeButton = new Button("Ins", () => { S.meta64.insertNode(node.uid); }, {
                    //"icon": "icons:picture-in-picture" //"icons:more-horiz",
                });
            }

            if (editingAllowed) {
                /* Construct Create Subnode Button */
                editNodeButton = new Button(null, () => { S.meta64.runEditNode(node.uid); }, {
                    "iconclass": "fa fa-edit fa-lg"
                });

                if (cnst.MOVE_UPDOWN_ON_TOOLBAR && !commentBy) {

                    if (canMoveUp) {
                        /* Construct Create Subnode Button */
                        moveNodeUpButton = new Button(null, () => { S.meta64.moveNodeUp(node.uid); }, {
                            "iconclass": "fa fa-arrow-up fa-lg"
                        });
                    }

                    if (canMoveDown) {
                        /* Construct Create Subnode Button */
                        moveNodeDownButton = new Button(null, () => { S.meta64.moveNodeDown(node.uid); }, {
                            "iconclass": "fa fa-arrow-down fa-lg"
                        });
                    }
                }

                deleteNodeButton = new Button(null, () => { S.edit.deleteSelNodes([node.id]); }, {
                    "iconclass": "fa fa-trash fa-lg"
                });
            }
        }

        return new ButtonBar([selButton, typeIcon, openButton, insertNodeButton, createSubNodeButton, editNodeButton, moveNodeUpButton, moveNodeDownButton, deleteNodeButton, replyButton],
            "left-justified");
    }

    allowAction = (typeHandler: TypeHandlerIntf, action: string): boolean => {
        return typeHandler == null || typeHandler.allowAction(action);
    }

    makeHorizontalFieldSet = (content: Comp[], extraClasses?: string): Comp => {
        /* Now build entire control bar */
        return new Div(null, //
            {
                className: "horizontal layout" + (extraClasses ? (" " + extraClasses) : "")
            }, content);
    }

    /*
     * Returns true if the nodeId (see makeNodeId()) NodeInfo object has 'hasChildren' true
     */
    nodeHasChildren = (uid: string): boolean => {
        var node: I.NodeInfo = S.meta64.uidToNodeMap[uid];
        if (!node) {
            console.log("Unknown nodeId in nodeHasChildren: " + uid);
            return false;
        } else {
            return node.hasChildren;
        }
    }

    renderPageFromData = async (data?: I.RenderNodeResponse, scrollToTop?: boolean, targetNodeId?: string): Promise<void> => {

        S.meta64.codeFormatDirty = false;
        console.log("renderPageFromData()");

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
                        localStorage.setItem("lastNode", data.node.id);
                    }

                    let newData: boolean = false;
                    if (!data) {
                        data = S.meta64.currentNodeData;
                    } else {
                        newData = true;
                    }

                    S.nav.endReached = data && data.endReached;

                    S.domBind.whenElm("listView", (elm) => {
                        if (!data || !data.node) {
                            S.util.setElmDisplayById("listView", false);
                            let contentDiv = new Div("No content available");
                            contentDiv.reactRenderToDOM("mainNodeContent");
                        } else {
                            S.util.setElmDisplayById("listView", true);
                        }
                    });

                    S.meta64.treeDirty = false;

                    if (newData) {
                        S.meta64.uidToNodeMap = {};
                        S.meta64.idToNodeMap = {};
                        S.meta64.identToUidMap = {};

                        /*
                         * I'm choosing to reset selected nodes when a new page loads, but this is not a requirement. I just
                         * don't have a "clear selections" feature which would be needed so user has a way to clear out.
                         */
                        S.meta64.selectedNodes = {};
                        S.meta64.parentUidToFocusNodeMap = {};

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
                    let mainNodeContent: Comp[] = this.renderNodeContent(data.node, true, true, true, false, true);

                    //console.log("mainNodeContent: "+mainNodeContent);

                    if (mainNodeContent.length > 0) {
                        let uid: string = data.node.uid;
                        let cssId: string = "row_" + uid;

                        let buttonBar: ButtonBar = null;
                        let editNodeButton: Button = null;
                        let createSubNodeButton: Button = null;
                        let replyButton: Button = null;

                        // console.log("data.node.path="+data.node.path);
                        // console.log("isNonOwnedCommentNode="+props.isNonOwnedCommentNode(data.node));
                        // console.log("isNonOwnedNode="+props.isNonOwnedNode(data.node));

                        let createdBy: string = data.node.owner;
                        let commentBy: string = S.props.getNodePropertyVal(cnst.COMMENT_BY, data.node);
                        let publicAppend: string = S.props.getNodePropertyVal(cnst.PUBLIC_APPEND, data.node);

                        /*
                         * Show Reply button if this is a publicly appendable node and not created by current user,
                         * or having been added as comment by current user
                         */

                        if (publicAppend && createdBy != S.meta64.userName && commentBy != S.meta64.userName) {
                            replyButton = new Button("Reply", () => { S.meta64.replyToComment(data.node.uid); });
                        }

                        let typeHandler: TypeHandlerIntf = S.meta64.typeHandlers[data.node.type];
                        var insertAllowed = true;
                        if (typeHandler) {
                            insertAllowed = typeHandler.allowAction("insert");
                        }

                        if (S.meta64.userPreferences.editMode && cnst.NEW_ON_TOOLBAR && !S.meta64.isAnonUser && insertAllowed && S.edit.isInsertAllowed(data.node)) {
                            createSubNodeButton = new Button("New", () => { S.meta64.createSubNode(uid, null, true); });
                        }

                        var editAllowed = true;
                        if (typeHandler) {
                            editAllowed = typeHandler.allowAction("edit");
                        }

                        /* Add edit button if edit mode and this isn't the root */
                        if (editAllowed && S.edit.isEditAllowed(data.node)) {

                            /* Construct Create Subnode Button */
                            editNodeButton = new Button(null, () => { S.meta64.runEditNode(uid); },
                                { "iconclass": "fa fa-edit fa-lg" });
                        }

                        let typeIcon = null;
                        if (typeHandler) {
                            /* For now let's only show type icons when we're in edit mode */
                            if (S.meta64.userPreferences.editMode) {
                                let iconClass = typeHandler.getIconClass(data.node);
                                if (iconClass) {
                                    typeIcon = new Icon("", null, {
                                        style: { margin: '8px', verticalAlign: 'middle' },
                                        className: iconClass
                                    });
                                }
                            }
                        }

                        /* Construct Create Subnode Button */
                        let focusNode: I.NodeInfo = S.meta64.getHighlightedNode();
                        let selected: boolean = focusNode && focusNode.uid === uid;
                        if (selected) {
                            console.log("selected: focusNode.uid=" + focusNode.uid + " selected=" + selected);
                        }

                        if (typeIcon || createSubNodeButton || editNodeButton || replyButton) {
                            buttonBar = new ButtonBar([typeIcon, createSubNodeButton, editNodeButton, replyButton],
                                "left-justified");
                        }

                        let children = [];
                        if (buttonBar) {
                            children.push(buttonBar);
                        }
                        children = children.concat(mainNodeContent);

                        let contentDiv = new Div(null, {
                            className: (selected ? "mainNodeContentStyle active-row" : "mainNodeContentStyle inactive-row"),
                            onClick: (elm) => { S.meta64.clickOnNodeRow(uid); },
                            id: cssId
                        },//
                            children);

                        S.util.setElmDisplayById("mainNodeContent", true);
                        contentDiv.reactRenderToDOM("mainNodeContent");

                    } else {
                        S.util.setElmDisplayById("mainNodeContent", false);
                    }

                    // $('[href="#main"]').click(function (e) {
                    //     e.preventDefault()
                    //     $(this).tab('show')
                    // })

                    // $('[href="#main"]').tab('show');

                    console.log("update status bar.");
                    S.view.updateStatusBar();

                    if (S.nav.mainOffset > 0) {
                        let firstButton: Comp = new Button("First Page", this.firstPage,
                            {
                                id: "firstPageButton",
                                iconclass: "fa fa-eject fa-lg"
                            });
                        let prevButton: Comp = new Button("Prev Page", this.prevPage,
                            {
                                id: "prevPageButton",
                                iconclass: "fa fa-chevron-left fa-lg"
                            });
                        output.push(this.centeredButtonBar([firstButton, prevButton], "paging-button-bar"));
                    }

                    if (data.node.children) {
                        output.push(this.renderChildren(data.node, newData, 1));
                    }

                    // if (S.edit.isInsertAllowed(data.node)) {
                    //     if (output.length == 0 && !S.meta64.isAnonUser) {
                    //         output.push(new Div("End of content. Use 'Menu->Edit->Create' to add a node.", {
                    //             style: { margin: "15px" }
                    //         }));
                    //     }
                    // }

                    if (!data.endReached) {
                        let nextButton = new Button("Next Page", this.nextPage,
                            {
                                id: "nextPageButton",
                                iconclass: "fa fa-chevron-right fa-lg"
                            });

                        //todo-1: last page button disabled pending refactoring
                        //let lastButton = this.makeButton("Last Page", "lastPageButton", this.lastPage);
                        output.push(this.centeredButtonBar([nextButton] /* + lastButton */, "paging-button-bar"));
                    }
                }
                catch (err) {
                    console.error("render fail.");
                    resolve();
                    return;
                }

                //console.log("rendering output=: " + S.util.toJson(output));
                S.domBind.whenElm("listView", async (elm) => {
                    try {
                        console.log("listView found.");
                        let outputDiv = new Div(null, null, output);
                        outputDiv.reactRenderToDOM("listView");
                        S.meta64.selectTab("mainTab");

                        if (S.meta64.codeFormatDirty) {
                            prettyPrint();
                        }

                        S.util.forEachElmBySel("a", (el, i) => {
                            el.setAttribute("target", "_blank");
                        });

                        if (targetNodeId) {
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

    private renderChildren = (node: I.NodeInfo, newData: boolean, level: number): Comp => {
        if (!node || !node.children) return null;

        let childCount: number = node.children.length;
        // console.log("childCount: " + childCount);
        /*
         * Number of rows that have actually made it onto the page to far. Note: some nodes get filtered out on
         * the client side for various reasons.
         */

        let layout = S.props.getNodePropertyVal("layout", node);
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

    //todo-2: check background colord on vertical layout option also? or is that handled already?
    renderTableLayout = (node: I.NodeInfo, newData: boolean, level: number, layout: string): Comp => {
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
            let n: I.NodeInfo = node.children[i];

            if (!S.edit.nodesToMoveSet[n.id]) {
                let row: Comp = this.generateRow(i, n, newData, childCount, rowCount, level, layoutClass);
                if (row) {
                    comps.push(row);
                    rowCount++;
                }

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

    renderVerticalLayout = (node: I.NodeInfo, newData: boolean, level: number): Comp => {
        let layoutClass = "node-table-row";
        let childCount: number = node.children.length;
        let rowCount: number = 0;

        let comps: Comp[] = [];
        for (let i = 0; i < node.children.length; i++) {
            let n: I.NodeInfo = node.children[i];
            if (!S.edit.nodesToMoveSet[n.id]) {
                let row: Comp = this.generateRow(i, n, newData, childCount, rowCount, level, layoutClass);
                if (row) {
                    comps.push(row);
                    rowCount++;
                }

                if (n.children) {
                    comps.push(this.renderChildren(n, newData, level + 1));
                }
            }
        }
        return new Div(null, null, comps);
    }

    firstPage = (): void => {
        console.log("First page button click.");
        S.view.firstPage();
    }

    prevPage = (): void => {
        console.log("Prev page button click.");
        S.view.prevPage();
    }

    nextPage = (): void => {
        console.log("Next page button click.");
        S.view.nextPage();
    }

    lastPage = (): void => {
        console.log("Last page button click.");
        S.view.lastPage();
    }

    generateRow = (i: number, node: I.NodeInfo, newData: boolean, childCount: number, rowCount: number, level: number, layoutClass: string): Comp => {
        if (S.meta64.isNodeBlackListed(node))
            return null;

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

    getUrlForNodeAttachment = (node: I.NodeInfo): string => {
        return S.util.getRpcPath() + "bin/file-name" + node.binVer + "?nodeId=" + encodeURIComponent(node.path) + "&ver=" + node.binVer;
    }

    makeImageTag = (node: I.NodeInfo): Img => {
        let src: string = this.getUrlForNodeAttachment(node);

        //NOTE: This property not working yet becasue we style img tags dynamically after created.
        let maxWidth: string = S.props.getNodePropertyVal(cnst.ATT_MAX_WIDTH, node);
        if (!maxWidth) {
            maxWidth = "100%";
        }

        //Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
        let img: Img = new Img({
            "src": src,
            style: { maxWidth: maxWidth, cursor: "pointer", marginLeft: "20px", marginBottom: "15px", paddingRight: "20px" },
            "title": "Click image to enlarge"
        });

        img.whenElm((elm: HTMLElement) => {
            elm.addEventListener("click", () => {
                if (elm.style.maxWidth == "100%") {
                    elm.style.maxWidth = "";
                    elm.title = "Click image to reduce size";
                }
                else {
                    elm.style.maxWidth = "100%";
                    elm.title = "Click image to enlarge";
                }
            });
        });

        return img;
    }

    allowPropertyToDisplay = (propName: string): boolean => {

        if (!S.meta64.isAdminUser) {
            if (propName == "sn:pwd" ||
                propName == "sn:email" ||
                propName == "sn:user") {
                return false;
            }
        }

        if (!S.meta64.inSimpleMode())
            return true;
        return S.meta64.simpleModePropertyBlackList[propName] == null;
    }

    isReadOnlyProperty = (propName: string): boolean => {
        return S.meta64.readOnlyPropertyList[propName];
    }

    isBinaryProperty = (propName: string): boolean => {
        return S.meta64.binaryPropertyList[propName];
    }

    sanitizePropertyName = (propName: string): string => {
        if (S.meta64.editModeOption === "simple") {
            return propName === "cont" ? "Content" : propName;
        } else {
            return propName;
        }
    }
}


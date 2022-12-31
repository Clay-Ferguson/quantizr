import { getAppState } from "../AppContext";
import { AppState } from "../AppState";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { Img } from "../comp/core/Img";
import { Constants as C } from "../Constants";
import { EditNodeDlg } from "../dlg/EditNodeDlg";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Icon } from "./core/Icon";
import { Span } from "./core/Span";
import { HistoryPanel } from "./HistoryPanel";
import { TabPanelButtons } from "./TabPanelButtons";

export class RightNavPanel extends Div {
    private static scrollPos: number = 0;
    static historyExpanded: boolean = false;
    public static inst: RightNavPanel = null;

    constructor() {
        const ast = getAppState();
        super(null, {
            id: C.ID_RHS,
            className: ast.mobileMode ? "mobileRHSPanel" : null,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "3"
        });
        RightNavPanel.inst = this;
    }

    getScrollPos = (): number => {
        return RightNavPanel.scrollPos;
    }

    setScrollPos = (pos: number): void => {
        RightNavPanel.scrollPos = pos;
    }

    preRender(): void {
        const ast = getAppState();

        if (!ast.mobileMode) {
            let panelCols = ast.userPrefs.mainPanelCols || 6;
            if (panelCols < 4) panelCols = 4;
            if (panelCols > 8) panelCols = 8;
            let rightCols = 4;

            if (panelCols >= 6) {
                rightCols--;
            }
            if (panelCols >= 8) {
                rightCols--;
            }
            // console.log("right Cols: " + rightCols);
            this.attribs.className = "col-" + rightCols + " rightNavPanel customScrollbar";
        }

        // DO NOT DELETE
        // show header image only if not super narrow.
        // let headerImg = rightCols > 2 ? this.makeHeaderDiv(state) : null;

        // hack for now. I decided showing the header image isn't very attractive when user has a narrow
        // window, becuase it gets too large, and users maybe don't need to see their own header all the time anyway.
        const headerImg: Div = null;
        const avatarImg = this.makeAvatarDiv(ast, !!headerImg);
        let displayName = ast.displayName ? ast.displayName : (!ast.isAnonUser ? ast.userName : null);

        if (displayName && ast.node) {
            displayName = S.util.insertActPubTags(displayName, ast.node);

            // If user had nothing left after insertion after ":tags:" replacement in their display name, then display their userName
            displayName = displayName || ast.node.owner;
        }

        const allowEditMode = !ast.isAnonUser;
        const fullScreenViewer = S.util.fullscreenViewerActive(ast);

        // const clipboardPasteButton = state.userPrefs.editMode ? new Icon({
        //     className: "fa fa-clipboard fa-lg marginRight clickable",
        //     onClick: () => {
        //         PubSub.pub(C.PUBSUB_closeNavPanel);
        //         // todo-3: would be nice if this detected an image and save as attachment.
        //         S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
        //     },
        //     title: "Save clipboard"
        // }) : null;

        const addNoteButton = !ast.isAnonUser && !ast.mobileMode ? new Icon({
            className: "fa fa-sticky-note stickyNote fa-lg marginRight clickable",
            onClick: async () => {
                PubSub.pub(C.PUBSUB_closeNavPanel);
                let content = null;
                if (S.util.ctrlKeyCheck()) {
                    content = await (navigator as any)?.clipboard?.readText();

                    if (!content) {
                        const blob = await S.util.readClipboardFile();
                        if (blob) {
                            EditNodeDlg.pendingUploadFile = blob;
                        }
                    }
                }
                S.edit.addNode("~" + J.NodeType.NOTES, null, false, content, null, null, () => S.util.showPageMessage("Saved (Go to: Menu -> Quanta -> Notes)"), null, false, ast);
            },
            title: "Create new Private Note"
        }) : null;

        if (addNoteButton) {
            S.domUtil.setDropHandler(addNoteButton.attribs, (evt: DragEvent) => {
                for (const item of evt.dataTransfer.items) {
                    // console.log("DROP(c) kind=" + item.kind + " type=" + item.type);

                    if (item.kind === "file") {
                        EditNodeDlg.pendingUploadFile = item.getAsFile();
                        S.edit.addNode("~" + J.NodeType.NOTES, null, false, null, null, null, () => S.util.showPageMessage("Saved (Go to: Menu -> Quanta -> Notes)"), null, false, ast);
                        return;
                    }
                }
            });
        }

        const textToSpeech = !ast.mobileMode ? new Icon({
            className: "fa fa-volume-up fa-lg marginRight clickable",

            // This mouseover stuff is compensating for the fact that when the onClick gets called
            // it's a problem that by then the text selection "might" have gotten lost. This can happen.
            onMouseOver: () => { S.quanta.selectedForTts = window.getSelection().toString(); },
            onMouseOut: () => { S.quanta.selectedForTts = null; },
            onClick: S.speech.speakSelOrClipboard,
            title: "Text-to-Speech: Selected text or clipboard"
        }) : null;

        if (textToSpeech) {
            S.domUtil.setDropHandler(textToSpeech.attribs, (evt: DragEvent) => {
                for (const item of evt.dataTransfer.items) {
                    // console.log("DROP(c) kind=" + item.kind + " type=" + item.type);
                    if (item.kind === "string") {
                        item.getAsString(async (s) => S.speech.speakText(s));
                        return;
                    }
                }
            });
        }

        this.setChildren([
            new Div(null, { className: "float-left" }, [
                new Div(null, { className: "rightNavPanelInner" }, [
                    !ast.userPrefs.showReplies ? new Span("Show Replies setting is disabled", { title: "This means replies to posts are not displayed." }) : null,

                    // Not showing login on this panel in mobileMode, because it's shown at top of page instead
                    ast.isAnonUser && !ast.mobileMode ? new Div("Login / Signup", {
                        className: "signupLinkText",
                        onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel);
                            S.user.userLogin();
                        }
                    }) : null,

                    new Div(null, { className: "bigMarginBottom" }, [
                        textToSpeech || addNoteButton ? new Span(null, { className: "float-end" }, [
                            textToSpeech,
                            addNoteButton]) : null,

                        (allowEditMode && !fullScreenViewer) ? new Checkbox("Edit", { title: "Create posts, edit, and delete content" }, {
                            setValue: (checked: boolean) => S.edit.toggleEditMode(ast),
                            getValue: (): boolean => ast.userPrefs.editMode
                        }, "form-switch form-check-inline") : null,

                        !fullScreenViewer ? new Checkbox("Info", { title: "Display of avatars, timestamps, etc." }, {
                            setValue: (checked: boolean) => S.edit.toggleShowMetaData(ast),
                            getValue: (): boolean => ast.userPrefs.showMetaData
                        }, "form-switch form-check-inline") : null
                    ]),

                    // new Div(null, { className: "marginBottom" }, [
                    //     new ButtonBar([
                    //         clipboardPasteButton,
                    //         addNoteButton,
                    //         displayName && !state.isAnonUser ? new IconButton("fa-database", null, {
                    //             title: "Go to your Account Root Node",
                    //             onClick: e => S.nav.navHome(state)
                    //         }) : null
                    //     ])
                    // ]),
                    displayName && !ast.isAnonUser ? new Div(displayName, {
                        className: "clickable float-end marginRight",
                        onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel);
                            new UserProfileDlg(null).open();
                        }
                    }) : null,
                    headerImg,
                    !headerImg ? new Div(null, null, [avatarImg]) : avatarImg,
                    !ast.isAnonUser ? new TabPanelButtons(true, ast.mobileMode ? "rhsMenuMobile" : "rhsMenu") : null
                ]),

                S.quanta.nodeHistory?.length > 0 ? new HistoryPanel() : null
            ])
        ]);
    }

    makeHeaderDiv = (ast: AppState): CompIntf => {
        if (!ast.userProfile) return null;

        const src = S.render.getProfileHeaderImgUrl(ast.userProfile.userNodeId, ast.userProfile.headerImageVer);
        if (src) {
            const attr: any = {
                className: "headerImageRHS",
                src
            };

            if (!ast.isAnonUser) {
                attr.onClick = () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel);
                    new UserProfileDlg(null).open();
                };
                attr.title = "Click to edit your Profile Info";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img(attr);
        }
        else {
            return null;
        }
    }

    makeAvatarDiv = (ast: AppState, offset: boolean): CompIntf => {
        let src: string = null;
        if (!ast.userProfile) return null;

        // if ActivityPub icon exists, we know that's the one to use.
        if (ast.userProfile.apIconUrl) {
            src = ast.userProfile.apIconUrl;
        }
        else {
            src = S.render.getAvatarImgUrl(ast.userProfile.userNodeId, ast.userProfile.avatarVer);
        }

        if (src) {
            const attr: any = {
                className: offset ? "profileImageRHS" : "profileImageRHSNoOffset",
                src
            };

            if (!ast.isAnonUser) {
                attr.onClick = () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel);
                    new UserProfileDlg(null).open();
                };
                attr.title = "Click to edit your Profile Info";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img(attr);
        }
        else {
            return null;
        }
    }
}

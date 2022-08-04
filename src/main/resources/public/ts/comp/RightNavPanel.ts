import { getAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { Checkbox } from "../comp/core/Checkbox";
import { CollapsiblePanel } from "../comp/core/CollapsiblePanel";
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

declare var g_brandingAppName;

export class RightNavPanel extends Div {
    private static scrollPos: number = 0;
    static historyExpanded: boolean = false;
    public static inst: RightNavPanel = null;

    constructor() {
        const state = getAppState();
        super(null, {
            id: C.ID_RHS,
            className: state.mobileMode ? "mobileRHSPanel" : null,
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
        const state = getAppState();

        if (!state.mobileMode) {
            let panelCols = state.userPrefs.mainPanelCols || 6;
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
        const headerImg = null;
        const avatarImg = this.makeAvatarDiv(state, !!headerImg);
        let displayName = state.displayName ? state.displayName : (!state.isAnonUser ? state.userName : null);

        if (displayName && state.node) {
            displayName = S.util.insertActPubTags(displayName, state.node);

            // If user had nothing left after insertion after ":tags:" replacement in their display name, then display their userName
            displayName = displayName || state.node.owner;
        }

        const allowEditMode = state.node && !state.isAnonUser;
        const fullScreenViewer = S.util.fullscreenViewerActive(state);

        const clipboardPasteButton = state.userPrefs.editMode ? new Icon({
            className: "fa fa-clipboard fa-lg marginRight clickable",
            onClick: () => {
                PubSub.pub(C.PUBSUB_closeNavPanel, "immediate");
                // todo-1: would be nice if this detected an image and saved as attachment.
                S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
            },
            title: "Save clipboard"
        }) : null;

        const addNoteButton = !state.isAnonUser && !state.mobileMode ? new Icon({
            className: "fa fa-sticky-note stickyNote fa-lg marginRight clickable float-end",
            onClick: async () => {
                PubSub.pub(C.PUBSUB_closeNavPanel, "immediate");
                let content = null;
                if (S.util.ctrlKeyCheck()) {
                    content = await (navigator as any).clipboard.readText();

                    if (!content) {
                        const blob = await S.util.readClipboardFile();
                        if (blob) {
                            EditNodeDlg.pendingUploadFile = blob;
                        }
                    }
                }
                S.edit.addNode("~" + J.NodeType.NOTES, false, content, null, null, () => S.util.showPageMessage("Saved (Go to: Menu -> Quanta -> Notes)"), null, false, state);
            },
            title: "Create new Private Note"
        }) : null;

        if (addNoteButton) {
            S.util.setDropHandler(addNoteButton.attribs, true, (evt: DragEvent) => {
                for (const item of evt.dataTransfer.items) {
                    // console.log("DROP[" + i + "] kind=" + d.kind + " type=" + d.type);
                    if (item.kind === "file") {
                        EditNodeDlg.pendingUploadFile = item.getAsFile();
                        S.edit.addNode("~" + J.NodeType.NOTES, false, null, null, null, () => S.util.showPageMessage("Saved (Go to: Menu -> Quanta -> Notes)"), null, false, state);
                        return;
                    }
                }
            });
        }

        this.setChildren([
            new Div(null, { className: "float-left" }, [
                new Div(null, { className: "rightNavPanelInner" }, [
                    !state.userPrefs.showReplies ? new Span("Show Replies setting is disabled", { title: "This means replies to posts are not displayed on the Quanta Tree." }) : null,

                    // Not showing login on this panel in mobileMode, because it's shown at top of page instead
                    state.isAnonUser && !state.mobileMode ? new Div("Login / Signup", {
                        className: "signupLinkText",
                        onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel, "immediate");
                            S.user.userLogin();
                        }
                    }) : null,

                    new Div(null, { className: "bigMarginBottom" }, [
                        addNoteButton,
                        (allowEditMode && !fullScreenViewer) ? new Checkbox("Edit", { title: "Allows you to create posts, edit, and delete content" }, {
                            setValue: (checked: boolean) => S.edit.toggleEditMode(state),
                            getValue: (): boolean => state.userPrefs.editMode
                        }, "form-switch form-check-inline") : null,

                        !fullScreenViewer ? new Checkbox("Info", { title: "Turns on display of avatars, timestamps, etc." }, {
                            setValue: (checked: boolean) => S.edit.toggleShowMetaData(state),
                            getValue: (): boolean => state.userPrefs.showMetaData
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
                    displayName && !state.isAnonUser ? new Div(displayName, {
                        className: "clickable",
                        onClick: () => {
                            PubSub.pub(C.PUBSUB_closeNavPanel, "immediate");
                            new UserProfileDlg(null).open();
                        }
                    }) : null,
                    headerImg,
                    !headerImg ? new Div(null, null, [avatarImg]) : avatarImg,
                    new TabPanelButtons(true, state.mobileMode ? "rhsMenuMobile" : "rhsMenu")
                ]),

                // note: Anonymouse users don't have nodeHistory
                S.quanta.nodeHistory && S.quanta.nodeHistory.length > 0 ? new CollapsiblePanel("Show History", "Hide History", null, [
                    new HistoryPanel()
                ], true,
                    (state: boolean) => {
                        RightNavPanel.historyExpanded = state;
                    }, RightNavPanel.historyExpanded, "", "histPanelExpanded", "histPanelCollapsed", "div") : null
            ])
        ]);
    }

    makeHeaderDiv = (state: AppState): CompIntf => {
        if (!state.userProfile) return null;

        const src = S.render.getProfileHeaderImgUrl(state.userProfile.userNodeId || state.homeNodeId, state.userProfile.headerImageVer);
        if (src) {
            const attr: any = {
                className: "headerImageRHS",
                src
            };

            if (!state.isAnonUser) {
                attr.onClick = () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel, "immediate");
                    new UserProfileDlg(null).open();
                };
                attr.title = "Click to edit your Profile Info";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("header-img-rhs", attr);
        }
        else {
            return null;
        }
    }

    makeAvatarDiv = (state: AppState, offset: boolean): CompIntf => {
        let src: string = null;
        if (!state.userProfile) return null;

        // if ActivityPub icon exists, we know that's the one to use.
        if (state.userProfile.apIconUrl) {
            src = state.userProfile.apIconUrl;
        }
        else {
            src = S.render.getAvatarImgUrl(state.userProfile.userNodeId || state.homeNodeId, state.userProfile.avatarVer);
        }

        if (src) {
            const attr: any = {
                className: offset ? "profileImageRHS" : "profileImageRHSNoOffset",
                src
            };

            if (!state.isAnonUser) {
                attr.onClick = () => {
                    PubSub.pub(C.PUBSUB_closeNavPanel, "immediate");
                    new UserProfileDlg(null).open();
                };
                attr.title = "Click to edit your Profile Info";
            }

            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img-rhs", attr);
        }
        else {
            return null;
        }
    }
}

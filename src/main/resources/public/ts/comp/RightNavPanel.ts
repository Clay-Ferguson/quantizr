import { appState, store } from "../AppRedux";
import { AppState } from "../AppState";
import { Checkbox } from "../comp/core/Checkbox";
import { CollapsiblePanel } from "../comp/core/CollapsiblePanel";
import { Div } from "../comp/core/Div";
import { IconButton } from "../comp/core/IconButton";
import { Img } from "../comp/core/Img";
import { Constants as C } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Icon } from "./core/Icon";
import { HistoryPanel } from "./HistoryPanel";
import { TabPanelButtons } from "./TabPanelButtons";

declare var g_brandingAppName;

export class RightNavPanel extends Div {

    static historyExpanded: boolean = false;

    constructor() {
        super(null, {
            id: C.ID_RHS,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "3"
        });

        let state: AppState = store.getState();
        let panelCols = state.userPreferences.mainPanelCols || 6;
        if (panelCols < 4) panelCols = 4;
        if (panelCols > 8) panelCols = 8;
        let rightCols = 4;

        if (panelCols >= 5) {
            rightCols--;
        }
        if (panelCols >= 7) {
            rightCols--;
        }

        // console.log("right Cols: " + rightCols);
        this.attribs.className = "col-" + rightCols + " rightNavPanel customScrollbar";
    }

    preRender(): void {
        let state: AppState = store.getState();

        // mobile mode doesn't render the RHS at all.
        if (state.mobileMode) return;

        let headerImg = this.makeHeaderDiv(state);
        let avatarImg = this.makeAvatarDiv(state, !!headerImg);

        let displayName = state.displayName ? state.displayName : (!state.isAnonUser ? state.userName : null);
        displayName = S.util.insertActPubTags(displayName, state.node);

        // If user had nothin but ":tags:" in their display name, then display there userName
        if (!displayName) {
            displayName = state.node.owner;
        }

        let allowEditMode = state.node && !state.isAnonUser;
        let fullScreenViewer = S.util.fullscreenViewerActive(state);

        let clipboardPasteButton = state.userPreferences.editMode ? new Icon({
            className: "fa fa-clipboard fa-lg marginRight clickable",
            onClick: e => {
                // todo-1: would be nice if this detected an image and saved as attachment.
                S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
            },
            title: "Save clipboard"
        }) : null;

        let addNoteButton = state.userPreferences.editMode ? new Icon({
            className: "fa fa-sticky-note fa-lg marginRight clickable",
            onClick: e => {
                S.edit.addNode("~" + J.NodeType.NOTES, null, null, null, state);
            },
            title: "Create new Note"
        }) : null;

        this.setChildren([
            new Div(null, { className: "float-left" }, [
                new Div(null, { className: "rightNavPanelInner" }, [
                    state.isAnonUser ? new Div("Login / Signup", {
                        className: "signupLinkText",
                        onClick: e => { S.nav.login(state); }
                    }) : null,

                    new Div(null, { className: "marginBottom" }, [
                        displayName && !state.isAnonUser ? new IconButton("fa-database", "Account", {
                            title: "Go to Account Root Node",
                            onClick: e => S.nav.navHome(state)
                        }, "marginRight btn-primary") : null,
                        clipboardPasteButton,
                        addNoteButton
                    ]),

                    new Div(null, { className: "bigMarginBottom" }, [
                        (allowEditMode && !fullScreenViewer) ? new Checkbox("Edit", { title: "Allow editing content" }, {
                            setValue: (checked: boolean): void => {
                                S.edit.toggleEditMode(state);
                            },
                            getValue: (): boolean => {
                                return state.userPreferences.editMode;
                            }
                        }, "form-switch form-check-inline") : null,

                        !fullScreenViewer ? new Checkbox("Meta", { title: "Metadata: Avatars, timestamps, etc." }, {
                            setValue: (checked: boolean): void => {
                                S.edit.toggleShowMetaData(state);
                            },
                            getValue: (): boolean => {
                                return state.userPreferences.showMetaData;
                            }
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
                        onClick: () => { new UserProfileDlg(null, appState(null)).open(); }
                    }) : null,
                    headerImg,
                    !headerImg ? new Div(null, null, [avatarImg]) : avatarImg,
                    new TabPanelButtons(true, "rhsMenu")
                ]),

                new CollapsiblePanel("History", "History", null, [
                    new HistoryPanel()
                ], true,
                    (state: boolean) => {
                        RightNavPanel.historyExpanded = state;
                    }, RightNavPanel.historyExpanded, "", "histPanelExpanded", "histPanelCollapsed", "div")
            ])
        ]);
    }

    makeHeaderDiv = (state: AppState): CompIntf => {
        if (!state.userProfile) return null;

        let src = S.render.getProfileHeaderImgUrl(state.userProfile.userNodeId || state.homeNodeId, state.userProfile.headerImageVer);

        if (src) {
            let attr: any = {
                className: "headerImageRHS",
                src
            };

            if (!state.isAnonUser) {
                attr.onClick = () => {
                    new UserProfileDlg(null, state).open();
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
            let attr: any = {
                className: offset ? "profileImageRHS" : "profileImageRHSNoOffset",
                src
            };

            if (!state.isAnonUser) {
                attr.onClick = () => {
                    new UserProfileDlg(null, state).open();
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

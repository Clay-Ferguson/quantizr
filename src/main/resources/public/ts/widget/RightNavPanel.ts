import { appState, dispatch, store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C, Constants } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Button } from "./Button";
import { ButtonBar } from "./ButtonBar";
import { Checkbox } from "./Checkbox";
import { Div } from "./Div";
import { HistoryPanel } from "./HistoryPanel";
import { IconButton } from "./IconButton";
import { Img } from "./Img";
import { TabPanelButtons } from "./TabPanelButtons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RightNavPanel extends Div {

    constructor() {
        super(null, {
            id: C.ID_RHS,
            // tabIndex is required or else scrolling by arrow keys breaks.
            tabIndex: "3"
        });
        let state: AppState = store.getState();
        let delta = state.mainPanelCols === 4 ? -1 : 0;
        let cols = 12 - Constants.leftNavPanelCols - state.mainPanelCols + delta;
        this.attribs.className = "col-" + cols + " rightNavPanel customScrollbar";
    }

    preRender(): void {
        let state: AppState = store.getState();

        // mobile mode doesn't render the RHS at all.
        if (state.mobileMode) return;

        let headerImg = this.makeHeaderDiv(state);
        let avatarImg = this.makeAvatarDiv(state, !!headerImg);
        let profileButton = !state.isAnonUser && !headerImg && !avatarImg
            ? new Button("Edit Profile", () => {
                new UserProfileDlg(null, appState(null)).open();
            }, null, "btn-secondary marginBottom") : null;

        let displayName = state.displayName ? state.displayName : state.title;

        let allowEditMode = state.node && !state.isAnonUser;
        let fullScreenViewer = S.quanta.fullscreenViewerActive(state);

        let clipboardPasteButton = !state.isAnonUser ? new IconButton("fa-clipboard", null, {
            onClick: e => {
                S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
            },
            title: "Save clipboard (under Notes node)"
        }, "btn-secondary", "off") : null;

        let addNoteButton = !state.isAnonUser ? new IconButton("fa-sticky-note", null, {
            onClick: e => {
                S.edit.addNode("~" + J.NodeType.NOTES, null, null, null, state);
            },
            title: "Create new Note (under Notes node)"
        }, "btn-secondary", "off") : null;

        this.setChildren([
            new Div(null, { className: "float-left" }, [
                new Div(null, { className: "rightNavPanelInner" }, [
                    state.isAnonUser ? new Div("Login / Signup", {
                        className: "signupLinkText",
                        onClick: e => { S.nav.login(state); }
                    }) : null,

                    new Div(null, { className: "bigMarginBottom" }, [
                        !fullScreenViewer ? new Checkbox("Metadata", null, {
                            setValue: (checked: boolean): void => {
                                S.edit.toggleShowMetaData(state);
                            },
                            getValue: (): boolean => {
                                return state.userPreferences.showMetaData;
                            }
                        }, "form-switch form-check-inline") : null,
                        (allowEditMode && !fullScreenViewer) ? new Checkbox("Edit", null, {
                            setValue: (checked: boolean): void => {
                                S.edit.toggleEditMode(state);
                            },
                            getValue: (): boolean => {
                                return state.userPreferences.editMode;
                            }
                        }, "form-switch form-check-inline") : null
                    ]),

                    new Div(null, { className: "marginBottom" }, [
                        new ButtonBar([
                            !state.isAnonUser && state.mainPanelCols > 4 ? new IconButton("fa-caret-left", null, {
                                className: "widthAdjustLink",
                                title: "Narrower view",
                                onClick: () => {
                                    dispatch("Action_widthAdjust", (s: AppState): AppState => {
                                        s.mainPanelCols--;
                                        return s;
                                    });
                                }
                            }) : null,
                            !state.isAnonUser && state.mainPanelCols < 7 ? new IconButton("fa-caret-right", null, {
                                className: "widthAdjustLink",
                                title: "Wider view",
                                onClick: () => {
                                    dispatch("Action_widthAdjust", (s: AppState): AppState => {
                                        s.mainPanelCols++;
                                        return s;
                                    });
                                }
                            }) : null,
                            clipboardPasteButton, addNoteButton
                        ])
                    ]),

                    profileButton,
                    displayName && !state.isAnonUser ? new IconButton("fa-database", displayName, {
                        title: "Go to your Account Root Node",
                        onClick: e => { S.nav.navHome(state); }
                    }, "btn-secondary marginBottom marginRight") : null,
                    headerImg,
                    !headerImg ? new Div(null, null, [avatarImg]) : avatarImg,
                    new TabPanelButtons(true, "rhsMenu")
                ]),
                new HistoryPanel(),
                !state.isAnonUser ? new Div("Logout", {
                    className: "float-end rhsLogoutLink",
                    onClick: S.nav.logout
                }) : null
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

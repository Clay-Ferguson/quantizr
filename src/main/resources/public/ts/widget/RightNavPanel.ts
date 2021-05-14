import { appState, store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Button } from "./Button";
import { ButtonBar } from "./ButtonBar";
import { Div } from "./Div";
import { IconButton } from "./IconButton";
import { Img } from "./Img";
import { TabPanelButtons } from "./TabPanelButtons";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class RightNavPanel extends Div {

    constructor() {
        super();
        // See also: TabPanel.ts which has the inverse/balance of these numbers of columns.
        this.attribs.className = //
            // =======================================
            // see: other places these tags exist
            // for #NON_DYNAMIC_COLS
            "col-" + (C.rightNavPanelCols) + //
            // for #DYNAMIC_COLS
            // "col-" + (C.rightNavPanelCols - 3) + //
            // " col-md-" + (C.rightNavPanelCols - 2) + //
            // " col-lg-" + (C.rightNavPanelCols - 1) + //
            // " col-xl-" + C.rightNavPanelCols + //
            // =======================================
            " offset-" + (C.leftNavPanelCols + C.mainPanelCols) + " rightNavPanel position-fixed";
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

        this.setChildren([
            new Div(null, { className: "float-left" }, [
                new Div(null, { className: state.userPreferences.editMode ? "rightNavPanelInnerEditMode" : "rightNavPanelInner" }, [
                    state.isAnonUser ? new Div("Login / Signup", {
                        className: "signupLinkText",
                        onClick: e => { S.nav.login(state); }
                    }) : null,
                    state.title && !state.isAnonUser ? new Button("@" + state.title, e => { S.nav.navHome(state); },
                        { title: "Go to your Account Root Node" }, "btn-secondary marginBottom marginRight") : null,
                    profileButton,
                    headerImg,
                    avatarImg,
                    this.makeButtonsBar(state),
                    new TabPanelButtons(true, "rhsMenu")
                ])
            ])
        ]);
    }

    makeButtonsBar = (state: AppState): CompIntf => {
        let allowEditMode = state.node && !state.isAnonUser;
        let fullScreenViewer = S.meta64.fullscreenViewerActive(state);

        let editButton = (allowEditMode && !fullScreenViewer) ? new IconButton("fa-pencil", null, {
            onClick: e => { S.edit.toggleEditMode(state); },
            title: "Turn edit mode " + (state.userPreferences.editMode ? "off" : "on")
        }, "btn-secondary", state.userPreferences.editMode ? "on" : "off") : null;

        let prefsButton = !fullScreenViewer ? new IconButton("fa-certificate", null, {
            onClick: e => { S.edit.toggleShowMetaData(state); },
            title: state.userPreferences.showMetaData ? "Hide Avatars and Metadata" : "Show Avatars and Metadata"
        }, "btn-secondary", state.userPreferences.showMetaData ? "on" : "off") : null;

        let clipboardPasteButton = !state.isAnonUser ? new IconButton("fa-clipboard", null, {
            onClick: e => {
                S.edit.saveClipboardToChildNode("~" + J.NodeType.NOTES);
            },
            title: "Save clipboard (under Notes node)"
        }, "btn-secondary", "off") : null;

        let addNoteButton = !state.isAnonUser ? new IconButton("fa-sticky-note", null, {
            onClick: e => {
                S.edit.addNode("~" + J.NodeType.NOTES, null, state);
            },
            title: "Create new Note (under Notes node)"
        }, "btn-secondary", "off") : null;

        return new Div(null, { className: "marginBottom" }, [new ButtonBar([editButton, prefsButton, clipboardPasteButton, addNoteButton])]);
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

import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { UserProfileDlg } from "../dlg/UserProfileDlg";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "./base/CompIntf";
import { Div } from "./Div";
import { Heading } from "./Heading";
import { Img } from "./Img";
import { Span } from "./Span";
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

        this.setChildren([
            new Div(null, { className: "float-left" }, [
                new Div(null, { className: "rightNavPanelInner" }, [
                    state.isAnonUser ? new Div("Login / Signup", {
                        className: "signupLinkText",
                        onClick: e => { S.nav.login(state); }
                    }) : null,
                    state.title && !state.isAnonUser ? new Heading(6, "@" + state.title, { className: "rhsUserName" }) : null,
                    headerImg,
                    avatarImg,
                    new TabPanelButtons(true, "rhsMenu")
                ])
            ])
        ]);
    }

    makeHeaderDiv = (state: AppState): CompIntf => {
        if (!state.userProfile) return null;

        let src = S.render.getProfileHeaderImgUrl(state.userProfile.userNodeId || state.homeNodeId, state.userProfile.headerImageVer);

        if (src) {
            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("header-img-rhs", {
                className: "headerImageRHS",
                src,
                onClick: () => {
                    new UserProfileDlg(null, state).open();
                }
            });
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
            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img-rhs", {
                className: offset ? "profileImageRHS" : "profileImageRHSNoOffset",
                src,
                onClick: () => {
                    new UserProfileDlg(null, state).open();
                }
            });
        }
        else {
            return null;
        }
    }
}

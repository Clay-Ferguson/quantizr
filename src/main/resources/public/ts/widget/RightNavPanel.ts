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

        this.setChildren([
            new Div(null, { className: "float-left" }, [
                new Div(null, { className: "rightNavPanelInner" }, [
                    this.makeAvatarDiv(state),
                    new Heading(5, state.title, { className: "microMarginTop marginBottom" })]),
                new TabPanelButtons(true)
            ])
        ]);
    }

    makeAvatarDiv = (state: AppState): CompIntf => {
        let src: string = null;

        if (!state.userProfile) return null;

        // if ActivityPub icon exists, we know that's the one to use.
        if (state.userProfile.apIconUrl) {
            src = state.userProfile.apIconUrl;
        }
        else {
            let avatarVer = state.userProfile.avatarVer;
            src = S.render.getAvatarImgUrl(state.userProfile.userNodeId || state.homeNodeId, avatarVer);
        }

        if (src) {
            // Note: we DO have the image width/height set on the node object (node.width, node.hight) but we don't need it for anything currently
            return new Img("profile-img-rhs", {
                className: "profileImageRHS",
                src,
                onClick: () => {
                    new UserProfileDlg(false, null, state).open();
                }
            });
        }
        else {
            return null;
        }
    }
}

import { dispatch, getAppState } from "../AppContext";
import { ScrollPos } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";

export class EditTagsDlg extends DialogBase {
    tagsState: Validator = new Validator();
    textScrollPos = new ScrollPos();

    constructor() {
        super("Edit Hashtags", "app-modal-content-medium-width");
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new Div("Enter your custom hashtags, each on a separate line below. Hashtags must start with #."),
                new TextArea("Hashtags", { rows: 15 }, this.tagsState, null, false, this.textScrollPos),
                new ButtonBar([
                    new Button("Save", this.save, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    reload = async () => {
        const res = await S.util.rpc<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
            userId: getAppState().userProfile.userNodeId
        });

        // console.log("UserProfile Response: " + S.util.prettyPrint(res));
        if (res?.userProfile) {
            this.tagsState.setValue(res.userProfile.userTags);
        }
    }

    save = () => {
        const appState = getAppState();
        appState.userProfile.userTags = this.tagsState.getValue();

        dispatch("SetUserProfile", s => {
            s.userProfile = appState.userProfile;
            return s;
        });

        S.util.rpc<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null,
            userTags: appState.userProfile.userTags,
            userBio: appState.userProfile.userBio,
            displayName: appState.userProfile.displayName,
            publish: false,
            mfsEnable: appState.userProfile.mfsEnable
        });
        this.close();
    }

    async preLoad(): Promise<void> {
        await this.reload();
    }
}

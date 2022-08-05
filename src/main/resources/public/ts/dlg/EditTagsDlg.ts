import { dispatch, getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

export class EditTagsDlg extends DialogBase {
    tagsState: ValidatedState = new ValidatedState();

    constructor() {
        super("Edit Hashtags", "app-modal-content-medium-width");
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new Div("Enter your custom hashtags, each on a separate line below. Hashtags must start with #."),
                new TextArea("Hashtags", { rows: 15 }, this.tagsState),
                new ButtonBar([
                    new Button("Save", this.save, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    reload = async () => {
        const res = await S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
            userId: getAppState().userProfile.userNodeId
        });

        // console.log("UserProfile Response: " + S.util.prettyPrint(res));
        if (res?.userProfile) {
            this.tagsState.setValue(res.userProfile.userTags);
        }
    }

    save = () => {
        getAppState().userProfile.userTags = this.tagsState.getValue();

        dispatch("SetUserProfile", s => {
            s.userProfile = getAppState().userProfile;
            return s;
        });

        S.util.ajax<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null,
            userTags: getAppState().userProfile.userTags,
            userBio: getAppState().userProfile.userBio,
            displayName: getAppState().userProfile.displayName,
            publish: false,
            mfsEnable: getAppState().userProfile.mfsEnable
        });
        this.close();
    }

    async preLoad(): Promise<void> {
        await this.reload();
    }
}

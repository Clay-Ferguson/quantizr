import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { TextArea } from "../comp/core/TextArea";
import { DialogBase } from "../DialogBase";
import { ValidatedState } from "../ValidatedState";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { dispatch } from "../AppRedux";
import { Div } from "../comp/core/Div";

interface LS { // Local State
}

export class EditTagsDlg extends DialogBase {
    tagsState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Edit Hashtags", "app-modal-content-medium-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new Div("Enter your custom hashtags, each on a separate line, below."),
                new TextArea("Hashtags", { rows: 15 }, this.tagsState),
                new ButtonBar([
                    new Button("Save", this.save, null, "btn-primary"),
                    new Button("Cancel", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    reload = async () => {
        let res: J.GetUserProfileResponse = await S.util.ajax<J.GetUserProfileRequest, J.GetUserProfileResponse>("getUserProfile", {
            userId: this.appState.userProfile.userNodeId
        });

        // console.log("UserProfile Response: " + S.util.prettyPrint(res));
        if (res?.userProfile) {
            this.tagsState.setValue(res.userProfile.userTags);
        }
    }

    save = () => {
        this.appState.userProfile.userTags = this.tagsState.getValue();

        dispatch("Action_SetUserProfile", (s: AppState): AppState => {
            s.userProfile = this.appState.userProfile;
            return s;
        });

        S.util.ajax<J.SaveUserProfileRequest, J.SaveUserProfileResponse>("saveUserProfile", {
            userName: null,
            userTags: this.appState.userProfile.userTags,
            userBio: this.appState.userProfile.userBio,
            displayName: this.appState.userProfile.displayName,
            publish: false,
            mfsEnable: this.appState.userProfile.mfsEnable
        });
        this.close();
    }

    async preLoad(): Promise<void> {
        await this.reload();
    }
}

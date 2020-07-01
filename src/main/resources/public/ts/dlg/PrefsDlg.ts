import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Checkbox } from "../widget/Checkbox";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class PrefsDlg extends DialogBase {

    showMetadataCheckBox: Checkbox;

    constructor(state: AppState) {
        super("Preferences", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new FormGroup(null, [
                    this.showMetadataCheckBox = new Checkbox("Show Metadata", this.appState.userPreferences.showMetaData),
                ]),
                new ButtonBar([
                    new Button("Save", this.savePreferences, null, "btn-primary"),
                    new Button("Cancel", () => {
                        this.close();
                    })
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    savePreferences = (): void => {
        this.appState.userPreferences.showMetaData = this.showMetadataCheckBox.getChecked();

        S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
            "userPreferences": {
                editMode: this.appState.userPreferences.editMode,
                importAllowed: false,
                exportAllowed: false,
                showMetaData: this.appState.userPreferences.showMetaData,
                maxUploadFileSize: -1,
            }
        }, this.savePreferencesResponse);
        this.close();
    }

    savePreferencesResponse = (res: J.SaveUserPreferencesResponse): void => {
        if (S.util.checkSuccess("Saving Preferences", res)) {
            S.meta64.refresh(this.appState);
        }
    }
}

import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { RadioButton } from "../widget/RadioButton";
import { Checkbox } from "../widget/Checkbox";
import { Div } from "../widget/Div";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class PrefsDlg extends DialogBase {

    showMetadataCheckBox: Checkbox;

    constructor() {
        super("Preferences");
    }

    init = (): void => {
        this.setChildren([
            new Form(null, [
                new FormGroup(null,
                    [
                        this.showMetadataCheckBox = new Checkbox("Show Metadata", S.meta64.showMetaData),
                    ]
                ),
                new ButtonBar(
                    [
                        new Button("Save", this.savePreferences, null, "primary"),
                        new Button("Cancel", () => {
                            this.close();
                        })
                    ])

            ])
        ]);
    }

    savePreferences = (): void => {
        S.meta64.showMetaData = this.showMetadataCheckBox.getChecked();

        S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
            //todo-2: both of these options should come from meta64.userPrefernces, and not be stored directly on meta64 scope.
            "userPreferences": {
                "editMode": S.meta64.userPreferences.editMode,
                "importAllowed": false,
                "exportAllowed": false,
                "showMetaData": S.meta64.showMetaData
            }
        }, this.savePreferencesResponse);
        this.close();
    }

    savePreferencesResponse = (res: J.SaveUserPreferencesResponse): void => {
        if (S.util.checkSuccess("Saving Preferences", res)) {
            S.meta64.selectTab("mainTab");
            S.meta64.refresh();
        }
    }
}

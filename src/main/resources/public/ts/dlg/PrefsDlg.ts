import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Form } from "../comp/core/Form";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";

// NOTE: THIS DIALOG IS CURRENTLY NOT USED BUT WE NEED TO KEEP IT BECAUSE IN THE FUTURE IT LIKELY WILL BE
export class PrefsDlg extends DialogBase {

    constructor(state: AppState) {
        super("Preferences", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new HorizontalLayout([
                    new Checkbox("Show Node Metadata", null, {
                        setValue: (checked: boolean) => {
                            this.appState.userPreferences.showMetaData = checked;
                        },
                        getValue: (): boolean => {
                            return this.appState.userPreferences.showMetaData;
                        }
                    })
                ]),
                new ButtonBar([
                    new Button("Save", this.savePreferences, null, "btn-primary"),
                    new Button("Cancel", this.close)
                ], "marginTop")
            ])
        ];
    }

    savePreferences = async () => {
        if (!this.appState.isAnonUser) {
            let res = await S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
                userNodeId: this.appState.homeNodeId,
                userPreferences: {
                    editMode: this.appState.userPreferences.editMode,
                    showMetaData: this.appState.userPreferences.showMetaData,
                    nsfw: this.appState.userPreferences.nsfw,
                    showParents: this.appState.userPreferences.showParents,
                    showReplies: this.appState.userPreferences.showReplies,
                    rssHeadlinesOnly: this.appState.userPreferences.rssHeadlinesOnly,
                    mainPanelCols: this.appState.userPreferences.mainPanelCols,
                    maxUploadFileSize: -1,
                    enableIPSM: false // we never need to enable this here. Only the menu can trigger it to set for now.
                }
            });
            this.savePreferencesResponse(res);
        }
        this.close();
    }

    savePreferencesResponse = (res: J.SaveUserPreferencesResponse) => {
        if (S.util.checkSuccess("Saving Preferences", res)) {
            S.quanta.refresh(this.appState);
        }
    }
}

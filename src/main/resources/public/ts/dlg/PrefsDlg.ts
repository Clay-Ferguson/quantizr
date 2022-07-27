import { getAppState } from "../AppRedux";
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

    constructor() {
        super("Preferences");
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new HorizontalLayout([
                    new Checkbox("Show Node Metadata", null, {
                        setValue: (checked: boolean) => {
                            getAppState().userPrefs.showMetaData = checked;
                        },
                        getValue: (): boolean => {
                            return getAppState().userPrefs.showMetaData;
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
        if (!getAppState().isAnonUser) {
            let res = await S.util.ajax<J.SaveUserPreferencesRequest, J.SaveUserPreferencesResponse>("saveUserPreferences", {
                userNodeId: getAppState().homeNodeId,
                userPreferences: {
                    editMode: getAppState().userPrefs.editMode,
                    showMetaData: getAppState().userPrefs.showMetaData,
                    nsfw: getAppState().userPrefs.nsfw,
                    showParents: getAppState().userPrefs.showParents,
                    showReplies: getAppState().userPrefs.showReplies,
                    rssHeadlinesOnly: getAppState().userPrefs.rssHeadlinesOnly,
                    mainPanelCols: getAppState().userPrefs.mainPanelCols,
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
            S.quanta.refresh(getAppState());
        }
    }
}

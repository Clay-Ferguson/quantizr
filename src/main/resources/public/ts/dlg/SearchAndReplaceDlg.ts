import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { Form } from "../widget/Form";
import { FormGroup } from "../widget/FormGroup";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchAndReplaceDlg extends DialogBase {

    static searchState: ValidatedState<any> = new ValidatedState<any>();
    static replaceState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Search and Replace", "app-modal-content-narrow-width", false, state);
        this.mergeState({
            recursive: true
        });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new FormGroup(null, [
                    new TextField("Search for", null, null, null, false, SearchAndReplaceDlg.searchState),
                    new TextField("Replace with", null, null, null, false, SearchAndReplaceDlg.replaceState)
                ]),
                new FormGroup(null, [
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({ recursive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState().recursive;
                        }
                    })
                ]),
                new ButtonBar([
                    new Button("Replace", this.replace, null, "btn-primary"),
                    new Button("Close", this.close)
                ])
            ])
        ];
    }

    validate = (): boolean => {
        let valid = true;

        if (!SearchAndReplaceDlg.searchState.getValue()) {
            SearchAndReplaceDlg.searchState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            SearchAndReplaceDlg.searchState.setError(null);
        }

        if (!SearchAndReplaceDlg.replaceState.getValue()) {
            SearchAndReplaceDlg.replaceState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            SearchAndReplaceDlg.replaceState.setError(null);
        }

        return valid;
    }

    replace = (): void => {
        if (!this.validate()) {
            return;
        }

        let node: J.NodeInfo = S.meta64.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }

        S.srch.searchAndReplace(this.getState().recursive, node.id, SearchAndReplaceDlg.searchState.getValue(), SearchAndReplaceDlg.replaceState.getValue(), this.appState);
        this.close();
    }
}

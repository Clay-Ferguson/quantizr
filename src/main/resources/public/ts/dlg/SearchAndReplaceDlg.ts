import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { Checkbox } from "../comp/Checkbox";
import { Form } from "../comp/Form";
import { HorizontalLayout } from "../comp/HorizontalLayout";
import { TextField } from "../comp/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

interface LS {
    recursive: boolean;
}

export class SearchAndReplaceDlg extends DialogBase {

    searchState: ValidatedState<any> = new ValidatedState<any>();
    replaceState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Search and Replace", "app-modal-content-narrow-width", false, state);
        this.mergeState<LS>({ recursive: true });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new HorizontalLayout([
                    new TextField("Search for", null, null, null, false, this.searchState),
                    new TextField("Replace with", null, null, null, false, this.replaceState)
                ]),
                new HorizontalLayout([
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState<LS>({ recursive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState<LS>().recursive;
                        }
                    })
                ]),
                new ButtonBar([
                    new Button("Replace", this.replace, null, "btn-primary"),
                    new Button("Close", this.close)
                ], "marginTop")
            ])
        ];
    }

    validate = (): boolean => {
        let valid = true;

        if (!this.searchState.getValue()) {
            this.searchState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.searchState.setError(null);
        }

        if (!this.replaceState.getValue()) {
            this.replaceState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.replaceState.setError(null);
        }

        return valid;
    }

    replace = (): void => {
        if (!this.validate()) {
            return;
        }

        let node: J.NodeInfo = S.nodeUtil.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }

        S.srch.searchAndReplace(this.getState<LS>().recursive, node.id, this.searchState.getValue(), this.replaceState.getValue(), this.appState);
        this.close();
    }
}

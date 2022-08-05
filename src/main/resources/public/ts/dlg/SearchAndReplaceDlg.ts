import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { ValidatedState, ValidatorRuleName } from "../ValidatedState";

interface LS { // Local State
    recursive: boolean;
}

export class SearchAndReplaceDlg extends DialogBase {

    searchState: ValidatedState = new ValidatedState("", [{ name: ValidatorRuleName.REQUIRED }]);
    replaceState: ValidatedState = new ValidatedState("", [{ name: ValidatorRuleName.REQUIRED }]);

    constructor() {
        super("Search and Replace", "app-modal-content-narrow-width");
        this.mergeState<LS>({ recursive: true });
        this.validatedStates = [this.searchState, this.replaceState];
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new TextField({ label: "Search for", val: this.searchState }),
                new TextField({ label: "Replace with", val: this.replaceState }),
                new HorizontalLayout([
                    new Checkbox("Include Sub-Nodes", null, {
                        setValue: (checked: boolean) => this.mergeState<LS>({ recursive: checked }),
                        getValue: (): boolean => this.getState<LS>().recursive
                    })
                ]),
                new ButtonBar([
                    new Button("Replace", this.replace, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    replace = () => {
        if (!this.validate()) {
            return;
        }

        const node = S.nodeUtil.getHighlightedNode(getAppState());
        if (!node) {
            S.util.showMessage("No node was selected.", "Warning");
            return;
        }

        S.srch.searchAndReplace(this.getState<LS>().recursive, node.id, this.searchState.getValue(), this.replaceState.getValue(), getAppState());
        this.close();
    }
}

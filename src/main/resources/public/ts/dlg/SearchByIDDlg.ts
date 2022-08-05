import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { ValidatedState, ValidatorRuleName } from "../ValidatedState";

export class SearchByIDDlg extends DialogBase {

    static defaultSearchText: string = "";
    searchTextField: TextField;
    searchTextState: ValidatedState<any> = new ValidatedState<any>("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor() {
        super("Search for Node ID", "app-modal-content-medium-width");
        this.onMount(() => this.searchTextField?.focus());
        this.searchTextState.setValue(SearchByIDDlg.defaultSearchText);
        this.validatedStates = [this.searchTextState];
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                this.searchTextField = new TextField({ label: "Node ID", enter: this.search, val: this.searchTextState }),
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    search = () => {
        if (!this.validate()) {
            return;
        }

        if (!S.util.ajaxReady("searchNodes")) {
            return;
        }

        SearchByIDDlg.defaultSearchText = this.searchTextState.getValue();

        const desc = "For ID: " + SearchByIDDlg.defaultSearchText;
        S.srch.search(null, "node.id", SearchByIDDlg.defaultSearchText, getAppState(), null, desc, false,
            false, 0, true, null, null, false, this.close);
    }
}

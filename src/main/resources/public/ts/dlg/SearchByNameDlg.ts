import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

export class SearchByNameDlg extends DialogBase {
    static defaultSearchText: string = "";

    searchTextField: TextField;
    searchTextState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Search Node Names", "app-modal-content-medium-width", false, state);
        this.whenElm((elm: HTMLElement) => {
            this.searchTextField.focus();
        });
        this.searchTextState.setValue(SearchByNameDlg.defaultSearchText);
    }

    validate = (): boolean => {
        let valid = true;

        if (!this.searchTextState.getValue()) {
            this.searchTextState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.searchTextState.setError(null);
        }

        return valid;
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                this.searchTextField = new TextField({ label: "Node Name", enter: this.search, val: this.searchTextState }),
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

        SearchByNameDlg.defaultSearchText = this.searchTextState.getValue();

        let desc = "Node Name: " + SearchByNameDlg.defaultSearchText;
        S.srch.search(null, "node.name", SearchByNameDlg.defaultSearchText, this.appState, null, desc, false,
            false, 0, true, "mtm", "DESC", false, this.close);
    }
}

import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchByNameDlg extends DialogBase {

    static defaultSearchText: string = "";

    searchTextField: TextField;
    searchTextState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Search by Node Name", "app-modal-content-medium-width", false, state);
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
                this.searchTextField = new TextField("Node Name", false, this.search, null, false, this.searchTextState),
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
                    new Button("Close", this.close)
                ])
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

        // until we have better validation
        let node = S.meta64.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }

        SearchByNameDlg.defaultSearchText = this.searchTextState.getValue();

        let desc = "Node Name: " + SearchByNameDlg.defaultSearchText;
        S.srch.search(node, "node.name", SearchByNameDlg.defaultSearchText, this.appState, null, desc, false,
            false, 0, this.close);
    }
}

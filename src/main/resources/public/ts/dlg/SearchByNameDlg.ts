import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";
import { MessageDlg } from "./MessageDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchByNameDlg extends DialogBase {

    static defaultSearchText: string = "";

    searchTextField: TextField;
    static searchTextState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Search by Node Name", "app-modal-content-medium-width", false, state);
        this.whenElm((elm: HTMLElement) => {
            this.searchTextField.focus();
        });
        SearchByNameDlg.searchTextState.setValue(SearchByNameDlg.defaultSearchText);
    }

    validate = (): boolean => {
        let valid = true;

        if (!SearchByNameDlg.searchTextState.getValue()) {
            SearchByNameDlg.searchTextState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            SearchByNameDlg.searchTextState.setError(null);
        }

        return valid;
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                this.searchTextField = new TextField("Node Name", false, this.search, null, false, SearchByNameDlg.searchTextState),
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

        SearchByNameDlg.defaultSearchText = SearchByNameDlg.searchTextState.getValue();

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            nodeId: node.id,
            searchText: SearchByNameDlg.searchTextState.getValue(),
            sortDir: "",
            sortField: "",
            searchProp: "node.name",
            fuzzy: false,
            caseSensitive: false,
            searchDefinition: "",
            userSearchType: null,
            timeRangeType: null
        }, this.searchNodesResponse);
    }

    searchNodesResponse = (res: J.NodeSearchResponse) => {
        if (S.srch.numSearchResults(res) > 0) {
            S.srch.searchNodesResponse(res, "Search for node " + SearchByNameDlg.searchTextState.getValue(), false);
            this.close();
        }
        else {
            new MessageDlg("No search results found.", "Search", null, null, false, 0, this.appState).open();
        }
    }
}

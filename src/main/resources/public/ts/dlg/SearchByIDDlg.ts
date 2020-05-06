import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { TextContent } from "../widget/TextContent";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { MessageDlg } from "./MessageDlg";
import { AppState } from "../AppState";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchByIDDlg extends DialogBase {

    static defaultSearchText: string = "";
    searchTextField: TextField;

    constructor(state: AppState) {
        super("Search by Node ID", "app-modal-content-medium-width", false, false, state);
    }
    
    preRender = () => {
        this.setChildren([
            new Form(null, [
                new TextContent("All sub-nodes under the selected node will be searched."),
                this.searchTextField = new TextField("Node ID", {
                    onKeyPress: (e: KeyboardEvent) => {
                        if (e.which == 13) { // 13==enter key code
                            this.search();
                            return false;
                        }
                    }
                }, SearchByIDDlg.defaultSearchText),
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ]);
        this.searchTextField.focus();
    }

    search = () => {
        if (!S.util.ajaxReady("searchNodes")) {
            return;
        }

        // until we have better validation
        let node = S.meta64.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node is selected to search under.");
            return;
        }

        // until better validation, just check for empty
        let searchText = this.searchTextField.getValue();
        if (!searchText) {
            S.util.showMessage("Enter search text.");
            return;
        }

        SearchByIDDlg.defaultSearchText = searchText;

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            "nodeId": node.id,
            "searchText": searchText,
            "sortDir": "",
            "sortField": "",
            "searchProp": "node.id",
            "fuzzy": false,
            "caseSensitive": false,
            "searchDefinition": ""
        }, this.searchNodesResponse);
    }

    searchNodesResponse = (res: J.NodeSearchResponse) => {
        if (S.srch.numSearchResults(res) > 0) {
            S.srch.searchNodesResponse(res);
            this.close();
        }
        else {
            new MessageDlg("No search results found.", "Search", null, null, false, 0, this.appState).open();
        }
    }
}


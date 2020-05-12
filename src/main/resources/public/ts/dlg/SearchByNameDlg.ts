import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { TextContent } from "../widget/TextContent";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { Form } from "../widget/Form";
import { MessageDlg } from "./MessageDlg";
import { AppState } from "../AppState";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchByNameDlg extends DialogBase {

    static defaultSearchText: string = "";
    searchTextField: TextField;
  
    constructor(state: AppState) {
        super("Search by Node Name", "app-modal-content-medium-width", false, state);
    }

    //renderDlg(): CompIntf[] {
    preRender = () => {
        this.setChildren([
            new Form(null, [
                new TextContent("All sub-nodes under the selected node will be searched."),
                this.searchTextField = new TextField("Node Name", SearchByNameDlg.defaultSearchText, false, this.search),
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
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }

        // until better validation, just check for empty
        let searchText = this.searchTextField.getValue();
        if (!searchText) {
            S.util.showMessage("Enter search text.", "Warning");
            return;
        }

        SearchByNameDlg.defaultSearchText = searchText;

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            nodeId: node.id,
            searchText,
            sortDir: "",
            sortField: "",
            searchProp: "node.name",
            fuzzy: false,
            caseSensitive: false,
            searchDefinition: ""
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


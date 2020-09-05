import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
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

export class SearchByIDDlg extends DialogBase {

    static defaultSearchText: string = "";
    searchTextField: TextField;

    constructor(state: AppState) {
        super("Search by Node ID", "app-modal-content-medium-width", false, state);
        this.whenElm((elm: HTMLSelectElement) => {
            this.searchTextField.focus();
        });
        
        this.mergeState({
            searchText: SearchByIDDlg.defaultSearchText
        });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("All sub-nodes under the selected node will be searched."),
                this.searchTextField = new TextField("Node ID", false, this.search,
                    new CompValueHolder<string>(this, "searchText")),
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
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
        let searchText = this.getState().searchText;
        if (!searchText) {
            S.util.showMessage("Enter search text.", "Warning");
            return;
        }

        SearchByIDDlg.defaultSearchText = searchText;

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            nodeId: node.id,
            searchText,
            sortDir: "",
            sortField: "",
            searchProp: "node.id",
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

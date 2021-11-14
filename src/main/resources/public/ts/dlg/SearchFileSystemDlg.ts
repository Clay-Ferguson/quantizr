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
import { Form } from "../widget/Form";
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchFileSystemDlg extends DialogBase {
    static defaultSearchText: string = "";
    searchTextField: TextField;
    searchTextState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Search File System", null, false, state);
        this.whenElm((elm: HTMLElement) => {
            this.searchTextField.focus();
        });
        this.searchTextState.setValue(SearchFileSystemDlg.defaultSearchText);
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
                new TextContent("Enter text to find. Only content text will be searched. All sub-nodes under the selected node are included in the search."),
                this.searchTextField = new TextField("Search", null, () => this.searchNodes(this.appState), null, false,
                    this.searchTextState),
                new ButtonBar([
                    new Button("Search", this.searchNodes),
                    new Button("Close", this.close)
                ], "marginTop")
            ])
        ];
    }

    searchNodes = async (state: AppState) => {
        if (!this.validate()) {
            return;
        }

        if (!S.util.ajaxReady("searchNodes")) {
            return;
        }

        // until we have better validation
        let node = S.quanta.getHighlightedNode(state);
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }

        SearchFileSystemDlg.defaultSearchText = this.searchTextState.getValue();

        let res: J.LuceneSearchResponse = await S.util.ajax<J.LuceneSearchRequest, J.LuceneSearchResponse>("luceneSearch", {
            nodeId: node.id,
            text: SearchFileSystemDlg.defaultSearchText
        });
        this.searchNodesResponse(res);
    }

    searchNodesResponse = (res: J.LuceneSearchResponse) => {
        S.util.showMessage(res.message, "Note", true, "modal-lg");
        this.close();
    }
}

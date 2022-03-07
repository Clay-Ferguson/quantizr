import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { TextContent } from "../comp/core/TextContent";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

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
                this.searchTextField = new TextField({
                    label: "Search",
                    enter: () => this.searchNodes(this.appState),
                    val: this.searchTextState
                }),
                new ButtonBar([
                    new Button("Search", this.searchNodes),
                    new Button("Close", this.close, null, "btn-secondary float-end")
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
        let node = S.nodeUtil.getHighlightedNode(state);
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
        S.util.showMessage(res.message, "Note", true);
        this.close();
    }
}

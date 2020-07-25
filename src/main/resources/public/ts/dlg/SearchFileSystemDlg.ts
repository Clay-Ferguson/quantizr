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
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";
import { CompValueHolder } from "../CompValueHolder";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchFileSystemDlg extends DialogBase {

    static defaultSearchText: string = "";
    searchTextField: TextField;

    constructor(state: AppState) {
        super("Search File System", null, false, state);
        this.whenElm((elm: HTMLSelectElement) => {
            this.searchTextField.focus();
        });
    }

    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                new TextContent("Enter text to find. Only content text will be searched. All sub-nodes under the selected node are included in the search."),
                this.searchTextField = new TextField("Search", SearchFileSystemDlg.defaultSearchText, null, () => this.searchNodes(this.appState),
                    new CompValueHolder<string>(this, "searchText")),
                new ButtonBar([
                    new Button("Search", this.searchNodes),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ];
        return children;
    }

    renderButtons(): CompIntf {
        return null;
    }

    searchNodes = (state: AppState): void => {
        if (!S.util.ajaxReady("searchNodes")) {
            return;
        }

        // until we have better validation
        let node = S.meta64.getHighlightedNode(state);
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

        SearchFileSystemDlg.defaultSearchText = searchText;

        S.util.ajax<J.LuceneSearchRequest, J.LuceneSearchResponse>("luceneSearch", {
            nodeId: node.id,
            text: searchText
        }, this.searchNodesResponse);
    }

    searchNodesResponse = (res: J.NodeSearchResponse) => {
        S.util.showMessage(res.message, "Note", true, "modal-lg");
        this.close();
    }

}


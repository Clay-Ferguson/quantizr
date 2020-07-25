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
import { Checkbox } from "../widget/Checkbox";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchContentDlg extends DialogBase {

    static defaultSearchText: string = "";
    searchTextField: TextField;
  
    constructor(state: AppState) {
        super("Search Content", "app-modal-content-medium-width", null, state);
        S.srch.searchText = null;
        this.whenElm((elm: HTMLSelectElement) => {
            this.searchTextField.focus();
        });

        this.mergeState({
            fuzzy: false,
            caseSensitive: false
        })
    }

    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                new TextContent("All sub-nodes under the selected node will be searched."),
                //todo-0: use CompValueHolder
                this.searchTextField = new TextField("Search", SearchContentDlg.defaultSearchText, false, this.search),
                new HorizontalLayout([
                    new Checkbox("Fuzzy Search (slower)", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({fuzzy: checked});
                        },
                        getValue: (): boolean => {
                            return this.getState().fuzzy;
                        }
                    }),
                    new Checkbox("Case Sensitive", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({caseSensitive: checked});
                        },
                        getValue: (): boolean => {
                            return this.getState().caseSensitive;
                        }
                    })
                ], "marginBottom"),
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
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
        S.srch.searchText = searchText;
        if (!searchText) {
            S.util.showMessage("Enter search text.", "Warning");
            return;
        }

        SearchContentDlg.defaultSearchText = searchText;

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            nodeId: node.id,
            searchText,
            sortDir: "",
            sortField: "",
            searchProp: "",
            fuzzy: this.getState().fuzzy,
            caseSensitive: this.getState().caseSensitive,
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


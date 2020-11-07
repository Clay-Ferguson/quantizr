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
import { Checkbox } from "../widget/Checkbox";
import { Form } from "../widget/Form";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { TextContent } from "../widget/TextContent";
import { TextField } from "../widget/TextField";
import { MessageDlg } from "./MessageDlg";

let S: Singletons;
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
            caseSensitive: false,
            searchText: SearchContentDlg.defaultSearchText
        });
    }

    validate = (): boolean => {
        let valid = true;
        let errors: any = {};
        let state = this.getState();

        if (!state.searchText) {
            valid = false;
            errors.searchTextValidationError = "Enter something to search for.";
        }
        else {
            errors.searchTextValidationError = null;
        }

        if (!valid) {
            this.mergeState(errors);
        }

        return valid;
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent("All sub-nodes under the selected node will be searched."),
                this.searchTextField = new TextField("Search", false, this.search, null, false,
                    new CompValueHolder<string>(this, "searchText")),
                new HorizontalLayout([
                    new Checkbox("Fuzzy Search (slower)", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({ fuzzy: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState().fuzzy;
                        }
                    }),
                    new Checkbox("Case Sensitive", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({ caseSensitive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState().caseSensitive;
                        }
                    })
                ], "marginBottom"),
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
                    new Button("Graph", this.graph, null, "btn-primary"),
                    new Button("Close", this.close)
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    graph = () => {
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

        // until better validation, just check for empty
        let searchText = this.getState().searchText;

        this.close();
        S.render.showGraph(null, searchText, this.appState);
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

        // until better validation, just check for empty
        let searchText = this.getState().searchText;
        S.srch.searchText = searchText;

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

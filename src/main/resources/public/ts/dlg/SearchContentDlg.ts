import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Checkbox } from "../widget/Checkbox";
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { HelpButton } from "../widget/HelpButton";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { Selection } from "../widget/Selection";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchContentDlg extends DialogBase {
    static defaultSearchText: string = "";
    searchTextField: TextField;
    searchTextState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Search", "app-modal-content-medium-width", null, state);

        this.whenElm((elm: HTMLElement) => {
            this.searchTextField.focus();
        });

        this.mergeState({
            fuzzy: false,
            caseSensitive: false,
            recursive: true,
            sortField: "0",
            sortDir: ""
        });
        this.searchTextState.setValue(SearchContentDlg.defaultSearchText);
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
                this.searchTextField = new TextField("Search", false, this.search, null, false, this.searchTextState),
                new HorizontalLayout([
                    // Allow fuzzy search for admin only. It's cpu intensive.
                    this.appState.isAdminUser ? new Checkbox("Fuzzy Search (slower)", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({ fuzzy: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState().fuzzy;
                        }
                    }) : null,
                    new Checkbox("Case Sensitive", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({ caseSensitive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState().caseSensitive;
                        }
                    }),
                    new Checkbox("Recursive", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState({ recursive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState().recursive;
                        }
                    })
                ], "displayTable marginBottom"),
                new Div(null, null, [
                    new Selection(null, "Sort by", [
                        { key: "0", val: "Relevance" },
                        { key: "ctm", val: "Create Time" },
                        { key: "mtm", val: "Modify Time" },
                        { key: "contentLength", val: "Text Length" }
                    ], "m-2", "searchDlgOrderBy", {
                        setValue: (val: string): void => {
                            this.mergeState({
                                sortField: val,
                                sortDir: val === "0" ? "" : "DESC"
                            });
                        },
                        getValue: (): string => {
                            return this.getState().sortField;
                        }
                    })]),
                new HelpButton(() => S.quanta?.config?.help?.search?.dialog),
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
                    new Button("Graph", this.graph, null, "btn-primary"),
                    new Button("Close", this.close)
                ])
            ])
        ];
    }

    graph = () => {
        if (!this.validate()) {
            return;
        }

        if (!S.util.ajaxReady("searchNodes")) {
            return;
        }

        // until we have better validation
        let node = S.quanta.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }

        SearchContentDlg.defaultSearchText = this.searchTextState.getValue();

        this.close();
        S.render.showGraph(null, SearchContentDlg.defaultSearchText, this.appState);
    }

    search = () => {
        if (!this.validate()) {
            return;
        }

        if (!S.util.ajaxReady("searchNodes")) {
            return;
        }

        // until we have better validation
        let node = S.quanta.getHighlightedNode(this.appState);
        if (!node) {
            S.util.showMessage("No node is selected to search under.", "Warning");
            return;
        }

        SearchContentDlg.defaultSearchText = this.searchTextState.getValue();

        let desc = "Content: " + SearchContentDlg.defaultSearchText;
        S.srch.search(node, null, SearchContentDlg.defaultSearchText, this.appState, null, desc, this.getState().fuzzy,
            this.getState().caseSensitive, 0,
            this.getState().recursive,
            this.getState().sortField,
            this.getState().sortDir,
            this.close);
    }
}

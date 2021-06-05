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
import { Checkbox } from "../widget/Checkbox";
import { CollapsibleHelpPanel } from "../widget/CollapsibleHelpPanel";
import { Form } from "../widget/Form";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { RadioButton } from "../widget/RadioButton";
import { RadioButtonGroup } from "../widget/RadioButtonGroup";
import { TextField } from "../widget/TextField";
import { MessageDlg } from "./MessageDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class SearchUsersDlg extends DialogBase {
    static helpExpanded: boolean = false;
    static defaultSearchText: string = "";
    searchTextField: TextField;
    searchTextState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Search Users", "app-modal-content-medium-width", null, state);
        S.srch.searchText = null;

        this.whenElm((elm: HTMLElement) => {
            this.searchTextField.focus();
        });

        this.mergeState({
            fuzzy: false,
            userSearchType: "local",
            caseSensitive: false
        });
        this.searchTextState.setValue(SearchUsersDlg.defaultSearchText);
    }

    validate = (): boolean => {
        return true;
    }

    renderDlg(): CompIntf[] {
        let adminOptions = null;

        adminOptions = new RadioButtonGroup([
            this.appState.isAdminUser ? new RadioButton("Search All Users", false, "optionsGroup", null, {
                setValue: (checked: boolean): void => {
                    if (checked) {
                        this.mergeState({ userSearchType: "all" });
                    }
                },
                getValue: (): boolean => {
                    return this.getState().userSearchType === "all";
                }
            }) : null,
            new RadioButton("Search Local Users", true, "optionsGroup", null, {
                setValue: (checked: boolean): void => {
                    if (checked) {
                        this.mergeState({ userSearchType: "local" });
                    }
                },
                getValue: (): boolean => {
                    return this.getState().userSearchType === "local";
                }
            }),
            new RadioButton("Search Foreign Users", false, "optionsGroup", null, {
                setValue: (checked: boolean): void => {
                    if (checked) {
                        this.mergeState({ userSearchType: "foreign" });
                    }
                },
                getValue: (): boolean => {
                    return this.getState().userSearchType === "foreign";
                }
            })
        ], "marginBottom");

        return [
            new Form(null, [
                this.searchTextField = new TextField("User Name", false, this.search, null, false, this.searchTextState),
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
                    })
                ], "marginBottom"),
                adminOptions,
                new CollapsibleHelpPanel("Help", S.meta64.config.help.search.dialog,
                    (state: boolean) => {
                        SearchUsersDlg.helpExpanded = state;
                    }, SearchUsersDlg.helpExpanded),
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
                    // this Graph button will work, but why graph users? ... there are no linkages between them... yet.
                    // todo-1: however the VERY amazing feature of showing a true "Graph of Who is Following Who" would be
                    // possible and not even all that difficult based on the existing code already written.
                    // new Button("Graph", this.graph, null, "btn-primary"),
                    // we can steal the 'graph' from from the other dialogs when needed.
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

        SearchUsersDlg.defaultSearchText = S.srch.searchText = this.searchTextState.getValue();

        S.util.ajax<J.NodeSearchRequest, J.NodeSearchResponse>("nodeSearch", {
            nodeId: node.id,
            searchText: SearchUsersDlg.defaultSearchText,
            sortDir: "DESC",
            sortField: "mtm",
            searchProp: "",
            fuzzy: this.getState().fuzzy,
            caseSensitive: this.getState().caseSensitive,
            userSearchType: this.getState().userSearchType,
            searchDefinition: "",
            timeRangeType: null
        }, (res) => this.searchNodesResponse(res, node));
    }

    searchNodesResponse = (res: J.NodeSearchResponse, node: J.NodeInfo) => {
        if (S.srch.numSearchResults(res) > 0) {
            let desc = "Search of Users for: " + SearchUsersDlg.defaultSearchText;
            S.srch.searchNodesResponse(res, desc, true, node);
            this.close();
        }
        else {
            new MessageDlg("No search results found.", "Search", null, null, false, 0, this.appState).open();
        }
    }
}

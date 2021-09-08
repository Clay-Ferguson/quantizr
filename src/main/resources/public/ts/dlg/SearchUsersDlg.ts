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
import { Form } from "../widget/Form";
import { HelpButton } from "../widget/HelpButton";
import { HorizontalLayout } from "../widget/HorizontalLayout";
import { RadioButton } from "../widget/RadioButton";
import { RadioButtonGroup } from "../widget/RadioButtonGroup";
import { TextField } from "../widget/TextField";

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
        super("Search", "app-modal-content-medium-width", null, state);

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
                ], "displayTable marginBottom"),
                adminOptions,
                new HelpButton(() => S.quanta?.config?.help?.search?.dialog),
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

        SearchUsersDlg.defaultSearchText = this.searchTextState.getValue();

        let desc = "User " + SearchUsersDlg.defaultSearchText;
        S.srch.search(null, "", SearchUsersDlg.defaultSearchText, this.appState, this.getState().userSearchType, desc,
            this.getState().fuzzy,
            this.getState().caseSensitive, 0, true, "mtm", "DESC", this.close);
    }
}

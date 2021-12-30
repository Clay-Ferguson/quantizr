import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Form } from "../comp/core/Form";
import { HelpButton } from "../comp/core/HelpButton";
import { HorizontalLayout } from "../comp/core/HorizontalLayout";
import { RadioButton } from "../comp/core/RadioButton";
import { RadioButtonGroup } from "../comp/core/RadioButtonGroup";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

interface LS { // Local State
    fuzzy?: boolean;
    searchType?: string;
    caseSensitive?: boolean;
}

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

        this.mergeState<LS>({
            fuzzy: false,
            searchType: J.Constant.SEARCH_TYPE_USER_LOCAL,
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
            this.appState.isAdminUser ? new RadioButton("All Users", false, "optionsGroup", null, {
                setValue: (checked: boolean): void => {
                    if (checked) {
                        this.mergeState<LS>({ searchType: J.Constant.SEARCH_TYPE_USER_ALL });
                    }
                },
                getValue: (): boolean => {
                    return this.getState<LS>().searchType === J.Constant.SEARCH_TYPE_USER_ALL;
                }
            }) : null,
            new RadioButton("Local Users", true, "optionsGroup", null, {
                setValue: (checked: boolean): void => {
                    if (checked) {
                        this.mergeState<LS>({ searchType: J.Constant.SEARCH_TYPE_USER_LOCAL });
                    }
                },
                getValue: (): boolean => {
                    return this.getState<LS>().searchType === J.Constant.SEARCH_TYPE_USER_LOCAL;
                }
            }),
            new RadioButton("Foreign Users", false, "optionsGroup", null, {
                setValue: (checked: boolean): void => {
                    if (checked) {
                        this.mergeState<LS>({ searchType: J.Constant.SEARCH_TYPE_USER_FOREIGN });
                    }
                },
                getValue: (): boolean => {
                    return this.getState<LS>().searchType === J.Constant.SEARCH_TYPE_USER_FOREIGN;
                }
            })
        ], "marginBottom");

        return [
            new Form(null, [
                this.searchTextField = new TextField("User Name", false, this.search, null, false, this.searchTextState),
                new HorizontalLayout([
                    // Allow fuzzy search for admin only. It's cpu intensive.
                    new Checkbox("Regex", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState<LS>({ fuzzy: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState<LS>().fuzzy;
                        }
                    }),
                    new Checkbox("Case Sensitive", null, {
                        setValue: (checked: boolean): void => {
                            this.mergeState<LS>({ caseSensitive: checked });
                        },
                        getValue: (): boolean => {
                            return this.getState<LS>().caseSensitive;
                        }
                    })
                ], "displayTable marginBottom"),
                adminOptions,
                new ButtonBar([
                    new Button("Search", this.search, null, "btn-primary"),
                    new HelpButton(() => S.quanta?.config?.help?.search?.dialog),
                    // this Graph button will work, but why graph users? ... there are no linkages between them... yet.
                    // todo: however the VERY amazing feature of showing a true "Graph of Who is Following Who" would be
                    // possible and not even all that difficult based on the existing code already written.
                    // new Button("Graph", this.graph, null, "btn-primary"),
                    // we can steal the 'graph' from from the other dialogs when needed.
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
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
        S.srch.search(null, "", SearchUsersDlg.defaultSearchText, this.appState, this.getState<LS>().searchType, desc,
            this.getState<LS>().fuzzy,
            this.getState<LS>().caseSensitive, 0, true, "mtm", "DESC", false, this.close);
    }
}

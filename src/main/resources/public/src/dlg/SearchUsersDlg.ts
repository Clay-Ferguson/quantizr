import { getAs } from "../AppContext";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator } from "../Validator";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";

interface LS { // Local State
}

export class SearchUsersDlg extends DialogBase {
    static helpExpanded: boolean = false;
    static defaultSearchText: string = "";
    searchTextField: TextField;
    searchTextState: Validator = new Validator();

    constructor() {
        super("Search Users", "appModalContMediumWidth");
        this.onMount(() => this.searchTextField?.focus());
        this.mergeState<LS>({});
        this.searchTextState.setValue(SearchUsersDlg.defaultSearchText);
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                getAs().isAdminUser ? new Div("Enter a username to find, or search by email using `email:` prefix in front of the email address", { className: "bigMarginBottom" }) : null,
                this.searchTextField = new TextField({ label: "User", enter: this._search, val: this.searchTextState }),
                new ButtonBar([
                    new Button("Search", this._search, null, "-primary"),
                    // this Graph button will work, but why graph users? ... there are no linkages
                    // between them... yet. todo: however the VERY amazing feature of showing a true
                    // "Graph of Who is Following Who" would be possible and not even all that
                    // difficult based on the existing code already written.
                    // new Button("Graph", this.graph, null, "-primary"),
                    // we can steal the 'graph' from from the other dialogs when needed.
                    new Button("Close", this._close, null, "tw-float-right")
                ], "marginTop")
            ])
        ];
    }

    _search = async () => {
        if (!this.validate()) {
            return;
        }
        SearchUsersDlg.defaultSearchText = this.searchTextState.getValue();

        const desc = "User " + SearchUsersDlg.defaultSearchText;
        const success = await S.srch.search(null, "", SearchUsersDlg.defaultSearchText,
            J.Constant.SEARCH_TYPE_USERS,
            desc,
            null,
            false,
            false, 0, true, "mtm", "DESC", false, false, false, false, false);
        if (success) {
            this.close();
        }
    }
}

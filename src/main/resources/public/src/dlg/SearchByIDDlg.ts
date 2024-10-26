import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";

export class SearchByIDDlg extends DialogBase {

    static defaultSearchText: string = "";
    searchTextField: TextField;
    searchTextState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor() {
        super("Search for Node ID", "appModalContMediumWidth");
        this.onMount(() => this.searchTextField?.focus());
        this.searchTextState.setValue(SearchByIDDlg.defaultSearchText);
        this.validatedStates = [this.searchTextState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                this.searchTextField = new TextField({ label: "Node ID", enter: this._search, val: this.searchTextState }),
                new ButtonBar([
                    new Button("Search", this._search, null, "-primary"),
                    new Button("Close", this._close, null, "tw-float-right")
                ], "mt-3")
            ])
        ];
    }

    _search = async () => {
        if (!this.validate()) {
            return;
        }

        SearchByIDDlg.defaultSearchText = this.searchTextState.getValue();

        const desc = "For ID: " + SearchByIDDlg.defaultSearchText;
        const success = await S.srch.search(null, "node.id", SearchByIDDlg.defaultSearchText, null, desc, null, false,
            false, 0, true, null, null, false, false, false, false, false);
        if (success) {
            this.close();
        }
    }
}

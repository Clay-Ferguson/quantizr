import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Markdown } from "../comp/core/Markdown";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";

export class ConfirmDlg extends DialogBase {
    yes: boolean = false;

    // Note: if textClass is "[markdown]" we display as markdown
    constructor(private text: string, title: string, private yesButtonClass: string = null, private textClass: string = null, private showNoButton: boolean = true) {
        super(title, "appModalContNarrowWidth");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                this.textClass == "[markdown]" ? new Markdown(this.text) : new TextContent(this.text, this.textClass),
                new ButtonBar([
                    new Button("Yes", () => {
                        this.yes = true;
                        this.close();
                    }, null, this.yesButtonClass || "-primary"),
                    this.showNoButton ? new Button("No", this._close) : null
                ], "mt-3")
            ])
        ];
    }
}

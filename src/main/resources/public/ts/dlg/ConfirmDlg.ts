import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextContent } from "../widget/TextContent";

export class ConfirmDlg extends DialogBase {

    yes: boolean = false;

    constructor(private text: string, title: string, private yesButtonClass: string, private textClass: string, state: AppState) {
        super(title, "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent(this.text, this.textClass),
                new ButtonBar([
                    new Button("Yes", () => {
                        // note: Important to set answer here before closing (closing resolves a promise)
                        this.yes = true;
                        this.close();
                    }, null, this.yesButtonClass || "btn-primary"),
                    new Button("No", this.close)
                ], "marginTop")
            ])
        ];
    }
}

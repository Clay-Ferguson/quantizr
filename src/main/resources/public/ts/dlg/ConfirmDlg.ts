import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";

export class ConfirmDlg extends DialogBase {
    yes: boolean = false;

    constructor(private text: string, title: string, private yesButtonClass: string, private textClass: string) {
        super(title, "app-modal-content-narrow-width", false);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent(this.text, this.textClass),
                new ButtonBar([
                    new Button("Yes", () => {
                        this.yes = true;
                        this.close();
                    }, null, this.yesButtonClass || "btn-primary"),
                    new Button("No", this.close)
                ], "marginTop")
            ])
        ];
    }
}

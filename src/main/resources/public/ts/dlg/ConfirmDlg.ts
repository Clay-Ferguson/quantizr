import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextContent } from "../widget/TextContent";

// todo-0: now that we support setting the 'yes' property we can
// refactor to not use the yes/no callbacks any more.
export class ConfirmDlg extends DialogBase {

    yes: boolean = false;

    constructor(private text: string, title: string, private yesCallback: Function,
        private noCallback: Function, private yesButtonClass, private textClass: string, state: AppState) {
        super(title, "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent(this.text, this.textClass),
                new ButtonBar([
                    new Button("Yes", () => {
                        if (this.yesCallback) this.yesCallback();
                        // note: Important to set answer here before closing (closing resolves a promise)
                        this.yes = true;
                        this.close();
                    }, null, this.yesButtonClass || "btn-primary"),
                    new Button("No", this.noCallback ? () => {
                        if (this.noCallback) this.noCallback();
                        this.yes = false;
                        this.close();
                    } : this.close)
                ], "marginTop")
            ])
        ];
    }
}

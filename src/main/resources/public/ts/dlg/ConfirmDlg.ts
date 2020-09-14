import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextContent } from "../widget/TextContent";

export class ConfirmDlg extends DialogBase {

    constructor(private text: string, title: string, private yesCallback: Function,
        private noCallback: Function, private yesButtonClass, private textClass:string, state: AppState) {
        super(title, "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent(this.text, this.textClass),
                new ButtonBar([
                    new Button("Yes", () => {
                        this.close();
                        this.yesCallback();
                    }, null, this.yesButtonClass || "btn-primary"),
                    new Button("No", this.noCallback ? () => {
                        this.noCallback();
                        this.close();
                    } : this.close)
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }
}

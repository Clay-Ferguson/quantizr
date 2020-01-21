import { DialogBase } from "../DialogBase";
import { TextContent } from "../widget/TextContent";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Form } from "../widget/Form";

export class ConfirmDlg extends DialogBase {

    constructor(private text: string, title: string, private yesCallback: Function, private noCallback: Function = null) {
        super(title);

        let yesButton: Button;

        this.setChildren([
            new Form(null, [
                new TextContent(text),
                new ButtonBar([
                    yesButton = new Button("Yes", () => {
                        this.close();
                        this.yesCallback();
                    }, null, "primary"),
                    new Button("No", this.noCallback ? () => {
                        this.noCallback();
                        this.close();
                    } : this.close)
                ])
            ])
        ]);
    }
}

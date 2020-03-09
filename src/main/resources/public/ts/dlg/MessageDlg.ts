import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextContent } from "../widget/TextContent";
import { Comp } from "../widget/base/Comp";
import { DialogBase } from "../DialogBase";

/*
 * Callback can be null if you don't need to run any function when the dialog is closed
 */
export class MessageDlg extends DialogBase {

    constructor(private message: string, title: string, private callback : Function=null, customWidget: Comp=null, private preformatted: boolean = false,
        flashTimeout: number=0) { 
        super(title);

        this.setChildren([
            new TextContent(this.message, null, this.preformatted),
            customWidget,
            flashTimeout == 0 ? new ButtonBar([
                new Button("Ok", () => {
                    this.close();

                    if (this.callback) {
                        this.callback();
                    }
                }, null, "primary")
            ]) : null
        ]);

        if (flashTimeout > 0) {
            setTimeout(() => {
                this.whenElmEx((elm: HTMLElement) => {
                    this.close();
                });
            }, flashTimeout);
        }
    }
}

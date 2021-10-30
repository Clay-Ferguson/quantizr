import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { Comp } from "../widget/base/Comp";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { TextContent } from "../widget/TextContent";

/*
 * Callback can be null if you don't need to run any function when the dialog is closed
 */
export class MessageDlg extends DialogBase {

    constructor(private message: string, title: string, private callback: Function, private customWidget: Comp, private preformatted: boolean,
        private flashTimeout: number, state: AppState) {
        super(title, null, false, state);

        if (this.flashTimeout > 0) {
            setTimeout(() => {
                this.whenElmEx((elm: HTMLElement) => {
                    this.close();
                });
            }, this.flashTimeout);
        }
    }

    renderDlg = (): CompIntf[] => {
        return [
            this.message ? new TextContent(this.message, null, this.preformatted) : null,
            this.customWidget,
            this.flashTimeout === 0 ? new ButtonBar([
                new Button("Ok", () => {
                    this.close();

                    if (this.callback) {
                        this.callback();
                    }
                }, null, "btn-primary")
            ], "marginTop") : null
        ];
    }
}

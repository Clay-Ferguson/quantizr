import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextContent } from "../widget/TextContent";
import { Comp } from "../widget/base/Comp";
import { DialogBase } from "../DialogBase";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

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
            new TextContent(this.message, null, this.preformatted),
            this.customWidget,
            this.flashTimeout == 0 ? new ButtonBar([
                new Button("Ok", () => {
                    this.close();

                    if (this.callback) {
                        this.callback();
                    }
                }, null, "btn-primary")
            ]) : null
        ];
    }
}

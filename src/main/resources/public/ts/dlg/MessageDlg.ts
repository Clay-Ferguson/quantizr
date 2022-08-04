import { Comp } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";

/*
 * Callback can be null if you don't need to run any function when the dialog is closed
 */
export class MessageDlg extends DialogBase {

    constructor(private message: string, title: string, private callback: Function, private customWidget: Comp, private preformatted: boolean,
        private flashTimeout: number, classOverride: string) {
        super(title, classOverride);

        if (this.flashTimeout > 0) {
            setTimeout(() => {
                if (this.mounted) {
                    this.close();
                }
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

import { Comp } from "../comp/base/Comp";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";

/*
 * Notification Dialog that pops up and displays for a short time and then automatically destroys
 * itself
 */
export class NotificationPopupDlg extends DialogBase {

    constructor(private message: string, title: string) {
        super(title);
    }

    renderDlg(): Comp[] {
        return [
            new TextContent(this.message)
        ];
    }

    show(message: string, title: string, timeout: number = 3000) {
        const dlg = new NotificationPopupDlg(message, title);
        dlg.open();
        setTimeout(dlg._close, timeout);
    }
}

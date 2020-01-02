import { TextContent } from "../widget/TextContent";
import { DialogBase } from "../DialogBase";

/*
 * Notification Dialog that pops up and displays for a short time and then automatically destroys itself
 */
export class NotificationPopupDlg extends DialogBase {

    constructor(private message: string, title: string) {
        super(title);

        this.setChildren([
            new TextContent(this.message),
        ]);
    }

    static show(message: string, title: string, timeout: number=3000) {
        let dlg = new NotificationPopupDlg(message, title);
        dlg.open();
        setTimeout(() => {
            dlg.close();
        }, timeout);
    }
}

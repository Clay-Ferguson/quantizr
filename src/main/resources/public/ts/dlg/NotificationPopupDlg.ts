import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../widget/base/CompIntf";
import { TextContent } from "../widget/TextContent";

/*
 * Notification Dialog that pops up and displays for a short time and then automatically destroys itself
 */
export class NotificationPopupDlg extends DialogBase {

    constructor(private message: string, title: string, state: AppState) {
        super(title, null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new TextContent(this.message)
        ];
    }
    
    show(message: string, title: string, timeout: number = 3000) {
        let dlg = new NotificationPopupDlg(message, title, this.appState);
        dlg.open();
        setTimeout(() => {
            dlg.close();
        }, timeout);
    }
}

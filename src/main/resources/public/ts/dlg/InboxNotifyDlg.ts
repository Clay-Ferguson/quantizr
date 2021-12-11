import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";

export class InboxNotifyDlg extends DialogBase {

    static CLOSE_TIMEOUT: number = 2500;

    constructor(private text: string, private nodeId: string, state: AppState) {
        super("Notification", "app-modal-content-narrow-width", false, state);

        S.util.showSystemNotification("New Message", text);

        // setTimeout(() => {
        //     this.whenElmEx((elm: HTMLElement) => {
        //         this.close();
        //     });
        // }, InboxNotifyDlg.CLOSE_TIMEOUT);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent(this.text),
                new ButtonBar([
                    this.nodeId ? new Button("Go to Node", () => {
                        this.close();
                        S.nav.openContentNode(this.nodeId, this.appState);
                    }) : null,
                    new Button("Close", this.close)
                ], "marginTop")
            ])
        ];
    }
}

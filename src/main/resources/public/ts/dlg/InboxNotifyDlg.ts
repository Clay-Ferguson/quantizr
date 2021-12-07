import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/Button";
import { ButtonBar } from "../comp/ButtonBar";
import { Form } from "../comp/Form";
import { TextContent } from "../comp/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class InboxNotifyDlg extends DialogBase {

    static CLOSE_TIMEOUT: number = 2500;

    constructor(private text: string, private nodeId: string, state: AppState) {
        super("Notification", "app-modal-content-narrow-width", false, state);

        S.quanta.showSystemNotification("New Message", text);

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

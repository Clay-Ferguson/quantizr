import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextContent } from "../widget/TextContent";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class InboxNotifyDlg extends DialogBase {

    static CLOSE_TIMEOUT: number = 2500;

    constructor(private text: string, private nodeId: string, state: AppState) {
        super("Notification", "app-modal-content-narrow-width", false, state);

        S.meta64.showSystemNotification("New Message", text);

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
                ])
            ])
        ];
    }
}

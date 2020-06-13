import { DialogBase } from "../DialogBase";
import { TextContent } from "../widget/TextContent";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { Form } from "../widget/Form";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Constants as C } from "../Constants";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class InboxNotifyDlg extends DialogBase {

    static CLOSE_TIMEOUT: number = 2500;

    constructor(private text: string, state: AppState) {
        super("Notification", "app-modal-content-narrow-width", false, state);

        setTimeout(() => {
            this.whenElmEx((elm: HTMLElement) => {
                this.close();
            });
        }, InboxNotifyDlg.CLOSE_TIMEOUT);
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextContent(this.text),
                // new ButtonBar([
                //     new Button("Go to Inbox", () => {
                //         this.close();
                //         S.nav.openContentNode(this.appState.homeNodePath + "/inbox", this.appState);
                //     }),
                //     new Button("No thanks", () => {
                //         this.close();
                //     })
                // ])
            ])
        ];
    }
}

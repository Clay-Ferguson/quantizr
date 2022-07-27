import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Form } from "../comp/core/Form";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";

export class InboxNotifyDlg extends DialogBase {

    static CLOSE_TIMEOUT: number = 2500;

    constructor(private text: string, private nodeId: string) {
        super("Notification", "app-modal-content-narrow-width", false);

        S.util.showSystemNotification("New Message", text);

        // setTimeout(() => {
        //     this.onMount((elm: HTMLElement) => {
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
                        S.nav.openContentNode(this.nodeId, getAppState());
                    }) : null,
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop"),
                new Clearfix() // required in case only ButtonBar children are float-end, which would break layout
            ])
        ];
    }
}

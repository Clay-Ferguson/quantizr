import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";

export class InboxNotifyDlg extends DialogBase {

    static CLOSE_TIMEOUT: number = 2500;

    constructor(private text: string, private nodeId: string) {
        super("Notification", "appModalContNarrowWidth");

        S.util.showSystemNotification("New Message", text);

        // setTimeout(() => {
        //     this.onMount(() => {
        //         this.close();
        //     });
        // }, InboxNotifyDlg.CLOSE_TIMEOUT);
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextContent(this.text),
                new ButtonBar([
                    this.nodeId ? new Button("Go to Node", () => {
                        this.close();
                        S.nav.openContentNode(this.nodeId, false);
                    }) : null,
                    new Button("Close", this._close, null, "tw-float-right")
                ], "mt-3"),
                new Clearfix() // required in case only ButtonBar children are tw-float-right, which would break layout
            ])
        ];
    }
}

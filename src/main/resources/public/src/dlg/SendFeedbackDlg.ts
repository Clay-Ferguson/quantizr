import { DialogBase } from "../DialogBase";
import { Validator } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import * as J from "../JavaIntf";
import { NodeInfo } from "../JavaIntf";
import { S } from "../Singletons";
import { Constants as C } from "../Constants";

export class SendFeedbackDlg extends DialogBase {
    static promptState: Validator = new Validator();
    promptScrollPos = new ScrollPos();

    constructor(public node: NodeInfo) {
        super("Send Feedback");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new Div("Send a message directly to the site operators and developers. Any feedback, both positive and negative, is welcome. Include you're email address if you're requesting information.", { className: "marginBottom" }),
                new TextArea("Your Question or Comments", {
                    rows: 7,
                }, SendFeedbackDlg.promptState, null, false, 3, this.promptScrollPos),
                new ButtonBar([
                    new Button("Send", this.send, null, "btn-primary"),
                    new Button("Cancel", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    send = async () => {
        const res = await S.rpcUtil.rpc<J.SendFeedbackRequest, J.SendFeedbackResponse>("sendFeedback", {
            message: SendFeedbackDlg.promptState.getValue()
        });

        this.close();

        if (res.code === C.RESPONSE_CODE_OK) {
            S.util.showMessage("Feedback sent. Thank you!");
        }
    }
}

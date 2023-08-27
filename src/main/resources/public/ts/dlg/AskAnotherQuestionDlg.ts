import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Constants as C } from "../Constants";
import { Validator, ValidatorRuleName } from "../Validator";
import { ScrollPos } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Diva } from "../comp/core/Diva";
import { TextArea } from "../comp/core/TextArea";

export class AskAnotherQuestionDlg extends DialogBase {
    questionState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED },
        { name: ValidatorRuleName.MINLEN, payload: 10 }
    ]);
    textScrollPos = new ScrollPos();

    constructor(public nodeId: string) {
        super("Ask Another Question", "appModalContMediumWidth");
    }

    renderDlg(): CompIntf[] {
        return [
            new Diva([
                new TextArea("Ask away...", { rows: 15 }, this.questionState, null, false, 3, this.textScrollPos),
                new ButtonBar([
                    new Button("Submit Question", this.askQuestion, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    askQuestion = async (): Promise<J.CreateSubNodeResponse> => {
        if (!this.validate()) {
            return;
        }
        const res = await S.rpcUtil.rpc<J.CreateSubNodeRequest, J.CreateSubNodeResponse>("createSubNode", {
            pendingEdit: false,
            nodeId: this.nodeId,
            openAiQuestion: true,
            newNodeName: "",
            typeName: J.NodeType.NONE,
            createAtTop: true,
            content: this.questionState.getValue(),
            typeLock: false,
            properties: null,
            shareToUserId: null,
            boostTarget: null,
            fediSend: false,
            boosterUserId: null,
            reply: false,
            directMessage: false
        });

        this.close();

        if (res.code == C.RESPONSE_CODE_OK) {
            S.view.jumpToId(res.newNode.id);
        }
        return res;
    }
}

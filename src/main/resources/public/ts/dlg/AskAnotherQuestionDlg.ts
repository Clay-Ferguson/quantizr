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
import { GptAnswerDlg } from "./GptAnswerDlg";
import { dispatch } from "../AppContext";

export class AskAnotherQuestionDlg extends DialogBase {
    questionState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED },
        { name: ValidatorRuleName.MINLEN, payload: 10 }
    ]);
    textScrollPos = new ScrollPos();
    textArea: TextArea;

    constructor(public nodeId: string, private subGraphQuery: boolean) {
        super(subGraphQuery ? "Question about SubGraph" : "Ask Another Question", "appModalContMediumWidth");
        this.onMount(() => { this.textArea?.focus(); });
    }

    renderDlg(): CompIntf[] {
        return [
            new Diva([
                this.textArea = new TextArea("Ask a Question...", { rows: 15 }, this.questionState, null, false, 3, this.textScrollPos),
                new ButtonBar([
                    new Button("Submit", this.askQuestion, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary")
                ], "marginTop")
            ])
        ];
    }

    askQuestion = async () => {
        if (!this.validate()) {
            return;
        }

        // asks a question about the subgraph of this tree
        if (this.subGraphQuery) {
            const res = await S.rpcUtil.rpc<J.AskSubGraphRequest, J.AskSubGraphResponse>("askSubGraph", {
                nodeId: this.nodeId,
                question: this.questionState.getValue()
            });

            if (res.code == C.RESPONSE_CODE_OK) {
                new GptAnswerDlg(res.answer).open();
            }
        }
        // answers a question about the current node and the context above it on the tree (all parents as context)
        else {
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
                dispatch("setShowGptCredit", s => {
                    s.showGptCredit = true;
                    s.gptCredit = res.gptCredit || 0.0;
                });
                S.view.jumpToId(res.newNode.id);
            }
        }
    }
}

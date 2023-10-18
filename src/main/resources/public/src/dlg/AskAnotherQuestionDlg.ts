import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";
import { ScrollPos } from "../comp/base/Comp";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Diva } from "../comp/core/Diva";
import { TextArea } from "../comp/core/TextArea";
import { GptAnswerDlg } from "./GptAnswerDlg";

export class AskAboutSubgraphDlg extends DialogBase {
    questionState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED },
        { name: ValidatorRuleName.MINLEN, payload: 10 }
    ]);
    textScrollPos = new ScrollPos();
    textArea: TextArea;

    constructor(public nodeId: string) {
        super("Question about Content", "appModalContMediumWidth");
        this.onMount(() => { this.textArea?.focus(); });
    }

    renderDlg(): Comp[] {
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
        const res = await S.rpcUtil.rpc<J.AskSubGraphRequest, J.AskSubGraphResponse>("askSubGraph", {
            nodeId: this.nodeId,
            question: this.questionState.getValue()
        });

        this.close();

        if (res.code == C.RESPONSE_CODE_OK) {
            new GptAnswerDlg(res.answer).open();
        }
    }
}

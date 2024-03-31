import { DialogBase } from "../DialogBase";
import { NodeInfo } from "../JavaIntf";
import { Validator } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { dispatch, getAs } from "../AppContext";

export class GenerateBookByAIDlg extends DialogBase {
    static promptState: Validator = new Validator();
    promptScrollPos = new ScrollPos();

    constructor(public node: NodeInfo) {
        super("Generate Book using AI");

        GenerateBookByAIDlg.promptState.setValue("I'm creating an online 'book' that is an introduction to Python programming geared towards allowing Java experts to learn Python. Let's say I want to have 20 chapters in this book.");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextArea("Describe Book", {
                    rows: 7,
                }, GenerateBookByAIDlg.promptState, null, false, 3, this.promptScrollPos),

                new ButtonBar([
                    new Button("Generate", this.generate, null, "btn-primary"),
                    new Button("Cancel", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    generate = async () => {
        const res = await S.rpcUtil.rpc<J.GenerateBookByAIRequest, J.GenerateBookByAIResponse>("generateBookByAI", {
            nodeId: this.node.id,
            prompt: GenerateBookByAIDlg.promptState.getValue(),
            aiService: getAs().userPrefs.aiService
        });

        dispatch("setShowGptCredit", s => {
            s.showGptCredit = true;
        });

        if (res.code === C.RESPONSE_CODE_OK) {
            S.view.jumpToId(res.nodeId);
        }
        this.close();
    }
}

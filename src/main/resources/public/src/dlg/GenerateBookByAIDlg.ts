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
import { FlexLayout } from "../comp/core/FlexLayout";
import { TextField } from "../comp/core/TextField";

export class GenerateBookByAIDlg extends DialogBase {
    static promptState: Validator = new Validator();
    promptScrollPos = new ScrollPos();

    static numChapters: Validator = new Validator();
    static numSections: Validator = new Validator();

    constructor(public node: NodeInfo) {
        super("Generate Book using AI");
        GenerateBookByAIDlg.numChapters.setValue("20");
        GenerateBookByAIDlg.numSections.setValue("10");

        // #ai_prompt
        GenerateBookByAIDlg.promptState.setValue("I'm creating an online 'book' that is an introduction to Python programming geared towards allowing Java experts to learn Python.");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new Div("You must mention that you're creating a book, describe what the book is about, and who the target audience is. An example is given below, but you can word it however you want and the AI will understand.", { className: "marginBottom" }),
                new TextArea("Describe Book", {
                    rows: 7,
                }, GenerateBookByAIDlg.promptState, null, false, 3, this.promptScrollPos),
                new FlexLayout([
                    new TextField({
                        label: "Number of Chapters",
                        val: GenerateBookByAIDlg.numChapters,
                        inputClass: "numChapters",
                        outterClass: "bigMarginRight"

                    }),
                    new TextField({
                        label: "Number of Sections per Chapter",
                        val: GenerateBookByAIDlg.numSections,
                        inputClass: "numSections",
                    })
                ]),
                new ButtonBar([
                    new Button("Generate", this._generate, null, "-primary"),
                    new Button("Cancel", this._close, null, "tw-float-right")
                ], "marginTop")
            ])
        ];
    }

    _generate = async () => {
        const numChapters = parseInt(GenerateBookByAIDlg.numChapters.getValue());
        if (numChapters < 1 || numChapters > 100) {
            alert("Too many chapters. Max allowed is 100.");
            return;
        }

        const numSections = parseInt(GenerateBookByAIDlg.numSections.getValue());
        if (numSections < 0 || numSections > 25) {
            alert("Too many sections. Max allowed is 25.");
            return;
        }

        const res = await S.rpcUtil.rpc<J.GenerateBookByAIRequest, J.GenerateBookByAIResponse>("generateBookByAI", {
            nodeId: this.node.id,
            numChapters,
            numSections,
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

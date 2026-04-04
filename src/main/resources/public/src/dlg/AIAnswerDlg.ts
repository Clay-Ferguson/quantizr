import { DialogBase } from "../DialogBase";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { Markdown } from "../comp/core/Markdown";

export class AIAnswerDlg extends DialogBase {

    constructor(public answer: string) {
        super("Chat GPT Answer", "appModalContMediumWidth");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new Markdown(this.answer),
                new ButtonBar([
                    new Button("Close", this._close)
                ], "mt-3")
            ])
        ];
    }
}

import { DialogBase } from "../DialogBase";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Diva } from "../comp/core/Diva";
import { Markdown } from "../comp/core/Markdown";

export class GptAnswerDlg extends DialogBase {

    constructor(public answer: string) {
        super("Chat GPT Answer", "appModalContMediumWidth");
    }

    renderDlg(): CompIntf[] {
        return [
            new Diva([
                new Markdown(this.answer),
                new ButtonBar([
                    new Button("Close", this.close, null, "btn-secondary")
                ], "marginTop")
            ])
        ];
    }
}

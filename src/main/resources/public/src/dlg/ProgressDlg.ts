import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Progress } from "../comp/core/Progress";
import { DialogBase } from "../DialogBase";

export class ProgressDlg extends DialogBase {

    constructor(msg: string = "") {
        super("Loading... " + msg, "appModalContTinyWidth");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, { className: "progressSpinner" }, [new Progress()])
        ];
    }
}

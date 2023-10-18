import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Spinner } from "../comp/core/Spinner";
import { DialogBase } from "../DialogBase";

export class ProgressDlg extends DialogBase {

    constructor(msg: string = "") {
        super("Loading... " + msg, "appModalContTinyWidth");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, { className: "progressSpinner" }, [new Spinner()])
        ];
    }
}

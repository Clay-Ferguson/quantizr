import { Comp } from "../comp/base/Comp";
import { Divc } from "../comp/core/Divc";
import { Spinner } from "../comp/core/Spinner";
import { DialogBase } from "../DialogBase";

export class ProgressDlg extends DialogBase {

    constructor(msg: string = "") {
        super("Loading... " + msg, "appModalContTinyWidth");
    }

    renderDlg(): Comp[] {
        return [
            new Divc({ className: "progressSpinner" }, [new Spinner()])
        ];
    }
}

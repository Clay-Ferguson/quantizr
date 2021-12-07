import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../comp/base/CompIntf";
import { Div } from "../comp/Div";
import { Spinner } from "../comp/Spinner";

export class ProgressDlg extends DialogBase {

    constructor(state: AppState) {
        super("Loading...", "app-modal-content-tiny-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, {
                className: "progressSpinner"
            }, [new Spinner()])
        ];
    }
}

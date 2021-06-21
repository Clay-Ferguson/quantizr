import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import { Spinner } from "../widget/Spinner";

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

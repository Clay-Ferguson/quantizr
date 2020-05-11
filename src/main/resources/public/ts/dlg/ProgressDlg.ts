import { DialogBase } from "../DialogBase";
import { Progress } from "../widget/Progress";
import { Div } from "../widget/Div";
import { AppState } from "../AppState";
import { CompIntf } from "../widget/base/CompIntf";

export class ProgressDlg extends DialogBase {

    constructor(state: AppState) {
        super("Processing...", "app-modal-content-narrow-width", false, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, {
                className: "progress"

            }, [new Progress()]) 
        ];
    }
}

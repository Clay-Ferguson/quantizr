import { AppState } from "../AppState";
import { DialogBase } from "../DialogBase";
import { CompIntf } from "../widget/base/CompIntf";
import { Div } from "../widget/Div";
import { Progress } from "../widget/Progress";

export class ProgressDlg extends DialogBase {

    constructor(state: AppState) {
        super("Processing...", "app-modal-content-narrow-width", false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, {
                className: "progress"

            }, [new Progress()])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }
}

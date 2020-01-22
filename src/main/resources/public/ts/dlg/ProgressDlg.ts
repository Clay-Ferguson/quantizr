import { DialogBase } from "../DialogBase";
import { Progress } from "../widget/Progress";
import { Div } from "../widget/Div";

export class ProgressDlg extends DialogBase {

    constructor() {
        super("Processing...", "app-modal-content-narrow-width");

        this.setChildren([
            new Div(null, {
                className: "progress"
            }, [new Progress()])
        ]);
    }
}

console.log("ProgressDlg.ts");

import { DialogBase } from "../DialogBase";
import { Progress } from "../widget/Progress";
import { Div } from "../widget/Div";

export class ProgressDlg extends DialogBase {

    constructor() {
        super("Processing...");

        this.setChildren([
            new Div(null, {
                className: "progress"
            }, [new Progress()])
        ]);
    }
}

import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextContent } from "../comp/core/TextContent";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";

export class PasteActionDlg extends DialogBase {
    yes: boolean = false;

    constructor(private nodeId: string, private sourceId: string) {
        super("Paste Action", "app-modal-content-narrow-width");
    }

    renderDlg(): CompIntf[] {
        return [
            new Div(null, null, [
                new TextContent("Paste where..."),
                new ButtonBar([
                    new Button("Inside", () => {
                        S.edit.moveNodeByDrop(this.nodeId, this.sourceId, "inside");
                        this.close();
                    }),
                    new Button("Inline", () => {
                        S.edit.moveNodeByDrop(this.nodeId, this.sourceId, "inline");
                        this.close();
                    }),
                    new Button("Cancel", this.close, { className: "float-end" })
                ], "marginTop")
            ])
        ];
    }
}

import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { DialogBase } from "../DialogBase";
import { S } from "../Singletons";
import { AskNodeLinkNameDlg } from "./AskNodeLinkNameDlg";

export class PasteOrLinkDlg extends DialogBase {
    yes: boolean = false;

    constructor(private nodeId: string, private sourceId: string) {
        super("Select Action", "appModalContNarrowWidth");
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, { className: "dragTargetDlgSection" }, [
                new Heading(6, "Paste"),
                new ButtonBar([
                    new Button("Inside", () => {
                        S.edit.moveNodeByDrop(this.nodeId, this.sourceId, "inside");
                        this.close();
                    }),
                    new Button("Inline", () => {
                        S.edit.moveNodeByDrop(this.nodeId, this.sourceId, "inline");
                        this.close();
                    })
                ], "marginTop")
            ]),
            new Div(null, { className: "dragTargetDlgSection" }, [
                new Heading(6, "Link Nodes"),
                new ButtonBar([
                    new Button("Link", () => {
                        const run = async () => {
                            const dlg = new AskNodeLinkNameDlg(null);
                            await dlg.open();
                            if (dlg.link) {
                                S.edit.linkNodes(this.sourceId, this.nodeId, dlg.link, "forward-link");
                            }
                        };
                        run();
                        this.close();
                    }),
                ], "marginTop")
            ]),
            new ButtonBar([
                new Button("Cancel", this._close)
            ], "marginTop tw-float-right"),
            new Clearfix()
        ];
    }
}

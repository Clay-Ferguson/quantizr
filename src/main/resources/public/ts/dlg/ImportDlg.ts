import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState, ValidatorRuleName } from "../ValidatedState";
import { MessageDlg } from "./MessageDlg";

export class ImportDlg extends DialogBase {
    fileNameState: ValidatedState<any> = new ValidatedState<any>("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor() {
        super("Import from XML");
        this.validatedStates = [this.fileNameState];
    }

    renderDlg(): CompIntf[] {
        return [
            new TextField({ label: "File Name to Import", val: this.fileNameState }),
            new ButtonBar([
                new Button("Import", this.importNodes, null, "btn-primary"),
                new Button("Close", this.close, null, "btn-secondary float-end")
            ], "marginTop")
        ];
    }

    importNodes = async () => {
        if (!this.validate()) {
            return;
        }

        const hltNode = S.nodeUtil.getHighlightedNode(getAppState());
        if (!hltNode) {
            new MessageDlg("Select a node to import into.", "Import", null, null, false, 0, null).open();
            return;
        }

        const res = await S.util.ajax<J.ImportRequest, J.ImportResponse>("import", {
            nodeId: hltNode.id,
            sourceFileName: this.fileNameState.getValue()
        });
        this.importResponse(res);
        this.close();
    }

    importResponse = (res: J.ImportResponse) => {
        if (S.util.checkSuccess("Import", res)) {
            new MessageDlg("Import Successful", "Import", null, null, false, 0, null).open();

            S.view.refreshTree({
                nodeId: null,
                zeroOffset: false,
                renderParentIfLeaf: false, 
                highlightId: null,
                forceIPFSRefresh: false,
                scrollToTop: true,
                allowScroll: true,
                setTab: true,
                forceRenderParent: false,
                state: getAppState()
            });
            S.view.scrollToNode(getAppState());
        }
    }
}

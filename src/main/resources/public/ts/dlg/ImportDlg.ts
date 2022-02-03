import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { MessageDlg } from "./MessageDlg";

export class ImportDlg extends DialogBase {
    fileNameState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Import from XML", null, false, state);
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

    validate = (): boolean => {
        let valid = true;
        if (!this.fileNameState.getValue()) {
            this.fileNameState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.fileNameState.setError(null);
        }
        return valid;
    }

    importNodes = async () => {
        if (!this.validate()) {
            return;
        }

        let hltNode = S.nodeUtil.getHighlightedNode(this.appState);
        if (!hltNode) {
            new MessageDlg("Select a node to import into.", "Import", null, null, false, 0, null, this.appState).open();
            return;
        }

        let res: J.ImportResponse = await S.util.ajax<J.ImportRequest, J.ImportResponse>("import", {
            nodeId: hltNode.id,
            sourceFileName: this.fileNameState.getValue()
        });
        this.importResponse(res);

        this.close();
    }

    importResponse = (res: J.ImportResponse): void => {
        if (S.util.checkSuccess("Import", res)) {
            new MessageDlg("Import Successful", "Import", null, null, false, 0, null, this.appState).open();

            S.view.refreshTree(null, false, false, null, false, true, true, true, false, store.getState());
            S.view.scrollToNode(this.appState);
        }
    }
}

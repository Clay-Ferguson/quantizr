import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { TextField } from "../widget/TextField";
import { MessageDlg } from "./MessageDlg";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ImportDlg extends DialogBase {
    fileNameState: ValidatedState<any> = new ValidatedState<any>();

    constructor(state: AppState) {
        super("Import from XML", null, false, state);
    }

    renderDlg(): CompIntf[] {
        return [
            new TextField("File Name to Import", null, null, null, false, this.fileNameState),
            new ButtonBar([
                new Button("Import", this.importNodes, null, "btn-primary"),
                new Button("Close", this.close)
            ])
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

    importNodes = (): void => {
        if (!this.validate()) {
            return;
        }

        let hltNode = S.quanta.getHighlightedNode(this.appState);
        if (!hltNode) {
            new MessageDlg("Select a node to import into.", "Import", null, null, false, 0, this.appState).open();
            return;
        }

        S.util.ajax<J.ImportRequest, J.ImportResponse>("import", {
            nodeId: hltNode.id,
            sourceFileName: this.fileNameState.getValue()
        }, this.importResponse);

        this.close();
    }

    importResponse = (res: J.ImportResponse): void => {
        if (S.util.checkSuccess("Import", res)) {
            new MessageDlg("Import Successful", "Import", null, null, false, 0, this.appState).open();

            S.view.refreshTree(null, false, false, null, false, true, true, store.getState());
            S.view.scrollToSelectedNode(this.appState);
        }
    }
}

import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { ValidatedState } from "../ValidatedState";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { TextField2 } from "../widget/TextField2";
import { MessageDlg } from "./MessageDlg";

let S : Singletons;
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
            new TextField2("File Name to Import", null, null, null, false, this.fileNameState),
            new ButtonBar([
                new Button("Import", this.importNodes, null, "btn-primary"),
                new Button("Close", this.close)
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    importNodes = (): void => {
        // todo-0: need a standard validate() function here.
        let hltNode = S.meta64.getHighlightedNode(this.appState);
        let state = this.getState();

        if (!this.fileNameState.getValue()) {
            new MessageDlg("Please enter a name for the import file.", "Import", null, null, false, 0, this.appState).open();
            return;
        }

        if (hltNode) {
            S.util.ajax<J.ImportRequest, J.ImportResponse>("import", {
                nodeId: hltNode.id,
                sourceFileName: this.fileNameState.getValue()
            }, this.importResponse);
        }
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

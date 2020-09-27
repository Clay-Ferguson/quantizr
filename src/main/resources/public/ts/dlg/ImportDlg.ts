import { store } from "../AppRedux";
import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { TextField } from "../widget/TextField";
import { MessageDlg } from "./MessageDlg";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ImportDlg extends DialogBase {

    constructor(state: AppState) {
        super("Import from XML", null, false, state);
        this.mergeState({
            fileName: null
        });
    }

    renderDlg(): CompIntf[] {
        return [
            new TextField("File Name to Import", null, null, null, new CompValueHolder<string>(this, "fileName")),
            new ButtonBar([
                new Button("Import", this.importNodes, null, "btn-primary"),
                new Button("Close", () => {
                    this.close();
                })
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    importNodes = (): void => {
        let hltNode = S.meta64.getHighlightedNode(this.appState);
        let state = this.getState();

        if (!state.fileName) {
            new MessageDlg("Please enter a name for the import file.", "Import", null, null, false, 0, this.appState).open();
            return;
        }

        if (hltNode) {
            S.util.ajax<J.ImportRequest, J.ImportResponse>("import", {
                nodeId: hltNode.id,
                sourceFileName: state.fileName
            }, this.importResponse);
        }
        this.close();
    }

    importResponse = (res: J.ImportResponse): void => {
        if (S.util.checkSuccess("Import", res)) {
            new MessageDlg("Import Successful", "Import", null, null, false, 0, this.appState).open();

            S.view.refreshTree(null, false, null, false, false, true, true, store.getState());
            S.view.scrollToSelectedNode(this.appState);
        }
    }
}

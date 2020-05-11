import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { MessageDlg } from "./MessageDlg";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { PubSub } from "../PubSub";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { AppState } from "../AppState";
import { store } from "../AppRedux";
import { CompIntf } from "../widget/base/CompIntf";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class ImportDlg extends DialogBase {

  importFromFileNameTextField: TextField;

    constructor(state: AppState) {
        super("Import from XML", null, false, false, state);
    }
    
    renderDlg(): CompIntf[] {
        return [
            this.importFromFileNameTextField = new TextField("File Name to Import"),
            new ButtonBar([
                new Button("Import", this.importNodes, null, "btn-primary"),
                new Button("Close", () => {
                    this.close();
                })
            ])
        ];
    }

    importNodes = (): void => {
        var highlightNode = S.meta64.getHighlightedNode(this.appState);
        var sourceFileName = this.importFromFileNameTextField.getValue();

        if (!sourceFileName) {
            new MessageDlg("Please enter a name for the import file.", "Import", null, null, false, 0, this.appState).open();
            return;
        }

        if (highlightNode) {
            S.util.ajax<J.ImportRequest, J.ImportResponse>("import", {
                "nodeId": highlightNode.id,
                "sourceFileName": sourceFileName
            }, this.importResponse);
        }
        this.close();
    }

    importResponse = (res: J.ImportResponse): void => {
        if (S.util.checkSuccess("Import", res)) {
            new MessageDlg("Import Successful", "Import",null, null, false, 0, this.appState).open();

            S.view.refreshTree(null, false, null, false, false, store.getState());
            S.meta64.selectTab("mainTab");
            S.view.scrollToSelectedNode(this.appState);
        }
    }
}

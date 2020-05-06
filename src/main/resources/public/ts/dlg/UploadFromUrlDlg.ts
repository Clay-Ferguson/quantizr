import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { Constants as C} from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Form } from "../widget/Form";
import { AppState } from "../AppState";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class UploadFromUrlDlg extends DialogBase {

    uploadFromUrlTextField: TextField;
    uploadButton: Button;

    constructor(private node: J.NodeInfo, private defaultUrl: string, state: AppState) {
        super("Upload File", null, false, false, state);
    }

    preRender = () => {
        this.setChildren([
            new Form(null, [
                this.uploadFromUrlTextField = new TextField("Upload from URL", null, this.defaultUrl),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ]);
    }

    upload = (): void => {
        let sourceUrl = this.uploadFromUrlTextField.getValue();

        if (sourceUrl) {
            S.util.ajax<J.UploadFromUrlRequest, J.UploadFromUrlResponse>("uploadFromUrl", {
                "nodeId": this.node.id,
                "sourceUrl": sourceUrl
            }, this.uploadFromUrlResponse);

            this.close();
        }
    }

    uploadFromUrlResponse = (res: J.UploadFromUrlResponse): void => {
        if (S.util.checkSuccess("Upload from URL", res)) {
            this.close();
            S.meta64.refresh(this.appState);
        }
    }
}

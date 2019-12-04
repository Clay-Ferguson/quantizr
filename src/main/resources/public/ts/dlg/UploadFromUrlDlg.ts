import { DialogBase } from "../DialogBase";
import * as I from "../Interfaces";
import { ButtonBar } from "../widget/ButtonBar";
import { Button } from "../widget/Button";
import { TextField } from "../widget/TextField";
import { TextContent } from "../widget/TextContent";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { Form } from "../widget/Form";

let S : Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class UploadFromUrlDlg extends DialogBase {

    uploadFromUrlTextField: TextField;
    uploadButton: Button;

    constructor() {
        super("Upload File");
       
        this.setChildren([
            new Form(null, [
                Constants.SHOW_PATH_IN_DLGS ? new TextContent("Path: " + S.attachment.uploadNode.path, "path-display-in-editor") : null,
                this.uploadFromUrlTextField = new TextField({
                    "placeholder": "",
                    "label": "Upload From URL"
                }),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload),
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
            S.util.ajax<I.UploadFromUrlRequest, I.UploadFromUrlResponse>("uploadFromUrl", {
                "nodeId": S.attachment.uploadNode.id,
                "sourceUrl": sourceUrl
            }, this.uploadFromUrlResponse);

            this.close();
        }
    }

    uploadFromUrlResponse = (res: I.UploadFromUrlResponse): void => {
        if (S.util.checkSuccess("Upload from URL", res)) {
            this.close();
            S.meta64.refresh();
        }
    }
}

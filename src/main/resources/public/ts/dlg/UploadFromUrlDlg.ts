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
import { Form } from "../widget/Form";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class UploadFromUrlDlg extends DialogBase {

    uploadButton: Button;
    urlState: ValidatedState<any> = new ValidatedState<any>();

    constructor(private nodeId: string, private url: string, private onUploadFunc: Function, state: AppState) {
        super("Upload File", null, false, state);
    }

    validate = (): boolean => {
        let valid = true;

        if (!this.urlState.getValue()) {
            this.urlState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.urlState.setError(null);
        }

        return valid;
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextField("Upload from URL", false, null, null, false, this.urlState),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload, null, "btn-primary"),
                    new Button("Close", this.close)
                ])
            ])
        ];
    }

    upload = (): void => {
        if (!this.validate()) {
            return;
        }

        S.util.ajax<J.UploadFromUrlRequest, J.UploadFromUrlResponse>("uploadFromUrl", {
            nodeId: this.nodeId,
            sourceUrl: this.urlState.getValue()
        }, this.uploadFromUrlResponse);
    }

    uploadFromUrlResponse = (res: J.UploadFromUrlResponse): void => {
        if (S.util.checkSuccess("Upload from URL", res)) {
            this.close();

            if (this.onUploadFunc) {
                this.onUploadFunc();
            }
            else {
                S.meta64.refresh(this.appState);
            }
        }
    }
}

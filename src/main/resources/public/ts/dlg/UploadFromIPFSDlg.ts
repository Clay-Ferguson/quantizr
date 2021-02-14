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

export class UploadFromIPFSDlg extends DialogBase {

    static storeLocally: boolean = false;
    uploadButton: Button;
    cidState: ValidatedState<any> = new ValidatedState<any>();
    mimeState: ValidatedState<any> = new ValidatedState<any>();

    constructor(private nodeId: string, private cid: string, private onUploadFunc: Function, state: AppState) {
        super("Upload File", null, false, state);
    }

    validate = (): boolean => {
        let valid = true;

        if (!this.cidState.getValue()) {
            this.cidState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.cidState.setError(null);
        }

        if (!this.mimeState.getValue()) {
            this.mimeState.setError("Cannot be empty.");
            valid = false;
        }
        else {
            this.mimeState.setError(null);
        }

        return valid;
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextField("Upload from IPFS CID", false, null, null, false, this.cidState),
                new TextField("Mime Type (or Filename Extension)", false, null, null, false, this.mimeState),
                new ButtonBar([
                    this.uploadButton = new Button("Save", this.upload, null, "btn-primary"),
                    new Button("Close", this.close)
                ])
                // todo-1: this would be very nice to have!
                // new Span(null, { className: "marginLeft" }, [
                //     new Checkbox("PIN a copy on this server", null, {
                //         setValue: (checked: boolean): void => {
                //             UploadFromUrlDlg.storeLocally = checked;
                //         },
                //         getValue: (): boolean => {
                //             return UploadFromUrlDlg.storeLocally;
                //         }
                //     })
                // ])
        ])
        ];
    }

    upload = (): void => {
        if (!this.validate()) {
            return;
        }

        S.util.ajax<J.UploadFromIPFSRequest, J.UploadFromIPFSResponse>("uploadFromIPFS", {
            pinLocally: false, // UploadFromUrlDlg.storeLocally,
            nodeId: this.nodeId,
            cid: this.cidState.getValue(),
            mime: this.mimeState.getValue()
        }, this.uploadFromIPFSResponse);
    }

    uploadFromIPFSResponse = (res: J.UploadFromUrlResponse): void => {
        if (S.util.checkSuccess("Upload from IPFS", res)) {
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

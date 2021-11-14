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
import { Checkbox } from "../widget/Checkbox";
import { Form } from "../widget/Form";
import { Span } from "../widget/Span";
import { TextField } from "../widget/TextField";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class UploadFromUrlDlg extends DialogBase {

    static storeLocally: boolean = false;
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
                ], "marginTop"),
                new Span(null, { className: "marginLeft" }, [
                    new Checkbox("Store a copy on this server", null, {
                        setValue: (checked: boolean): void => {
                            UploadFromUrlDlg.storeLocally = checked;
                        },
                        getValue: (): boolean => {
                            return UploadFromUrlDlg.storeLocally;
                        }
                    })
                ])
            ])
        ];
    }

    upload = async () => {
        if (!this.validate()) {
            return;
        }

        let res: J.UploadFromUrlResponse = await S.util.ajax<J.UploadFromUrlRequest, J.UploadFromUrlResponse>("uploadFromUrl", {
            storeLocally: UploadFromUrlDlg.storeLocally,
            nodeId: this.nodeId,
            sourceUrl: this.urlState.getValue()
        });
        this.uploadFromUrlResponse(res);
    }

    uploadFromUrlResponse = (res: J.UploadFromUrlResponse): void => {
        if (S.util.checkSuccess("Upload from URL", res)) {
            this.close();

            if (this.onUploadFunc) {
                this.onUploadFunc();
            }
            else {
                S.quanta.refresh(this.appState);
            }
        }
    }
}

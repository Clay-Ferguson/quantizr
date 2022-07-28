import { getAppState } from "../AppRedux";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

export class UploadFromUrlDlg extends DialogBase {

    static storeLocally: boolean = false;
    urlState: ValidatedState<any> = new ValidatedState<any>();

    constructor(private nodeId: string, private url: string, private onUploadFunc: Function) {
        super("Upload File");
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
            new Div(null, null, [
                new TextField({ label: "Upload from URL", val: this.urlState }),
                new Div(null, { className: "marginTop" }, [
                    new Checkbox("Store a copy on this server", null, {
                        setValue: (checked: boolean) => UploadFromUrlDlg.storeLocally = checked,
                        getValue: (): boolean => UploadFromUrlDlg.storeLocally
                    })
                ]),
                new ButtonBar([
                    new Button("Upload", this.upload, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    upload = async () => {
        if (!this.validate()) {
            return;
        }

        let res = await S.util.ajax<J.UploadFromUrlRequest, J.UploadFromUrlResponse>("uploadFromUrl", {
            storeLocally: UploadFromUrlDlg.storeLocally,
            nodeId: this.nodeId,
            sourceUrl: this.urlState.getValue()
        });
        this.uploadFromUrlResponse(res);
    }

    uploadFromUrlResponse = (res: J.UploadFromUrlResponse) => {
        if (S.util.checkSuccess("Upload from URL", res)) {
            this.close();

            if (this.onUploadFunc) {
                this.onUploadFunc();
            }
            else {
                S.quanta.refresh(getAppState());
            }
        }
    }
}

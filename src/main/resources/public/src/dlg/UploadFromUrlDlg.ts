import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";

export class UploadFromUrlDlg extends DialogBase {

    static storeLocally: boolean = false;

    urlState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor(private nodeId: string, private onUploadFunc: () => void) {
        super("Upload File");
        this.validatedStates = [this.urlState];
    }

    renderDlg(): Comp[] {
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
                    new Button("Upload", this._upload, null, "-primary"),
                    new Button("Close", this._close, null, "tw-float-right")
                ], "marginTop")
            ])
        ];
    }

    _upload = async () => {
        if (!this.validate()) {
            return;
        }

        const res = await S.rpcUtil.rpc<J.UploadFromUrlRequest, J.UploadFromUrlResponse>("uploadFromUrl", {
            storeLocally: UploadFromUrlDlg.storeLocally,
            nodeId: this.nodeId,
            sourceUrl: this.urlState.getValue()
        });

        if (S.util.checkSuccess("Upload from URL", res)) {
            this.close();

            if (this.onUploadFunc) {
                this.onUploadFunc();
            }
            else {
                S.quanta.refresh();
            }
        }
    }
}

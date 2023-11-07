import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";

export class UploadAIGenImgDlg extends DialogBase {

    static storeLocally: boolean = false;
    textScrollPos = new ScrollPos();

    descriptState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor(private nodeId: string, private onUploadFunc: () => void) {
        super("Generate Image with AI");
        this.validatedStates = [this.descriptState];
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new TextArea("Describe Image", { rows: 15 }, this.descriptState, null, false, 3, this.textScrollPos),
                new ButtonBar([
                    new Button("Create", this.upload, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    upload = async () => {
        if (!this.validate()) {
            return;
        }

        const res = await S.rpcUtil.rpc<J.UploadFromUrlRequest, J.UploadFromUrlResponse>("uploadFromUrl", {
            storeLocally: true,
            nodeId: this.nodeId,
            sourceUrl: null,
            openAiPrompt: this.descriptState.getValue()
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
                S.quanta.refresh();
            }
        }
    }
}

import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Checkbox } from "../comp/core/Checkbox";
import { Div } from "../comp/core/Div";
import { TextArea } from "../comp/core/TextArea";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";
import { Selection } from "../comp/core/Selection";

interface LS { // Local State
    highDef?: boolean;
    size?: string;
}

export class UploadAIGenImgDlg extends DialogBase {

    static highDef: boolean = true;
    static storeLocally: boolean = false;
    textScrollPos = new ScrollPos();

    descriptState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor(private nodeId: string, private onUploadFunc: () => void) {
        super("Generate Image with AI");
        this.validatedStates = [this.descriptState];
        this.mergeState<LS>({ highDef: null, size: "1024x1024" });
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new Div(null, null, [
                    new Checkbox("High Definition", null, {
                        setValue: (checked: boolean) => this.mergeState<LS>({ highDef: checked }),
                        getValue: (): boolean => this.getState<LS>().highDef
                    }),
                    new Selection(null, null, [
                        { key: "1024x1024", val: "Square: 1024x1024" },
                        { key: "1794x1024", val: "Landscape: 1792x1024" },
                        { key: "1024x1792", val: "Portrait: 1024x1792" },
                    ], null, "aiImageGenSize float-end", {
                        setValue: (val: string) => this.mergeState<LS>({ size: val }),
                        getValue: (): string => this.getState<LS>().size
                    }),
                ]),
                new TextArea("Describe Image", { rows: 10 }, this.descriptState, null, false, 3, this.textScrollPos),
                new ButtonBar([
                    new Button("Generate", this.generate, null, "btn-primary"),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    generate = async () => {
        if (!this.validate()) {
            return;
        }

        const res = await S.rpcUtil.rpc<J.AIGenImageRequest, J.AIGenImageResponse>("aiGenImage", {
            nodeId: this.nodeId,
            openAiPrompt: this.descriptState.getValue(),
            highDef: this.getState<LS>().highDef,
            size: this.getState<LS>().size
        });
        this.uploadFromUrlResponse(res);
    }

    uploadFromUrlResponse = (res: J.UploadFromUrlResponse) => {
        if (S.util.checkSuccess("Generate Image", res)) {
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

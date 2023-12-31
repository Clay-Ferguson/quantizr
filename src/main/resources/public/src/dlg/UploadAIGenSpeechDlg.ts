import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Validator, ValidatorRuleName } from "../Validator";
import { Comp, ScrollPos } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Clearfix } from "../comp/core/Clearfix";
import { Div } from "../comp/core/Div";
import { Selection } from "../comp/core/Selection";
import { TextArea } from "../comp/core/TextArea";
import { EditNodeDlg } from "./EditNodeDlg";

interface LS { // Local State
    voice: string;
}

export class UploadAIGenSpeechDlg extends DialogBase {

    static highDef: boolean = true;
    static storeLocally: boolean = false;
    textScrollPos = new ScrollPos();

    descriptState: Validator = new Validator("", [
        { name: ValidatorRuleName.REQUIRED }
    ]);

    constructor(private nodeId: string, private onUploadFunc: () => void) {
        super("Generate Speech with AI");
        this.validatedStates = [this.descriptState];
        this.mergeState<LS>({ voice: "onyx" });
    }

    renderDlg(): Comp[] {
        return [
            new Div(null, null, [
                new Div(null, null, [
                    new Selection(null, "Voice", [
                        { key: "alloy", val: "Alloy" },
                        { key: "echo", val: "Echo" },
                        { key: "fable", val: "Fable" },
                        { key: "onyx", val: "Onyx" },
                        { key: "nova", val: "Nova" },
                        { key: "shimmer", val: "Shimmer" },
                    ], null, "aiSpeechGenVoice", {
                        setValue: (val: string) => this.mergeState<LS>({ voice: val }),
                        getValue: (): string => this.getState<LS>().voice
                    }),
                ]),
                new Clearfix(),
                new TextArea("Enter Text for Speech", { rows: 10 }, this.descriptState, null, false, 3, this.textScrollPos),
                new ButtonBar([
                    new Button("Generate", this.generate, null, "btn-primary"),
                    new Button("Node Text", this.nodeText),
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])
        ];
    }

    nodeText = async () => {
        this.descriptState.setValue(EditNodeDlg.currentInst.contentEditorState.getValue());
    }

    generate = async () => {
        if (!this.validate()) {
            return;
        }

        const res = await S.rpcUtil.rpc<J.AIGenSpeechRequest, J.AIGenSpeechResponse>("aiGenSpeech", {
            nodeId: this.nodeId,
            openAiPrompt: this.descriptState.getValue(),
            voice: this.getState<LS>().voice
        });
        this.uploadFromUrlResponse(res);
    }

    uploadFromUrlResponse = (res: J.UploadFromUrlResponse) => {
        if (S.util.checkSuccess("Generate Speech", res)) {
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

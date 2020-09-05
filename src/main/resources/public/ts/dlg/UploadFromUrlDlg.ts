import { AppState } from "../AppState";
import { CompValueHolder } from "../CompValueHolder";
import { Constants as C } from "../Constants";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { CompIntf } from "../widget/base/CompIntf";
import { Button } from "../widget/Button";
import { ButtonBar } from "../widget/ButtonBar";
import { Form } from "../widget/Form";
import { TextField } from "../widget/TextField";

let S : Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class UploadFromUrlDlg extends DialogBase {

    uploadButton: Button;

    constructor(private node: J.NodeInfo, private url: string, private onUploadFunc: Function, state: AppState) {
        super("Upload File", null, false, state);
        this.mergeState({ url });
    }

    renderDlg(): CompIntf[] {
        return [
            new Form(null, [
                new TextField("Upload from URL", false, null, new CompValueHolder<string>(this, "url")),
                new ButtonBar([
                    this.uploadButton = new Button("Upload", this.upload, null, "btn-primary"),
                    new Button("Close", () => {
                        this.close();
                    })
                ])
            ])
        ];
    }

    renderButtons(): CompIntf {
        return null;
    }

    upload = (): void => {
        let sourceUrl = this.getState().url;

        if (sourceUrl) {
            S.util.ajax<J.UploadFromUrlRequest, J.UploadFromUrlResponse>("uploadFromUrl", {
                nodeId: this.node.id,
                sourceUrl
            }, this.uploadFromUrlResponse);
        }
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

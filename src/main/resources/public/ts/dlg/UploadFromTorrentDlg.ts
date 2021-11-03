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

export class UploadFromTorrentDlg extends DialogBase {
    uploadButton: Button;
    urlState: ValidatedState<any> = new ValidatedState<any>();

    constructor(private nodeId: string, private url: string, private onUploadFunc: Function, state: AppState) {
        super("Attach Torrent", null, false, state);
    }

    renderDlg(): CompIntf[] {
        let children = [
            new Form(null, [
                new TextField("Existing Torrent/Magnet Link", false, null, null, false, this.urlState),
                new ButtonBar([
                    this.uploadButton = new Button("Save", this.upload, null, "btn-primary"),
                    new Button("Close", this.close)
                ], "marginTop")
            ])];

        return children;
    }

    upload = (): void => {
        S.util.ajax<J.UploadFromTorrentRequest, J.UploadFromTorrentResponse>("uploadFromTorrent", {
            nodeId: this.nodeId,
            torrentId: this.urlState.getValue()
        }, this.uploadFromTorrentResponse);
    }

    uploadFromTorrentResponse = (res: J.UploadFromTorrentResponse): void => {
        if (S.util.checkSuccess("Upload from Torrent", res)) {
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

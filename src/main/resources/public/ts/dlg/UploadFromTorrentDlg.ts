import { AppState } from "../AppState";
import { CompIntf } from "../comp/base/CompIntf";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Form } from "../comp/core/Form";
import { TextField } from "../comp/core/TextField";
import { DialogBase } from "../DialogBase";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { ValidatedState } from "../ValidatedState";

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
                    new Button("Close", this.close, null, "btn-secondary float-end")
                ], "marginTop")
            ])];

        return children;
    }

    upload = async () => {
        let res: J.UploadFromTorrentResponse = await S.util.ajax<J.UploadFromTorrentRequest, J.UploadFromTorrentResponse>("uploadFromTorrent", {
            nodeId: this.nodeId,
            torrentId: this.urlState.getValue()
        });
        this.uploadFromTorrentResponse(res);
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

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
import { Div } from "../widget/Div";
import { Form } from "../widget/Form";
import { TextField } from "../widget/TextField";
import WebTorrent from "webtorrent";
import dragDrop from "drag-drop";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class UploadFromTorrentDlg extends DialogBase {
    uploadButton: Button;
    urlState: ValidatedState<any> = new ValidatedState<any>();
    dropTarget: Div;
    loaded: boolean = false;

    constructor(private nodeId: string, private url: string, private onUploadFunc: Function, state: AppState) {
        super("Attach Torrent", null, false, state);
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
        let children = [
            new Form(null, [
                new TextField("Existing Torrent/Magnet Link", false, null, null, false, this.urlState),
                this.dropTarget = new Div("Drag Files Here to Create Torrent", { className: "torrentDropTarget" }),
                new ButtonBar([
                    this.uploadButton = new Button("Save", this.upload, null, "btn-primary"),
                    new Button("Close", this.close)
                ], "marginTop")
            ])];

        this.dropTarget.whenElm((elm: HTMLElement) => {
            this.load();
        });
        return children;
    }

    load = () => {
        if (this.loaded) return;
        this.loaded = true;
        let client: any = new WebTorrent();

        dragDrop("#" + this.dropTarget.getId(), (files) => {
            client.seed(files, (torrent) => {
                console.log("Client is seeding " + torrent.magnetURI);
                this.urlState.setValue(torrent.magnetURI);
            })
        })
    }

    upload = (): void => {
        if (!this.validate()) {
            return;
        }

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

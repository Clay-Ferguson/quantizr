import { IPFSUtilIntf } from "./intf/IPFSUtilIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { EditCredentialsDlg } from "./dlg/EditCredentialsDlg";
import { store } from "./AppRedux";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class IPFSUtil implements IPFSUtilIntf {

    temporalUsr: string;
    temporalPwd: string;
    temporalToken: string;

    //ref: https://gateway.temporal.cloud/ipfs/Qm[hash]/account.html#account-api
    temporalLogin = async (): Promise<boolean> => {
        return new Promise<boolean>(async (resolve, reject) => {
            if (!this.temporalUsr || !this.temporalPwd) {
                console.error("No temporal credentials available.");
                return;
            }

            fetch(C.TEMPORAL_HOST + '/v2/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify({
                    username: this.temporalUsr,
                    password: this.temporalPwd
                })
            })//
                .then(res => res.json())//
                .catch(error => {
                    console.error(error);
                    resolve(false);
                    if (error) {
                        throw error;
                    }
                })//
                .then(response => {
                    //Why is this checking for expire ? (this came from the Temporal.cloud example)
                    if (response.expire) {
                        this.temporalToken = response.token;
                        S.log(response.token.toString());
                        resolve(true);
                    }
                    // Error handling here.
                })//
                .catch(error => {
                    console.error('#' + error)
                    resolve(false);
                });
        });
    }

    //ref: https://gateway.temporal.cloud/ipns/docs.api.temporal.cloud/ipfs.html#example
    uploadToTemporal = (file: File, jsonObj: any): void => {
        if (this.temporalToken) {
            console.error("Temporal login never completed.");
            return;
        }

        let xhr = new XMLHttpRequest();
        xhr.withCredentials = false;

        let data = new FormData();
        if (file) {
            data.append("file", file);
        }
        else if (jsonObj) {
            xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            xhr.send(JSON.stringify(jsonObj));
        }
        else {
            throw Error("nothing to send.");
        }
        data.append("hold_time", "1");

        xhr.addEventListener("readystatechange", () => {
            if (xhr.readyState === 4) {
                //S.log(S.util.prettyPrint(xhr));
                let result = JSON.parse(xhr.responseText);

                if (result.code === 200) {
                    S.log("Upload Result: " + result);
                }
                else {
                    // Error handling.
                    console.error("upload failed.");
                }
            }
        });

        xhr.open("POST", C.TEMPORAL_HOST + "/v2/ipfs/public/file/add");
        xhr.setRequestHeader("Cache-Control", "no-cache");
        xhr.setRequestHeader("Authorization", "Bearer " + this.temporalToken);
        xhr.send(data);
    }

    getTemporalCredentials = async (forceEdit: boolean): Promise<boolean> => {
        let appState = store.getState();
        return new Promise<boolean>(async (resolve, reject) => {
            this.temporalUsr = await S.localDB.getVal(C.LOCALDB_TEMPORAL_USR);
            this.temporalPwd = await S.localDB.getVal(C.LOCALDB_TEMPORAL_PWD);

            if (forceEdit || (!this.temporalUsr || !this.temporalPwd)) {
                let dlg = new EditCredentialsDlg(forceEdit ? "Temporal Credentials" : "Temporal Account Login",
                    C.LOCALDB_TEMPORAL_USR, C.LOCALDB_TEMPORAL_PWD, appState);
                await dlg.open();
                this.temporalUsr = dlg.usr;
                this.temporalPwd = dlg.pwd;
            }
            resolve(!!this.temporalUsr && !!this.temporalPwd);
        });
    }
}

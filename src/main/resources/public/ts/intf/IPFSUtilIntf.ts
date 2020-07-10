import * as I from "../Interfaces";
import * as J from "../JavaIntf";
import { AppState } from "../AppState";
import { AxiosPromise } from "axios";

export interface IPFSUtilIntf {
    temporalUsr: string;
    temporalPwd: string;
    temporalToken: string;

    temporalLogin(): Promise<boolean>;
    uploadToTemporal(file: File, jsonObj: any): void;
    getTemporalCredentials(forceEdit: boolean): Promise<boolean>;
}

import { AppState } from "../AppState";

export interface ActivityPubIntf {
    postNode(state: AppState) : void;
}
import { AppState } from "../AppState";
import * as J from "../JavaIntf";

export interface SpeechRecogIntf {
    speechActive: boolean;
    setCallback(callback: (string) => void): void;
    toggleActive(): void;
}

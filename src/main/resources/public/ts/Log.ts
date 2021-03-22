import { LogViewIntf } from "./intf/LogViewIntf";

export class Log {
    static errorCount: number = 0;
    static logView: LogViewIntf = null;

    public static error(e: any): any {
        if (!e) return;
        Log.errorCount++;
        console.error(e.message, e.stack);
    }

    public static log(msg: any): any {
        if (Log.logView) {
            Log.logView.log(msg);
        }
        console.log(msg);
    }
}

/*
Note: This will not get called in the main thread of JavaScript that runs during initialization
but will get called during normal operation when thing are happening as a result of actual user events
*/
window.onerror = function (message, url, line, col, e) {
    Log.error(e.stack);
    return true;
};

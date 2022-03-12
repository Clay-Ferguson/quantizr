import { LogViewIntf } from "./intf/LogViewIntf";
import { S } from "./Singletons";

export class Log {
    static errorCount: number = 0;
    static logView: LogViewIntf = null;
    static paramsChecked: boolean = false;
    static alertDebug: boolean = false;

    public static error(e: any): any {
        if (!e) return;
        Log.errorCount++;
        if (typeof e === "string") {
            console.error(e);
        }
        else {
            console.error(e.message, e.stack);
        }
    }

    public static log(msg: any): any {

        // This allows for alertDebug=1 param to be able to be
        // set on the URL to debug with alerts on platforms where there's
        // a problem starting up the app, and even the JS console is not usable.
        if (!Log.paramsChecked) {
            Log.paramsChecked = true;
            // todo-0: alertDebug has been replaced by -app-debug on url, which sets _debug global var.
            if (S.util.getParameterByName("alertDebug")) {
                Log.alertDebug = true;
            }
        }

        if (Log.alertDebug) {
            alert(msg);
        }
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
// move this to indexTemplate.html
// window.onerror = function (message, url, line, col, e) {
//     Log.error(e);
//     return true;
// };

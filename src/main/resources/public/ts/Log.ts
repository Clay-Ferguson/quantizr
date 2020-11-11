/*
Note: This will not get called in the main thread of JavaScript that runs during initialization
but will get called during normal operation when thing are happening as a result of actual user events
*/
window.onerror = function (message, url, line, col, e) {
    console.error(e.stack);
    return true;
};

export class Log {
    static errorCount: number = 0;

    public static error(e: any): any {
        Log.errorCount++;
        console.error(e.message, e.stack);
    }
}

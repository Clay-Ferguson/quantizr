import { AppTab } from "../comp/AppTab";
import { Heading } from "../comp/core/Heading";
import { Html } from "../comp/core/Html";
import { LogViewIntf } from "../intf/LogViewIntf";
import { TabBase } from "../intf/TabBase";
import { Log } from "../Log";

export class LogView extends AppTab<any> implements LogViewIntf {
    static logs: string = "";

    constructor(data: TabBase<any>) {
        super(data);
        data.inst = this;

        Log.logView = this;

        // For some reason I can't get the console.log override to work.
        // (function() {
        //     let oldLog = console.log;
        //     console.log = function (msg) {
        //         LogView.logs += msg;
        //         LogView.logs += "\n";
        //         oldLog.apply(console, arguments);
        //     };
        // })();
    }

    log(msg: string): any {
        LogView.logs += msg;
        LogView.logs += "\n";
    }

    override preRender(): boolean | null {
        this.children = [
            new Heading(3, "Log", { className: "logView" }),
            new Html("<pre>" + LogView.logs + "</pre>")
        ];
        return true;
    }

    // Opens the tab, querying the info from the server to update
    open = (_readOnly: boolean, _userId: string): any => {
    }
}

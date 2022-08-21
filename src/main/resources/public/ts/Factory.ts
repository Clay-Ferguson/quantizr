/*
This is a 'Factory', but the main thing it does is manage the singletons, somewhat analoglous to a SpringContext
but actually existing for mostly different reasons having to do with our need to support circular
references.

WARNING: Singletons (just like in Spring) are not allowed to do any logic that requires other modules
inside their constructors becasue there is no guarantee that all (or any) of the other Singletons have
been constructed yet.

NOTE: This Factory is allowed to import anything it wants and the way we allow Circular Dependencies to exist without
being a problem is by having the rule that no other modules are allowed to import this Factory module,
but only the interface of it.
*/
import { getDispatcher } from "./AppContext";
import { Attachment } from "./Attachment";
import { DomUtil } from "./DomUtil";
import { Edit } from "./Edit";
import { Encryption } from "./Encryption";
import { LocalDB } from "./LocalDB";
import { Nav } from "./Nav";
import { NodeUtil } from "./NodeUtil";
import { PluginMgr } from "./PluginMgr";
import { Props } from "./Props";
import { Quanta } from "./Quanta";
import { Render } from "./Render";
import { Search } from "./Search";
import { ServerPush } from "./ServerPush";
import { S } from "./Singletons";
import { SpeechRecog } from "./SpeechRecog";
import { TabUtil } from "./TabUtil";
import { User } from "./User";
import { Util } from "./Util";
import { View } from "./View";

console.log("Factory.ts imports complete");
export class Factory {

    /*
     * Just like in a SpringContext, we init all singletons up front and this allows circular references
     * to exist in any of the imports with no problems.
     */
    constructor() {
        try {
            console.log("Factory.ts creating instances");

            S.quanta = new Quanta();
            S.plugin = new PluginMgr();
            S.util = new Util();
            S.domUtil = new DomUtil();
            S.tabUtil = new TabUtil();
            S.nodeUtil = new NodeUtil();
            S.push = new ServerPush();
            S.edit = new Edit();
            S.attachment = new Attachment();
            S.encryption = new Encryption();
            S.nav = new Nav();
            S.props = new Props();
            S.render = new Render();
            S.srch = new Search();
            S.user = new User();
            S.view = new View();
            S.localDB = new LocalDB();
            S.speech = new SpeechRecog();

            console.log("Factory.ts instances ready.");
        }
        catch (e) {
            console.error("app failed to initialize components.");
        }
    }

    initApp() {
        try {
            console.log("calling initApp()");
            const interval = setInterval(() => {
                // we require that the AppContainer has ran and rendered already becasue we're doing state management
                // using the root component.
                if (getDispatcher()) {
                    clearInterval(interval);
                    S.quanta.initApp();
                }
            }, 10);
        }
        catch (e) {
            alert("initApp failed: " + e);
            console.error("initApp failed." + e);
        }
    }
}

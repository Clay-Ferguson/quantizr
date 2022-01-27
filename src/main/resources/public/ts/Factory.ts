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
import { Torrent } from "./Torrent";
import { User } from "./User";
import { Util } from "./Util";
import { View } from "./View";

// let S: Singletons = {} as any;

export class Factory {

    /*
     * Just like in a SpringContext, we init all singletons up front and this allows circular references
     * to exist in any of the imports with no problems.
     */
    constructor() {
        try {
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
            S.torrent = new Torrent();
        }
        catch (e) {
            alert("app failed to initialize components.");
        }
    }

    initApp() {
        // This is basically our main entrypoint into the app. This must ONLY be called after the SingletonsReady has been
        // called (line above) initializing all of them and wiring them all up.
        S.quanta.initApp();
    }
}

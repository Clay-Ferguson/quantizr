/*
This is a 'Factory', but the main thing it does is manage the singletons, somewhat analoglous to a
SpringContext (in Java) but actually existing for mostly different reasons having to do with our
need to support circular references.

WARNING: Singletons (just like in Spring) are not allowed to do any logic that requires other
modules inside their constructors because there is no guarantee that all (or any) of the other
Singletons have been constructed yet.
*/
import { AIUtil } from "./AIUtil";
import { Attach } from "./Attach";
import { Crypto } from "./Crypto";
import { DomUtil } from "./DomUtil";
import { Edit } from "./Edit";
import { HistoryUtil } from "./HistoryUtil";
import { LocalDB } from "./LocalDB";
import { Nav } from "./Nav";
import { NodeUtil } from "./NodeUtil";
import { PluginMgr } from "./PluginMgr";
import { Props } from "./Props";
import { Quanta } from "./Quanta";
import { Render } from "./Render";
import { RpcUtil } from "./RpcUtil";
import { Search } from "./Search";
import { ServerPush } from "./ServerPush";
import { S } from "./Singletons";
import { TTS } from "./TTS";
import { STT } from "./STT";
import { TabUtil } from "./TabUtil";
import { User } from "./User";
import { Util } from "./Util";
import { View } from "./View";

console.log("Factory.ts imports complete");
export class Factory {

    /*
     * Just like in a SpringContext, we init all singletons up front and this allows circular
     * references to exist in any of the imports with no problems.
     */
    constructor() {
        try {
            console.log("Factory.ts creating instances");

            S.quanta = new Quanta();
            S.plugin = new PluginMgr();
            S.util = new Util();
            S.aiUtil = new AIUtil();
            S.domUtil = new DomUtil();
            S.rpcUtil = new RpcUtil();
            S.tabUtil = new TabUtil();
            S.nodeUtil = new NodeUtil();
            S.histUtil = new HistoryUtil();
            S.push = new ServerPush();
            S.edit = new Edit();
            S.attachment = new Attach();
            S.crypto = new Crypto();
            S.nav = new Nav();
            S.props = new Props();
            S.render = new Render();
            S.srch = new Search();
            S.user = new User();
            S.view = new View();
            S.localDB = new LocalDB();
            S.tts = new TTS();
            S.stt = new STT();

            console.log("Factory.ts instances ready.");
        }
        catch (e) {
            const msg = "app failed to initialize components.";
            S.util.logErr(e, msg);
            alert(msg);
            throw e;
        }
    }
}

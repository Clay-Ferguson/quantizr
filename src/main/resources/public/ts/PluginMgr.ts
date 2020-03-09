import * as J from "./JavaIntf";
import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import { PluginMgrIntf } from "./intf/PluginMgrIntf";
import { RssTypeHandler } from "./plugins/RssTypeHandler";
import { IPFSNodeTypeHandler } from "./plugins/IPFSNodeTypeHandler";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class PluginMgr implements PluginMgrIntf {

    private typeHandlers: { [key: string]: TypeHandlerIntf } = {};

    addTypeHandler = (typeHandler: TypeHandlerIntf): void => {
        console.log("Adding TypeHandler: type="+typeHandler.getTypeName());
        this.typeHandlers[typeHandler.getTypeName()] = typeHandler;
    }

    getTypeHandler = (typeName: string): TypeHandlerIntf => {
        return this.typeHandlers[typeName];
    }

    getAllTypeHandlers = (): { [key: string]: TypeHandlerIntf } => {
        return this.typeHandlers;
    }

    initPlugins = (): void => {
        this.addTypeHandler(new RssTypeHandler());
        this.addTypeHandler(new IPFSNodeTypeHandler());
        // S.plugin.addTypeHandler("fs:file", new FileTypeHandler());
        // S.plugin.addTypeHandler("fs:folder", new FolderTypeHandler());

        //S.meta64.addTypeHandler("fs:lucene", this.luceneIndexTypeHandler);
    }
}


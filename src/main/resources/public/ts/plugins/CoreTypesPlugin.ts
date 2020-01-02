import { CoreTypesPluginIntf } from "../intf/CoreTypesPluginIntf";
import { Constants } from "../Constants";
import { Singletons } from "../Singletons";
import { PubSub } from "../PubSub";
import { TypeHandlerIntf } from "../intf/TypeHandlerIntf";
import { FileTypeHandler } from "./FileTypeHandler";
import { FolderTypeHandler } from "./FolderTypeHandler";
import { IPFSNodeTypeHandler } from "./IPFSNodeTypeHandler";

let S: Singletons;
PubSub.sub(Constants.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class CoreTypesPlugin implements CoreTypesPluginIntf {
    fileTypeHandler: TypeHandlerIntf = new FileTypeHandler(this);
    folderTypeHandler: TypeHandlerIntf = new FolderTypeHandler(this);
    ipfsNodeTypeHandler: TypeHandlerIntf = new IPFSNodeTypeHandler(this);
    // luceneIndexTypeHandler: TypeHandlerIntf = new LuceneIndexTypeHandler(this);

    init = () => {
        S.meta64.addTypeHandler("fs:file", this.fileTypeHandler);
        S.meta64.addTypeHandler("fs:folder", this.folderTypeHandler);
        S.meta64.addTypeHandler("ipfs:node", this.ipfsNodeTypeHandler);
        //S.meta64.addTypeHandler("fs:lucene", this.luceneIndexTypeHandler);
    }
}

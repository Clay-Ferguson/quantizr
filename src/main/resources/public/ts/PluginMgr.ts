import { Singletons } from "./Singletons";
import { PubSub } from "./PubSub";
import { Constants as C } from "./Constants";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import { PluginMgrIntf } from "./intf/PluginMgrIntf";
import { RssTypeHandler } from "./plugins/RssTypeHandler";
import { IPFSNodeTypeHandler } from "./plugins/IPFSNodeTypeHandler";
import { RepoRootTypeHandler } from "./plugins/RepoRootTypeHandler";
import { AccountTypeHandler } from "./plugins/AccountTypeHandler";
import { TrashNodeTypeHandler } from "./plugins/TrashNodeTypeHandler";
import { InboxNodeTypeHandler } from "./plugins/InboxNodeTypeHandler";
import { NotesNodeTypeHandler } from "./plugins/NotesNodeTypeHandler";
import { FriendsListTypeHandler } from "./plugins/FriendsListTypeHandler";
import { FriendTypeHandler } from "./plugins/FriendTypeHandler";
import { MarkdownTypeHandler } from "./plugins/MarkdownTypeHandler";
import { TextTypeHandler } from "./plugins/TextTypeHandler";
import { UserFeedTypeHandler } from "./plugins/UserFeedTypeHandler";
import { InboxEntryTypeHandler } from "./plugins/InboxEntryTypeHandler";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (s: Singletons) => {
    S = s;
});

export class PluginMgr implements PluginMgrIntf {

    private typeHandlers: { [key: string]: TypeHandlerIntf } = {};

    addTypeHandler = (typeHandler: TypeHandlerIntf): void => {
        //console.log("Adding TypeHandler: type=" + typeHandler.getTypeName());
        if (this.typeHandlers[typeHandler.getTypeName()]) {
            throw new Error("duplicate type handler: " + typeHandler.getTypeName());
        }
        this.typeHandlers[typeHandler.getTypeName()] = typeHandler;
    }

    getTypeHandler = (typeName: string): TypeHandlerIntf => {
        return this.typeHandlers[typeName];
    }

    getAllTypeHandlers = (): { [key: string]: TypeHandlerIntf } => {
        return this.typeHandlers;
    }

    //todo-1: make it so that some plugins can be flagged as 'admin only' and not show up on the menu to pick them.
    initPlugins = (): void => {
        /* We could have made each type base-class automatically register here, but they'd executed in nondeterminisitic order
        so it's better to just have this one place where we define all them in the order we want */
        this.addTypeHandler(new MarkdownTypeHandler());
        this.addTypeHandler(new TextTypeHandler());
        this.addTypeHandler(new RssTypeHandler());
        this.addTypeHandler(new IPFSNodeTypeHandler());
        this.addTypeHandler(new RepoRootTypeHandler());
        this.addTypeHandler(new AccountTypeHandler());
        this.addTypeHandler(new TrashNodeTypeHandler());
        this.addTypeHandler(new InboxNodeTypeHandler());
        this.addTypeHandler(new InboxEntryTypeHandler());
        this.addTypeHandler(new NotesNodeTypeHandler());
        this.addTypeHandler(new FriendsListTypeHandler());
        this.addTypeHandler(new FriendTypeHandler());
        this.addTypeHandler(new UserFeedTypeHandler());

        // S.plugin.addTypeHandler("fs:file", new FileTypeHandler());
        // S.plugin.addTypeHandler("fs:folder", new FolderTypeHandler());

        //S.meta64.addTypeHandler("fs:lucene", this.luceneIndexTypeHandler);
    }
}


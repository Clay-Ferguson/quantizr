import { PluginMgrIntf } from "./intf/PluginMgrIntf";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import { AccountTypeHandler } from "./plugins/AccountTypeHandler";
import { FriendsListTypeHandler } from "./plugins/FriendsListTypeHandler";
import { FriendTypeHandler } from "./plugins/FriendTypeHandler";
import { InboxEntryTypeHandler } from "./plugins/InboxEntryTypeHandler";
import { InboxNodeTypeHandler } from "./plugins/InboxNodeTypeHandler";
import { IPFSNodeTypeHandler } from "./plugins/IPFSNodeTypeHandler";
import { MarkdownTypeHandler } from "./plugins/MarkdownTypeHandler";
import { NotesNodeTypeHandler } from "./plugins/NotesNodeTypeHandler";
import { RepoRootTypeHandler } from "./plugins/RepoRootTypeHandler";
import { RssTypeHandler } from "./plugins/RssTypeHandler";
import { CalendarTypeHandler } from "./plugins/CalendarTypeHandler";
import { TextTypeHandler } from "./plugins/TextTypeHandler";
import { TrashNodeTypeHandler } from "./plugins/TrashNodeTypeHandler";
import { UserFeedTypeHandler } from "./plugins/UserFeedTypeHandler";

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
        this.addTypeHandler(new CalendarTypeHandler());
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

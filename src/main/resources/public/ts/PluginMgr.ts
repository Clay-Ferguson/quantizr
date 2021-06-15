import { PluginMgrIntf } from "./intf/PluginMgrIntf";
import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import { AccountTypeHandler } from "./plugins/AccountTypeHandler";
import { CalcTypeHandler } from "./plugins/CalcTypeHandler";
import { FriendsListTypeHandler } from "./plugins/FriendsListTypeHandler";
import { BlockedUsersTypeHandler } from "./plugins/BlockedUsersTypeHandler";
import { FriendTypeHandler } from "./plugins/FriendTypeHandler";
import { InboxEntryTypeHandler } from "./plugins/InboxEntryTypeHandler";
import { InboxNodeTypeHandler } from "./plugins/InboxNodeTypeHandler";
import { IPFSNodeTypeHandler } from "./plugins/IPFSNodeTypeHandler";
import { MarkdownTypeHandler } from "./plugins/MarkdownTypeHandler";
import { NotesNodeTypeHandler } from "./plugins/NotesNodeTypeHandler";
import { RepoRootTypeHandler } from "./plugins/RepoRootTypeHandler";
import { RssFeedsTypeHandler } from "./plugins/RssFeedsTypeHandler";
import { RssTypeHandler } from "./plugins/RssTypeHandler";
import { TextTypeHandler } from "./plugins/TextTypeHandler";
import { BookmarkTypeHandler } from "./plugins/BookmarkTypeHandler";
import { BookmarkListTypeHandler } from "./plugins/BookmarkListTypeHandler";

export class PluginMgr implements PluginMgrIntf {

    private typeHandlers: Map<string, TypeHandlerIntf> = new Map<string, TypeHandlerIntf>();

    addTypeHandler = (typeHandler: TypeHandlerIntf): void => {
        // console.log("Adding TypeHandler: type=" + typeHandler.getTypeName());
        if (this.typeHandlers.get(typeHandler.getTypeName())) {
            throw new Error("duplicate type handler: " + typeHandler.getTypeName());
        }
        this.typeHandlers.set(typeHandler.getTypeName(), typeHandler);
    }

    getTypeHandler = (typeName: string): TypeHandlerIntf => {
        return this.typeHandlers.get(typeName);
    }

    getAllTypeHandlers = (): Map<string, TypeHandlerIntf> => {
        return this.typeHandlers;
    }

    // todo-2: make it so that some plugins can be flagged as 'admin only' and not show up on the menu to pick them.
    initPlugins = (): void => {
        /* We could have made each type base-class automatically register here, but they'd executed in nondeterminisitic order
        so it's better to just have this one place where we define all them in the order we want */
        this.addTypeHandler(new MarkdownTypeHandler());
        this.addTypeHandler(new TextTypeHandler());
        this.addTypeHandler(new RssFeedsTypeHandler());
        this.addTypeHandler(new RssTypeHandler());
        this.addTypeHandler(new CalcTypeHandler());
        this.addTypeHandler(new IPFSNodeTypeHandler());
        this.addTypeHandler(new RepoRootTypeHandler());
        this.addTypeHandler(new AccountTypeHandler());
        this.addTypeHandler(new InboxNodeTypeHandler());
        this.addTypeHandler(new InboxEntryTypeHandler());
        this.addTypeHandler(new NotesNodeTypeHandler());
        this.addTypeHandler(new BookmarkTypeHandler());
        this.addTypeHandler(new BookmarkListTypeHandler());
        this.addTypeHandler(new FriendsListTypeHandler());
        this.addTypeHandler(new BlockedUsersTypeHandler());
        this.addTypeHandler(new FriendTypeHandler());
    }
}

import { TypeHandlerIntf } from "./intf/TypeHandlerIntf";
import { AccountTypeHandler } from "./plugins/AccountTypeHandler";
import { APPostsTypeHandler } from "./plugins/APPostsTypeHandler";
import { BlockedUsersTypeHandler } from "./plugins/BlockedUsersTypeHandler";
import { BookmarkListTypeHandler } from "./plugins/BookmarkListTypeHandler";
import { BookmarkTypeHandler } from "./plugins/BookmarkTypeHandler";
import { CalcTypeHandler } from "./plugins/CalcTypeHandler";
import { CalendarTypeHandler } from "./plugins/CalendarTypeHandler";
import { ExportsTypeHandler } from "./plugins/ExportsTypeHandler";
import { FriendsListTypeHandler } from "./plugins/FriendsListTypeHandler";
import { FriendTypeHandler } from "./plugins/FriendTypeHandler";
import { InboxEntryTypeHandler } from "./plugins/InboxEntryTypeHandler";
import { InboxNodeTypeHandler } from "./plugins/InboxNodeTypeHandler";
import { IPFSNodeTypeHandler } from "./plugins/IPFSNodeTypeHandler";
import { MarkdownTypeHandler } from "./plugins/MarkdownTypeHandler";
import { NotesNodeTypeHandler } from "./plugins/NotesNodeTypeHandler";
import { PostsTypeHandler } from "./plugins/PostsTypeHandler";
import { RepoRootTypeHandler } from "./plugins/RepoRootTypeHandler";
import { RoomTypeHandler } from "./plugins/RoomTypeHandler";
import { RssFeedsTypeHandler } from "./plugins/RssFeedsTypeHandler";
import { RssTypeHandler } from "./plugins/RssTypeHandler";
import { TextTypeHandler } from "./plugins/TextTypeHandler";
export class PluginMgr {

    private typeHandlers: Map<string, TypeHandlerIntf> = new Map<string, TypeHandlerIntf>();

    addTypeHandler = (typeHandler: TypeHandlerIntf) => {
        // console.log("Adding TypeHandler: type=" + typeHandler.getTypeName());
        if (this.typeHandlers.get(typeHandler.getTypeName())) {
            throw new Error("duplicate type handler: " + typeHandler.getTypeName());
        }
        this.typeHandlers.set(typeHandler.getTypeName(), typeHandler);
    }

    getTypeHandler = (typeName: string): TypeHandlerIntf => {
        const handler = this.typeHandlers.get(typeName);
        if (!handler) {
            console.warn("No type handler for: " + typeName);
        }
        return handler;
    }

    getAllTypeHandlers = (): Map<string, TypeHandlerIntf> => {
        return this.typeHandlers;
    }

    // todo-2: make it so that some plugins can be flagged as 'admin only' and not show up on the menu to pick them.
    initPlugins = () => {
        console.log("initPlugins()");

        /* We could have made each type base-class automatically register here, but they'd executed in nondeterminisitic order
        so it's better to just have this one place where we define all them in the order we want */
        this.addTypeHandler(new MarkdownTypeHandler());
        this.addTypeHandler(new TextTypeHandler());
        this.addTypeHandler(new RssFeedsTypeHandler());
        this.addTypeHandler(new RssTypeHandler());
        this.addTypeHandler(new CalcTypeHandler());
        this.addTypeHandler(new RoomTypeHandler());
        this.addTypeHandler(new CalendarTypeHandler());
        this.addTypeHandler(new IPFSNodeTypeHandler());
        this.addTypeHandler(new RepoRootTypeHandler());
        this.addTypeHandler(new AccountTypeHandler());
        this.addTypeHandler(new PostsTypeHandler());
        this.addTypeHandler(new APPostsTypeHandler());
        this.addTypeHandler(new ExportsTypeHandler());
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

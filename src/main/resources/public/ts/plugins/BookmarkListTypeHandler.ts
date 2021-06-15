import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class BookmarkListTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.BOOKMARK_LIST, "Bookmark List", "fa-bookmark", false);
    }
}

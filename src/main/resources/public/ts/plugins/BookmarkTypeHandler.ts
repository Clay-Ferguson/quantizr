import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class BookmarkTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.BOOKMARK, "Bookmark", "fa-bookmark", false);
    }
}

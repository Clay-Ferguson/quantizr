import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabBase } from "../intf/TabBase";
import { TypeBase } from "./base/TypeBase";

export class ExportsType extends TypeBase {
    constructor() {
        super(J.NodeType.EXPORTS, "Exports", "fa-briefcase", false);
    }

    override getAllowRowHeader(): boolean {
        return false;
    }

    override getEditorHelp(): string {
        return S.quanta.cfg.help?.editor?.dialog;
    }

    override isSpecialAccountNode(): boolean {
        return true;
    }

    override render = (_node: J.NodeInfo, _tabData: TabBase<any>, _rowStyling: boolean, _isTreeView: boolean): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, "Exports", { className: "noMargin" })
        ]);
    }
}

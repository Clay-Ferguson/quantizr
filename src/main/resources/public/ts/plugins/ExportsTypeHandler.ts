import { getAppState } from "../AppRedux";
import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Div } from "../comp/core/Div";
import { Heading } from "../comp/core/Heading";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { TypeBase } from "./base/TypeBase";

export class ExportsTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.EXPORTS, "Exports", "fa-briefcase", false);
    }

    getAllowRowHeader(): boolean {
        return false;
    }

    getEditorHelp(): string {
        let state = getAppState();
        return state.config?.help?.editor?.dialog;
    }

    isSpecialAccountNode(): boolean {
        return true;
    }

    render = (node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp => {
        return new Div(null, { className: "systemNodeContent" }, [
            new Heading(4, "Exports", {
                className: "marginAll"
            })
        ]);
    }
}

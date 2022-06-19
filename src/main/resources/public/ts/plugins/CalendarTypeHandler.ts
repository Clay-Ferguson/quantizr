import { AppState } from "../AppState";
import { Comp } from "../comp/base/Comp";
import { Button } from "../comp/core/Button";
import { ButtonBar } from "../comp/core/ButtonBar";
import { Div } from "../comp/core/Div";
import { NodeActionType } from "../enums/NodeActionType";
import { TabIntf } from "../intf/TabIntf";
import * as J from "../JavaIntf";
import { S } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

export class CalendarTypeHandler extends TypeBase {
    constructor() {
        super(J.NodeType.CALENDAR, "Calendar", "fa-calendar", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        return true;
    }

    render(node: J.NodeInfo, tabData: TabIntf<any>, rowStyling: boolean, isTreeView: boolean, state: AppState): Comp {
        let baseComp = super.render(node, tabData, rowStyling, isTreeView, state);
        return new Div(null, null, [
            baseComp,
            new ButtonBar([
                new Button("Future", () => {
                    S.srch.timeline(node, J.NodeProp.DATE_FULL, state, "futureOnly", "Future calendar dates (Soonest at the top)", 0, true);
                }, null),
                new Button("Calendar", () => {
                    S.render.showCalendar(node.id, state);
                }, null)
            ], "marginLeft marginBottom")
        ]);
    }
}

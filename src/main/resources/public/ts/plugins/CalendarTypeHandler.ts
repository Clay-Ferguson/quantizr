import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import { NodeActionType } from "../enums/NodeActionType";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { TypeBase } from "./base/TypeBase";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class CalendarTypeHandler extends TypeBase {

    constructor() {
        super(J.NodeType.CALENDAR_ENTRY, "Calendar Entry", "fa-calendar", true);
    }

    allowAction(action: NodeActionType, node: J.NodeInfo, appState: AppState): boolean {
        switch (action) {
        case NodeActionType.upload:
            return false;
        default:
            return true;
        }
    }

    getEditLabelForProp(propName: string): string {
        if (propName === J.NodeProp.DATE) {
            return "Date";
        }
        else if (propName === J.NodeProp.DURATION) {
            return "Duration (HH:MM)";
        }
        return propName;
    }

    getAllowPropertyAdd(): boolean {
        return false;
    }

    getAllowContentEdit(): boolean {
        return true;
    }

    getCustomProperties(): string[] {
        return [J.NodeProp.DATE, J.NodeProp.DURATION, "content"];
    }

    allowPropertyEdit(propName: string, state: AppState): boolean {
        return propName === J.NodeProp.DATE || propName === J.NodeProp.DURATION;
    }

    ensureDefaultProperties(node: J.NodeInfo) {
        this.ensureStringPropExists(node, J.NodeProp.DATE);
        this.ensureStringPropExists(node, J.NodeProp.DURATION);
    }
}

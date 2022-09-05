import { useAppState } from "../AppContext";
import { AppState } from "../AppState";
import { AppTab } from "../comp/AppTab";
import { Comp } from "../comp/base/Comp";
import { CompIntf } from "../comp/base/CompIntf";
import { Div } from "../comp/core/Div";
import { HelpButton } from "../comp/core/HelpButton";
import { TabIntf } from "../intf/TabIntf";

export class IPSMView extends AppTab {
    constructor(data: TabIntf) {
        super(data);
        data.inst = this;
    }

    preRender(): void {
        const state = useAppState();

        this.attribs.className = this.getClass(state);
        const children: Comp[] = [];

        children.push(new Div(null, null, [
            new Div(null, { className: "marginTop" }, [
                this.renderHeading(state)
            ]),
            new Div("Realtime IPFS PubSub events from ipsm-heartbeat topic..."),
            new HelpButton(() => {
                return "IPSM Console\nThis is a diagnostic view which shows unfiltered IPFS PubSub messages " + //
                    " being posted to 'ipsm-heartbeat'. Peers can send up to only 10 events per minute, and messages " + //
                    " sent at a faster rate than that, from any specific peer, get ignored.";
            })
        ]));

        if (this.data.props?.events) {
            this.data.props.events.forEach((e: string) => {
                children.push(new Div(e, { className: "ipsmFeedItem" }));
            });
        }

        this.setChildren([new Div(null, { className: "feedView" }, children)]);
    }

    /* overridable (don't use arrow function) */
    renderHeading(state: AppState): CompIntf {
        return new Div("IPSM Console", { className: "tabTitle" });
    }
}

import { useSelector } from "react-redux";
import { AppState } from "../AppState";
import { Constants as C } from "../Constants";
import * as J from "../JavaIntf";
import { PubSub } from "../PubSub";
import { Singletons } from "../Singletons";
import { Main } from "./Main";
import React, { ReactNode } from "react";

/* ========= WARNING ========= 
Do not re-arrange these imports because fullcalendar will have a problem if you do!!! It needs to load them in this order.
*/
import FullCalendar, { EventApi, DateSelectArg, EventClickArg, EventContentArg, formatDate } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FullScreenCalendar extends Main {

    state: AppState;

    _render = (props: any): ReactNode => {
        this.state = useSelector((state: AppState) => state);
        let nodeId = this.state.fullScreenCalendarId;
        let node: J.NodeInfo = S.meta64.findNodeById(this.state, nodeId);

        if (!node) {
            console.log("Can't find nodeId " + nodeId);
        }

        return React.createElement(FullCalendar, {
            plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
            headerToolbar: {
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay"
            },
            initialView: "dayGridMonth",
            editable: true,
            selectable: true,
            selectMirror: true,
            dayMaxEvents: true,
            //weekends: this.state.weekendsVisible,
            initialEvents: this.state.calendarData, // alternatively, use the `events` setting to fetch from a feed
            // select: {this.handleDateSelect},
            eventContent: renderEventContent, // custom render function
            eventClick: this.handleEventClick
            // eventsSet: {this.handleEvents}

        }, null);
    }

    handleEventClick = (clickInfo: EventClickArg) => {
        S.edit.cached_runEditNode(clickInfo.event.id, this.state);
    }
}

function renderEventContent(eventContent: EventContentArg) {
    return (
        <>
            <b>{eventContent.timeText} - </b>
            <i>{eventContent.event.title}</i>
        </>
    );
}

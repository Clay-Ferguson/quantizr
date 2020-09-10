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
import { INITIAL_EVENTS, createEventId } from "../event-utils";

let S: Singletons;
PubSub.sub(C.PUBSUB_SingletonsReady, (ctx: Singletons) => {
    S = ctx;
});

export class FullScreenCalendar extends Main {

    _render = (props: any): ReactNode => {
        let state: AppState = useSelector((state: AppState) => state);
        let nodeId = state.fullScreenCalendarId;
        let node: J.NodeInfo = S.meta64.findNodeById(state, nodeId);

        if (!node) {
            console.log("Can't find nodeId " + nodeId);
        }

        return React.createElement(FullCalendar /* CalendarDemo*/, {
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
            initialEvents: INITIAL_EVENTS, // alternatively, use the `events` setting to fetch from a feed
            // select: {this.handleDateSelect},
            eventContent: renderEventContent, // custom render function
            eventClick: this.handleEventClick,
            // eventsSet: {this.handleEvents}

        }, null);
    }

    handleEventClick = (clickInfo: EventClickArg) => {
        // if (confirm(`Are you sure you want to delete the event '${clickInfo.event.title}'`)) {
        //     clickInfo.event.remove();
        // }
    }

}

function renderEventContent(eventContent: EventContentArg) {
    return (
        <>
            <b>{eventContent.timeText}</b>
            <i>{eventContent.event.title}</i>
        </>
    );
}

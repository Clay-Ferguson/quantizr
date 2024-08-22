import { S } from "../Singletons";
import { Main } from "./Main";
import { ReactNode, createElement } from "react";
import { dispatch, getAs } from "../AppContext";

/* ========= WARNING =========
Do not re-arrange these imports because fullcalendar will have a problem if you do!!! It needs to load them in this order.
*/
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { DateClickArg } from "@fullcalendar/interaction";

export class FullScreenCalendar extends Main {
    static lastClickTime: Date;

    constructor() {
        super();
        this.domUpdateEvent = this.domUpdateEvent.bind(this);
    }

    override compRender = (): ReactNode => {
        const state = getAs();
        const nodeId = state.fullScreenConfig.nodeId;
        const node = S.nodeUtil.findNode(nodeId);

        if (!node) {
            console.log("Can't find nodeId " + nodeId);
        }

        this.attribs.className = "marginAll";

        this.children = [
            createElement(FullCalendar, {
                plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
                headerToolbar: {
                    left: "prev,next today,weekendsEventButton,addEventButton,closeCalendarButton",
                    center: "title",
                    right: "dayGridMonth,timeGridWeek,timeGridDay"
                },

                // WARNING: setting window sizes, or even this aspect ratio causes a bug when the user resizes the window
                // and this bug completely disables the app.
                // aspectRatio: 2.4,

                initialDate: FullScreenCalendar.lastClickTime || new Date(),
                initialView: "dayGridMonth",
                editable: false,
                selectable: false,
                selectMirror: true,
                dayMaxEvents: true,
                weekends: state.calendarShowWeekends,
                initialEvents: state.calendarData,
                dateClick: this.dateClick,
                eventContent: (eventContent: any) => createElement("div", null,
                    createElement("b", null, eventContent.timeText + " -> "),
                    createElement("i", null, eventContent.event.title)
                ),
                eventClick: this.handleEventClick,

                customButtons: {
                    addEventButton: {
                        text: "add",
                        click: () => {
                            FullScreenCalendar.lastClickTime = FullScreenCalendar.lastClickTime || new Date();
                            S.edit.addCalendarEntry(FullScreenCalendar.lastClickTime.getTime());
                        }
                    },
                    closeCalendarButton: {
                        text: "Close",
                        click: () => {
                            S.nav.closeFullScreenViewer();
                        }
                    },
                    weekendsEventButton: {
                        text: "weekend",
                        click: () => {
                            dispatch("Action_CalendarToggleWeekends", s => {
                                s.calendarShowWeekends = !state.calendarShowWeekends;
                                return s;
                            });
                        }
                    }
                }
            })
        ];
        return this.reactNode("div");
    }

    dateClick = (dateClick: DateClickArg): void => {
        FullScreenCalendar.lastClickTime = dateClick.date;
        const calendarApi = dateClick.view.calendar;
        calendarApi.changeView("timeGridDay");
        calendarApi.gotoDate(dateClick.date);
    }

    handleDateSelect = (_selectInfo: any) => {
    }

    handleEventClick = (clickInfo: any) => {
        S.edit.runEditNode(null, clickInfo.event.id, false, true, false, null);
    }

    override domUpdateEvent = (): void => {
        // #DEBUG-SCROLLING
        S.view.docElm.scrollTop = 0;
    }
}
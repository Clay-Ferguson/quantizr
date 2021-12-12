package quanta.response;

import java.util.LinkedList;

import quanta.model.CalendarItem;
import quanta.response.base.ResponseBase;

public class RenderCalendarResponse extends ResponseBase {
	private LinkedList<CalendarItem> items;

	public LinkedList<CalendarItem> getItems() {
		return items;
	}

	public void setItems(LinkedList<CalendarItem> items) {
		this.items = items;
	}
}

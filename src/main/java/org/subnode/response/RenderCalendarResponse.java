package org.subnode.response;

import java.util.LinkedList;

import org.subnode.model.CalendarItem;
import org.subnode.response.base.ResponseBase;

public class RenderCalendarResponse extends ResponseBase {
	private LinkedList<CalendarItem> items;

	public LinkedList<CalendarItem> getItems() {
		return items;
	}

	public void setItems(LinkedList<CalendarItem> items) {
		this.items = items;
	}
}

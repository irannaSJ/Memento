# Copyright (c) 2026, Sagar Patil and contributors
# For license information, please see license.txt

from frappe.model.document import Document
from frappe.utils import now_datetime, get_datetime

class ToDoTable(Document):

    def before_insert(self):
        if not self.task_start_time:
            self.task_start_time = now_datetime()

    def validate(self):

        for row in self.task_todo:

            if row.status == 1:

                if not row.end_on:
                    row.end_on = now_datetime()

                if row.start_on and row.end_on:

                    start = get_datetime(row.start_on)
                    end = get_datetime(row.end_on)

                    duration = int((end - start).total_seconds())

                    hours, remainder = divmod(duration, 3600)
                    minutes, seconds = divmod(remainder, 60)

                    row.total_duration = f"{hours}h {minutes}m {seconds}s"

            else:
                row.end_on = None
                row.total_duration = ""
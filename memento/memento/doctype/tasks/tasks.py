# Copyright (c) 2026, Sagar Patil and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, get_datetime


class Tasks(Document):

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

                    total_seconds = int((end - start).total_seconds())

                    days, remainder = divmod(total_seconds, 86400)
                    hours, remainder = divmod(remainder, 3600)
                    minutes, seconds = divmod(remainder, 60)

                    row.total_duration = (
                        f"{days}d {hours}h {minutes}m {seconds}s"
                    )

            else:
                row.end_on = None
                row.total_duration = ""

    def on_update(self):

        if self.status == "Completed" and not self.task_end_time:

            end_time = now_datetime()
            start_time = get_datetime(self.task_start_time)

            duration = (end_time - start_time).total_seconds()

            self.db_set("task_end_time", end_time)
            self.db_set("total_duration", duration)

        elif self.status != "Completed" and self.task_end_time:

            self.db_set("task_end_time", None)
            self.db_set("total_duration", 0)

import re
from html import escape, unescape

import frappe
from frappe import _
from frappe.utils import getdate

from memento.api_endpoints.permissions import (
	require_authenticated_user,
	require_doctype_permission,
)
from memento.api_endpoints.utils import success_response


def _html_to_plain_text(value: str | None) -> str:
	if not value:
		return ""
	text = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
	text = re.sub(r"</p\s*>", "\n", text, flags=re.IGNORECASE)
	text = re.sub(r"<[^>]+>", "", text)
	return unescape(text).strip()


def _plain_text_to_html(value: str) -> str:
	lines = [escape(line) for line in value.strip().splitlines()]
	return "<br>".join(lines)


def _serialize_comment(row: dict, current_user: str) -> dict:
	owner = row.get("owner") or ""
	author_name = row.get("comment_by") or frappe.db.get_value("User", owner, "full_name") or owner
	return {
		"name": row.get("name"),
		"content": _html_to_plain_text(row.get("content")),
		"owner": owner,
		"author_name": author_name,
		"is_owner": owner == current_user,
		"creation": str(row.get("creation") or ""),
		"modified": str(row.get("modified") or ""),
	}


def _sync_task_todos_to_log(log_doc, task_id: str) -> None:
	"""Copy the Task's task_todo child rows into Task Log's todo child table."""
	task_doc = frappe.get_doc("Tasks", task_id)
	task_todos = task_doc.get("task_todo") or []

	log_doc.set("todo", [])
	for item in task_todos:
		log_doc.append(
			"todo",
			{
				"todo": item.todo,
				"status": item.status,
				"user": item.user,
				"start_on": item.start_on,
				"end_on": item.end_on,
				"total_duration": item.total_duration,
			},
		)


def _get_or_create_task_log(task_id: str, date_str: str):
	if not frappe.db.exists("Tasks", task_id):
		frappe.throw(
			_("Task '{0}' does not exist.").format(task_id),
			frappe.DoesNotExistError,
		)

	normalized_date = str(getdate(date_str))
	existing_name = frappe.db.get_value(
		"Task Log",
		{"task_id": task_id, "today": normalized_date},
		"name",
	)

	if existing_name:
		log_doc = frappe.get_doc("Task Log", existing_name)
		_sync_task_todos_to_log(log_doc, task_id)
		return log_doc

	require_doctype_permission("Task Log", "create")

	log_doc = frappe.get_doc(
		{
			"doctype": "Task Log",
			"task_id": task_id,
			"today": normalized_date,
		}
	)
	_sync_task_todos_to_log(log_doc, task_id)
	log_doc.insert()
	return log_doc


@frappe.whitelist()
def get_task_activity(task_id: str, date: str) -> dict:
	"""Return the Task Log, its comments, and active log dates for a Task."""
	user = require_authenticated_user()
	require_doctype_permission("Task Log", "read")

	if not task_id or not str(task_id).strip():
		frappe.throw(_("Task ID is required."), frappe.ValidationError)

	if not date or not str(date).strip():
		frappe.throw(_("Date is required."), frappe.ValidationError)

	task_id = str(task_id).strip()
	normalized_date = str(getdate(date))

	all_logs = frappe.get_all(
		"Task Log",
		filters={"task_id": task_id},
		fields=["name", "today"],
		order_by="today desc",
		limit_page_length=200,
	)
	logged_dates = sorted({str(row["today"]) for row in all_logs if row.get("today")})

	log_row = frappe.db.get_value(
		"Task Log",
		{"task_id": task_id, "today": normalized_date},
		["name", "today", "task_id", "owner", "creation", "modified"],
		as_dict=True,
	)

	if not log_row:
		return success_response(
			data={
				"task_log": None,
				"comments": [],
				"logged_dates": logged_dates,
			},
			message="No activity log found for the selected date.",
		)

	comment_rows = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Task Log",
			"reference_name": log_row["name"],
			"comment_type": "Comment",
		},
		fields=[
			"name",
			"content",
			"owner",
			"comment_by",
			"creation",
			"modified",
		],
		order_by="creation asc",
		limit_page_length=200,
	)

	comments = [_serialize_comment(row, user) for row in comment_rows]

	return success_response(
		data={
			"task_log": {
				"name": log_row["name"],
				"today": str(log_row["today"]),
				"task_id": log_row["task_id"],
				"owner": log_row["owner"],
				"creation": str(log_row["creation"]),
				"modified": str(log_row["modified"]),
			},
			"comments": comments,
			"logged_dates": logged_dates,
		},
		message="Task activity retrieved successfully.",
	)


@frappe.whitelist()
def add_task_activity_comment(
	task_id: str,
	date: str,
	content: str,
) -> dict:
	"""Create/update Task Log (with Task To-Dos) for (task_id, date) and add a Comment."""
	user = require_authenticated_user()
	require_doctype_permission("Task Log", "write")

	if not task_id or not str(task_id).strip():
		frappe.throw(_("Task ID is required."), frappe.ValidationError)

	if not date or not str(date).strip():
		frappe.throw(_("Date is required."), frappe.ValidationError)

	clean_text = str(content or "").strip()
	if not clean_text:
		frappe.throw(_("Comment cannot be empty."), frappe.ValidationError)

	log_doc = _get_or_create_task_log(str(task_id).strip(), str(date).strip())
	comment_doc = log_doc.add_comment("Comment", text=_plain_text_to_html(clean_text))

	# Persist synced To-Do child rows and update modified timestamp
	log_doc.save(ignore_permissions=True)

	serialized = _serialize_comment(
		{
			"name": comment_doc.name,
			"content": comment_doc.content,
			"owner": comment_doc.owner or user,
			"comment_by": comment_doc.comment_by,
			"creation": comment_doc.creation,
			"modified": comment_doc.modified,
		},
		user,
	)

	return success_response(
		data={
			"task_log": {
				"name": log_doc.name,
				"today": str(log_doc.today),
				"task_id": log_doc.task_id,
				"owner": log_doc.owner,
				"creation": str(log_doc.creation),
				"modified": str(log_doc.modified),
			},
			"comment": serialized,
		},
		message="Comment added successfully.",
	)


@frappe.whitelist()
def update_task_activity_comment(
	comment_name: str,
	content: str,
) -> dict:
	"""Edit an existing comment linked to a Task Log."""
	user = require_authenticated_user()
	require_doctype_permission("Task Log", "write")

	if not comment_name or not frappe.db.exists("Comment", comment_name):
		frappe.throw(_("Comment does not exist."), frappe.DoesNotExistError)

	clean_text = str(content or "").strip()
	if not clean_text:
		frappe.throw(_("Comment cannot be empty."), frappe.ValidationError)

	comment_doc = frappe.get_doc("Comment", comment_name)

	if comment_doc.reference_doctype != "Task Log":
		frappe.throw(
			_("This comment does not belong to a Task Log."),
			frappe.PermissionError,
		)

	if comment_doc.owner != user and "System Manager" not in frappe.get_roles(user):
		frappe.throw(
			_("You can only edit your own comments."),
			frappe.PermissionError,
		)

	comment_doc.content = _plain_text_to_html(clean_text)
	comment_doc.save(ignore_permissions=True)

	if comment_doc.reference_name and frappe.db.exists("Task Log", comment_doc.reference_name):
		frappe.db.set_value(
			"Task Log",
			comment_doc.reference_name,
			"modified",
			frappe.utils.now_datetime(),
		)

	return success_response(
		data={
			"comment": _serialize_comment(comment_doc.as_dict(), user),
		},
		message="Comment updated successfully.",
	)


@frappe.whitelist()
def delete_task_activity_comment(comment_name: str) -> dict:
	"""Delete an existing comment linked to a Task Log."""
	user = require_authenticated_user()
	require_doctype_permission("Task Log", "write")

	if not comment_name or not frappe.db.exists("Comment", comment_name):
		frappe.throw(_("Comment does not exist."), frappe.DoesNotExistError)

	comment_doc = frappe.get_doc("Comment", comment_name)

	if comment_doc.reference_doctype != "Task Log":
		frappe.throw(
			_("This comment does not belong to a Task Log."),
			frappe.PermissionError,
		)

	if comment_doc.owner != user and "System Manager" not in frappe.get_roles(user):
		frappe.throw(
			_("You can only delete your own comments."),
			frappe.PermissionError,
		)

	frappe.delete_doc("Comment", comment_name, ignore_permissions=True)

	return success_response(
		data={"name": comment_name},
		message="Comment deleted successfully.",
	)

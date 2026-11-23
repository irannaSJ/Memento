import html
import re

import frappe
from frappe import _
from frappe.utils import cint, get_fullname, now_datetime


def _check(doctype, name):
	# default anchor is the user's own User record, always allowed
	# if doctype == "User" and name == frappe.session.user:
	# 	return
	frappe.has_permission(doctype, "read", doc=name, throw=True)


def _plain(content):
	"""Comment content is HTML (quill). Reduce it to plain text for the page."""
	text = re.sub(r"<br\s*/?>|</p>|</div>", "\n", content or "")
	text = re.sub(r"<[^>]+>", "", text)
	return html.unescape(text).strip()


def _row(c):
	return {
		"name": c.name,
		"text": _plain(c.todo),
		"owner": c.owner,
		"full_name": get_fullname(c.owner),
		"creation": c.creation,
		"todo_done": cint(c.get("todo_done")),
		"todo_done_on": c.get("todo_done_on"),
	}


def _load(name):
	c = frappe.db.get_value(
		"ToDo Table",
		name,
		["name", "user", "parent", "parenttype"],
		as_dict=True,
	)
	if not c:
		frappe.throw(_("Todo not found"), frappe.DoesNotExistError)
	_check(c.parent, c.parenttype)
	return c


@frappe.whitelist()
def get_todos(task_id, doctype):
	_check(doctype, task_id)
	rows = frappe.get_all(
		"ToDo Table",
		filters={
			"parent": task_id,
			"parenttype": doctype,
		},
		fields=["name", "todo", "user", "start_on","end_on","status","total_duration","creation"],
		order_by="creation asc",
	)
	return [_row(r) for r in rows]

# @frappe.whitelist()
# def get_todos(reference_doctype, reference_name):
# 	_check(reference_doctype, reference_name)
# 	rows = frappe.get_all(
# 		"Comment",
# 		filters={
# 			"comment_type": "Comment",
# 			"reference_doctype": reference_doctype,
# 			"reference_name": reference_name,
# 		},
# 		fields=["name", "content", "owner", "creation", "todo_done", "todo_done_on"],
# 		order_by="creation asc",
# 	)
# 	return [_row(r) for r in rows]


@frappe.whitelist()
def add_todo(doctype, task_id, todo):
	# _check(reference_doctype, reference_name)
	text = (todo or "").strip()
	if not text:
		frappe.throw(_("Todo cannot be empty"))

	body = html.escape(text).replace("\n", "<br>")
	doc = frappe.get_doc(
		{
			"doctype": "ToDo Table",
			"todo":text,
			"parent": task_id,
			"parenttype": doctype,
			"user": frappe.session.user,
			"status": 0
		}
	)
	doc.insert(ignore_permissions=True)
	return _row(doc)


@frappe.whitelist()
def set_done(name, done):
	_load(name)
	done = cint(done)
	on = now_datetime() if done else None
	frappe.db.set_value("ToDo Table", name, {"status": done, "end_on": on})
	return {"todo_done": done, "todo_done_on": on}


@frappe.whitelist()
def delete_todo(name):
	c = _load(name)
	if c.owner != frappe.session.user and "System Manager" not in frappe.get_roles():
		frappe.throw(_("You can only delete your own todos"), frappe.PermissionError)
	frappe.delete_doc("ToDo Table", name, ignore_permissions=True, force=True)
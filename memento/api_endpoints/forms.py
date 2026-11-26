"""
Create and update endpoints for Memento records.

These endpoints:
- Require an authenticated user.
- Restrict access to configured DocTypes and fields.
- Check Frappe DocType and document permissions.
- Use normal Frappe document validation and save operations.
"""

import frappe
from frappe import _
from frappe.utils import now_datetime, time_diff_in_seconds

from memento.api_endpoints.doctype_config import get_doctype_config
from memento.api_endpoints.permissions import (
	require_doctype_permission,
	validate_field_payload,
)
from memento.api_endpoints.utils import (
	parse_json_input,
	success_response,
)

# Defense-in-depth protection for framework-managed fields.
PROTECTED_FIELDS = {
	"name",
	"owner",
	"creation",
	"modified",
	"modified_by",
	"docstatus",
	"parent",
	"parentfield",
	"parenttype",
	"idx",
}


def _parse_and_validate_payload(
	doctype: str,
	data,
	operation: str,
) -> dict:
	"""Parse a JSON object and validate its field names."""
	payload = parse_json_input(
		data,
		field_name="data",
		expected_type=dict,
	)

	if not payload:
		frappe.throw(
			_("The data payload cannot be empty."),
			frappe.ValidationError,
		)

	protected = sorted(PROTECTED_FIELDS.intersection(payload.keys()))

	if protected:
		frappe.throw(
			_("System-managed fields cannot be supplied: {0}").format(", ".join(protected)),
			frappe.PermissionError,
		)

	return validate_field_payload(
		doctype=doctype,
		payload=payload,
		operation=operation,
	)


def _apply_payload(doc, payload: dict) -> None:
	"""Assign validated values through the Frappe Document API."""
	for fieldname, value in payload.items():
		doc.set(fieldname, value)


def _create_child_record(
	doctype: str,
	config: dict,
	payload: dict,
) -> dict:
	"""Append a child row to its parent document and save."""
	parent_doctype = config["parent_doctype"]
	parent_field = config["parent_field"]

	task_id = str(payload.get("task_id") or "").strip()
	if not task_id:
		frappe.throw(
			_("Please select a Task before adding a To-Do."),
			frappe.ValidationError,
		)

	if not frappe.db.exists(parent_doctype, task_id):
		frappe.throw(
			_("Parent {0} '{1}' was not found.").format(parent_doctype, task_id),
			frappe.DoesNotExistError,
		)

	parent_doc = frappe.get_doc(parent_doctype, task_id)
	require_doctype_permission(
		parent_doctype,
		permission_type="write",
		doc=parent_doc,
	)

	todo_text = str(payload.get("todo") or "").strip()
	if not todo_text:
		frappe.throw(
			_("To-do item cannot be empty."),
			frappe.ValidationError,
		)

	row = parent_doc.append(
		parent_field,
		{
			"todo": todo_text,
			"status": 0,
			"user": frappe.session.user,
			"start_on": now_datetime(),
		},
	)

	parent_doc.save()

	return success_response(
		data={
			"doctype": doctype,
			"name": row.name,
		},
		message=f"{config['label']} record created successfully.",
	)


def _update_child_record(
	doctype: str,
	name: str,
	config: dict,
	payload: dict,
) -> dict:
	"""Update an existing child row on its parent document and save."""
	parent_doctype = config["parent_doctype"]
	parent_field = config["parent_field"]

	parent_name = frappe.db.get_value(doctype, name, "parent")
	if not parent_name or not frappe.db.exists(parent_doctype, parent_name):
		frappe.throw(
			_("Parent record for {0} was not found.").format(name),
			frappe.DoesNotExistError,
		)

	parent_doc = frappe.get_doc(parent_doctype, parent_name)
	require_doctype_permission(
		parent_doctype,
		permission_type="write",
		doc=parent_doc,
	)

	target_row = next(
		(row for row in parent_doc.get(parent_field, []) if row.name == name),
		None,
	)

	if not target_row:
		frappe.throw(
			_("Record not found."),
			frappe.DoesNotExistError,
		)

	if "todo" in payload and payload["todo"] is not None:
		todo_text = str(payload["todo"]).strip()
		if not todo_text:
			frappe.throw(
				_("To-do item cannot be empty."),
				frappe.ValidationError,
			)
		target_row.todo = todo_text

	if "status" in payload:
		is_done = 1 if int(payload["status"] or 0) == 1 else 0
		target_row.status = is_done

		if is_done:
			end_dt = now_datetime()
			target_row.end_on = end_dt
			if target_row.start_on:
				target_row.total_duration = max(
					0,
					int(time_diff_in_seconds(end_dt, target_row.start_on)),
				)
		else:
			target_row.end_on = None
			target_row.total_duration = 0

	parent_doc.save()

	return success_response(
		data={
			"doctype": doctype,
			"name": target_row.name,
		},
		message=f"{config['label']} record updated successfully.",
	)


@frappe.whitelist(methods=["POST"])
def create_doctype_record(
	doctype: str,
	data,
) -> dict:
	"""Create a record in an approved DocType.

	API path:
	/api/method/memento.api_endpoints.forms.create_doctype_record

	The data argument may be a JSON object or a JSON-encoded string.
	"""
	require_doctype_permission(
		doctype,
		permission_type="create",
	)

	config = get_doctype_config(doctype)

	payload = _parse_and_validate_payload(
		doctype=doctype,
		data=data,
		operation="create",
	)

	if config.get("is_child_table"):
		return _create_child_record(
			doctype=doctype,
			config=config,
			payload=payload,
		)

	doc = frappe.new_doc(doctype)
	_apply_payload(doc, payload)

	# Normal Frappe insert: validation and permission checks remain enabled.
	doc.insert()

	return success_response(
		data={
			"doctype": doctype,
			"name": doc.name,
		},
		message=f"{config['label']} record created successfully.",
	)


@frappe.whitelist(methods=["POST"])
def update_doctype_record(
	doctype: str,
	name: str,
	data,
) -> dict:
	"""Update an existing record in an approved DocType.

	API path:
	/api/method/memento.api_endpoints.forms.update_doctype_record

	The data argument may be a JSON object or a JSON-encoded string.
	"""
	require_doctype_permission(
		doctype,
		permission_type="write",
	)

	if not isinstance(name, str) or not name.strip():
		frappe.throw(
			_("A valid record name is required."),
			frappe.ValidationError,
		)

	name = name.strip()

	if not frappe.db.exists(doctype, name):
		frappe.throw(
			_("Record not found."),
			frappe.DoesNotExistError,
		)

	config = get_doctype_config(doctype)

	payload = _parse_and_validate_payload(
		doctype=doctype,
		data=data,
		operation="update",
	)

	if config.get("is_child_table"):
		return _update_child_record(
			doctype=doctype,
			name=name,
			config=config,
			payload=payload,
		)

	# Load the document and check permission for this specific record.
	doc = frappe.get_doc(doctype, name)

	require_doctype_permission(
		doctype,
		permission_type="write",
		doc=doc,
	)

	_apply_payload(doc, payload)

	# Normal Frappe save: validation and permission checks remain enabled.
	doc.save()

	return success_response(
		data={
			"doctype": doctype,
			"name": doc.name,
		},
		message=f"{config['label']} record updated successfully.",
	)

import frappe
from frappe import _

from memento.api_endpoints.doctype_config import (
	get_allowed_doctypes,
	get_child_table_config,
	get_doctype_config,
)
from memento.api_endpoints.permissions import (
	get_permitted_fields,
	require_authenticated_user,
	require_doctype_permission,
)
from memento.api_endpoints.utils import success_response

# ============================================================
# METADATA CONFIGURATION
# ============================================================

PURPOSE_FIELD_GROUPS = {
	"list": "list_fields",
	"form": "form_fields",
	"create": "create_fields",
	"update": "update_fields",
	"search": "search_fields",
}

LINK_FIELD_TYPES = {"Link"}
DYNAMIC_LINK_FIELD_TYPES = {"Dynamic Link"}
CHILD_TABLE_FIELD_TYPES = {"Table", "Table MultiSelect"}


# ============================================================
# OPERATION CAPABILITIES
# ============================================================


def _get_operation_capabilities(doctype: str, user: str) -> dict:
	config = get_doctype_config(doctype)

	if config.get("is_child_table"):
		parent_doctype = config.get("parent_doctype") or doctype
		can_read = bool(frappe.has_permission(parent_doctype, ptype="read", user=user))
		can_write = bool(frappe.has_permission(parent_doctype, ptype="write", user=user))
		return {
			"can_read": can_read,
			"can_create": can_write,
			"can_update": can_write,
			"can_delete": can_write,
		}

	return {
		"can_read": bool(
			frappe.has_permission(
				doctype,
				ptype="read",
				user=user,
			)
		),
		"can_create": bool(
			frappe.has_permission(
				doctype,
				ptype="create",
				user=user,
			)
		),
		"can_update": bool(
			frappe.has_permission(
				doctype,
				ptype="write",
				user=user,
			)
		),
		"can_delete": bool(
			frappe.has_permission(
				doctype,
				ptype="delete",
				user=user,
			)
		),
	}


# ============================================================
# SERIALIZE FIELD METADATA
# ============================================================


def _serialize_field_metadata(field) -> dict:
	"""
	Convert a Frappe DocField into frontend-friendly metadata.

	This function serializes one field only. Child-table
	metadata is attached separately using the configured
	parent-to-child field allowlist.
	"""

	result = {
		"fieldname": field.fieldname,
		"label": (field.label or field.fieldname.replace("_", " ").title()),
		"fieldtype": field.fieldtype,
		"required": bool(field.reqd),
		"read_only": bool(field.read_only),
		"hidden": bool(field.hidden),
	}

	# Select field options.
	if field.fieldtype == "Select":
		options = field.options or ""

		result["options"] = options

		result["select_options"] = [option.strip() for option in options.splitlines() if option.strip()]

	# Link field.
	elif field.fieldtype in LINK_FIELD_TYPES:
		result["link_doctypes"] = field.options

	# Dynamic Link field.
	elif field.fieldtype in DYNAMIC_LINK_FIELD_TYPES:
		result["options_field"] = field.options

	# Child table reference.
	elif field.fieldtype in CHILD_TABLE_FIELD_TYPES:
		result["child_doctype"] = field.options

	if field.description:
		result["description"] = field.description

	if field.default is not None and field.default != "":
		result["default"] = field.default

	if field.length:
		result["length"] = field.length

	if field.precision is not None:
		result["precision"] = field.precision

	return result


# ============================================================
# CHILD TABLE FIELD METADATA
# ============================================================


def _get_child_fields_metadata(
	parent_doctype: str,
	table_fieldname: str,
	child_doctype: str,
) -> list[dict]:
	"""
	Retrieve approved child-field metadata.

	The parent DocType and table field must exist in
	CHILD_TABLE_FIELDS configuration.

	Only configured child fields are returned.
	"""

	try:
		allowed_child_fields = get_child_table_config(
			parent_doctype,
			table_fieldname,
		)

	except ValueError as error:
		frappe.throw(
			_(str(error)),
			frappe.ValidationError,
		)

	# Confirm the parent field really points to the expected
	# child DocType.
	parent_meta = frappe.get_meta(parent_doctype)

	parent_field = parent_meta.get_field(table_fieldname)

	if not parent_field:
		frappe.throw(
			_("Configured child table field {0} does not exist " "in {1}.").format(
				table_fieldname, parent_doctype
			),
			frappe.ValidationError,
		)

	if parent_field.fieldtype not in CHILD_TABLE_FIELD_TYPES:
		frappe.throw(
			_("Field {0} in {1} is not a child table field.").format(table_fieldname, parent_doctype),
			frappe.ValidationError,
		)

	if parent_field.options != child_doctype:
		frappe.throw(
			_("Child DocType mismatch for {0} in {1}.").format(table_fieldname, parent_doctype),
			frappe.ValidationError,
		)

	# Load the actual child DocType metadata.
	child_meta = frappe.get_meta(child_doctype)

	if not child_meta.istable:
		frappe.throw(
			_("{0} is not a child DocType.").format(child_doctype),
			frappe.ValidationError,
		)

	child_field_metadata = []

	for fieldname in allowed_child_fields:
		child_field = child_meta.get_field(fieldname)

		if not child_field:
			frappe.throw(
				_("Configured child field {0} does not exist " "in {1}.").format(fieldname, child_doctype),
				frappe.ValidationError,
			)

		# Serialize the configured child field.
		child_field_metadata.append(_serialize_field_metadata(child_field))

	return child_field_metadata


# ============================================================
# PARENT DOCTYPE FIELD METADATA
# ============================================================


def _get_field_metadata(
	doctype: str,
	fieldname: str,
) -> dict | None:
	"""
	Retrieve metadata for an allowlisted parent field.

	For Table and Table MultiSelect fields, also return
	the configured child-field metadata.
	"""

	meta = frappe.get_meta(doctype)

	field = meta.get_field(fieldname)

	if not field:
		return None

	result = _serialize_field_metadata(field)

	# Attach nested metadata for configured child tables.
	if field.fieldtype in CHILD_TABLE_FIELD_TYPES:
		child_doctype = field.options

		if not child_doctype:
			frappe.throw(
				_("Child DocType is missing for field {0}.").format(fieldname),
				frappe.ValidationError,
			)

		result["child_doctype"] = child_doctype

		result["child_fields"] = _get_child_fields_metadata(
			parent_doctype=doctype,
			table_fieldname=fieldname,
			child_doctype=child_doctype,
		)

	return result


# ============================================================
# AVAILABLE DOCTYPES
# ============================================================


@frappe.whitelist(methods=["GET"])
def get_available_doctypes() -> dict:
	user = require_authenticated_user()

	available = []

	for doctype in get_allowed_doctypes():
		config = get_doctype_config(doctype)

		# Child tables are embedded inside parent views, not standalone pages.
		if config.get("is_child_table"):
			continue

		if not frappe.has_permission(
			doctype,
			ptype="read",
			user=user,
		):
			continue

		capabilities = _get_operation_capabilities(
			doctype,
			user,
		)

		available.append(
			{
				"doctype": doctype,
				"label": config["label"],
				"capabilities": capabilities,
			}
		)

	return success_response(
		data=available,
		message="Available Memento pages retrieved successfully.",
	)


# ============================================================
# DOCTYPE METADATA
# ============================================================


@frappe.whitelist(methods=["GET"])
def get_doctype_metadata(
	doctype: str,
	purpose: str = "form",
) -> dict:
	"""
	Return metadata for an approved DocType.

	Supported purposes:
	    list
	    form
	    create
	    update
	    search

	Table and Table MultiSelect fields include their
	explicitly configured child-field metadata.
	"""

	if purpose not in PURPOSE_FIELD_GROUPS:
		frappe.throw(
			_("Unsupported metadata purpose: {0}").format(purpose),
			frappe.ValidationError,
		)

	# Verify that the current user can access this DocType.
	require_doctype_permission(
		doctype,
		permission_type="read",
	)

	config = get_doctype_config(doctype)

	group = (
		"form_fields"
		if config.get("is_child_table") and purpose in {"form", "create", "update"}
		else PURPOSE_FIELD_GROUPS[purpose]
	)

	fields = get_permitted_fields(
		doctype,
		field_group=group,
	)

	field_metadata = []

	for fieldname in fields:
		item = _get_field_metadata(
			doctype,
			fieldname,
		)

		if item is not None:
			field_metadata.append(item)

	user = frappe.session.user

	return success_response(
		data={
			"doctype": doctype,
			"label": config["label"],
			"purpose": purpose,
			"fields": field_metadata,
			"capabilities": _get_operation_capabilities(
				doctype,
				user,
			),
		},
		message=(f"{config['label']} metadata retrieved successfully."),
	)

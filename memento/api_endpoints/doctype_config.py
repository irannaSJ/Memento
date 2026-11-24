"""
Central configuration for DocTypes exposed through the Memento API.

Only DocTypes and fields declared here may be exposed by API endpoints.

Child table fields are separately allowlisted under child_table_fields.
Keep this configuration aligned with the DocType metadata on test.site.
"""

from copy import deepcopy

# ============================================================
# CHILD TABLE FIELD CONFIGURATION
# ============================================================

# CHILD_TABLE_FIELDS = {
#     "Tasks": {
#         "to_do_table": [
#             "task",
#             "status",
#             "user",
#             "time",
#             "end_time",
#             "total_duration",
#         ],
#     },

#     "Task Log": {
#         "todo": [
#             "task",
#             "status",
#             "user",
#             "time",
#             "end_time",
#             "total_duration",
#         ],
#     },
# }
CHILD_TABLE_FIELDS = {
	"My Projects": {
		"members": [
			"user",
		],
	},
	"Tasks": {
		"members": [
			"user",
		],
		"task_todo": [
			"todo",
			"status",
			"user",
			"start_on",
			"end_on",
			"total_duration",
		],
	},
	"Task Log": {
		"members": [
			"user",
		],
		"todo": [
			"todo",
			"status",
			"user",
			"start_on",
			"end_on",
			"total_duration",
		],
	},
}


# ============================================================
# APPROVED DOCTYPE CONFIGURATION
# ============================================================

DOCTYPE_CONFIG = {
	# --------------------------------------------------------
	# MY PROJECTS
	# --------------------------------------------------------
	"My Projects": {
		"label": "Projects",
		"list_fields": [
			"project_name",
			"status",
			"category",
			"priority_level",
			"project_start_time",
			"project_end_time",
			"description",
		],
		"form_fields": [
			"project_name",
			"project_start_time",
			"project_end_time",
			"category",
			"priority_level",
			"status",
			"description",
			"created_by",
			"assigned_by",
			"members",
		],
		"search_fields": [
			"project_name",
		],
		"create_fields": [
			"project_name",
			"project_start_time",
			"project_end_time",
			"category",
			"priority_level",
			"status",
			"description",
			"created_by",
			"assigned_by",
			"members",
		],
		"update_fields": [
			"project_name",
			"project_start_time",
			"project_end_time",
			"category",
			"priority_level",
			"status",
			"description",
			"created_by",
			"assigned_by",
			"members",
		],
		"child_table_fields": CHILD_TABLE_FIELDS["My Projects"],
		"default_order_by": "modified desc",
	},
	# --------------------------------------------------------
	# TASKS
	# --------------------------------------------------------
	"Tasks": {
		"label": "Tasks",
		"list_fields": [
			"task_name",
			"status",
			"priority",
			"project",
			"from_date",
			"to_date",
			"created_by",
			"description",
		],
		"form_fields": [
			"task_name",
			"from_date",
			"to_date",
			"status",
			"project",
			"priority",
			"description",
			"members",
			"task_todo" "created_by",
		],
		"search_fields": [
			"task_name",
		],
		"create_fields": [
			"task_name",
			"from_date",
			"to_date",
			"status",
			"project",
			"priority",
			"description",
			"members",
			"task_todo" "created_by",
		],
		"update_fields": [
			"task_name",
			"from_date",
			"to_date",
			"status",
			"project",
			"priority",
			"description",
			"members",
			"task_todo" "created_by",
		],
		"child_table_fields": CHILD_TABLE_FIELDS["Tasks"],
		"default_order_by": "modified desc",
	},
	# Add ToDo Table config for the Task To-Do screen & MetadataDrivenForm:
	"ToDo Table": {
		"label": "Task To-Do",
		"is_child_table": True,
		"parent_doctype": "Tasks",
		"parent_field": "task_todo",
		"list_fields": ["todo", "status", "user", "start_on", "end_on", "total_duration"],
		"form_fields": ["todo"],
		"search_fields": ["todo"],
		"create_fields": ["todo", "task_id"],
		"update_fields": ["todo", "status"],
		"default_order_by": "creation desc",
	},
	# --------------------------------------------------------
	# DAILY TODO
	# --------------------------------------------------------
	"Daily ToDo": {
		"label": "Daily To-Do",
		"list_fields": [
			"description",
			"status",
			"priority",
			"start_time",
			"date",
		],
		"form_fields": [
			"description",
			"status",
			"priority",
			"start_time",
			"date",
		],
		"search_fields": [
			"description",
		],
		"create_fields": [
			"description",
			"status",
			"priority",
			"start_time",
			"date",
		],
		"update_fields": [
			"description",
			"status",
			"priority",
			"start_time",
			"date",
		],
		"default_order_by": "modified desc",
	},
	# --------------------------------------------------------
	# TASK LOG
	# --------------------------------------------------------
	"Task Log": {
		"label": "Activity Logs",
		"list_fields": [
			"today",
			"task_id",
		],
		"form_fields": [
			"today",
			"task_id",
			"members",
		],
		"search_fields": [
			"task_id",
		],
		"create_fields": [
			"today",
			"task_id",
			"members",
		],
		"update_fields": [
			"today",
			"task_id",
			"members",
		],
		"child_table_fields": CHILD_TABLE_FIELDS["Task Log"],
		"default_order_by": "modified desc",
	},
}


# ============================================================
# CONFIGURATION HELPERS
# ============================================================


def get_doctype_config(doctype: str) -> dict:
	"""
	Return a deep copy of an approved DocType configuration.
	"""

	config = DOCTYPE_CONFIG.get(doctype)

	if config is None:
		raise ValueError(f"Doctype is not allowed in Memento API: {doctype}")

	return deepcopy(config)


def get_allowed_doctypes() -> list[str]:
	"""
	Return all DocTypes exposed through the Memento API.
	"""

	return list(DOCTYPE_CONFIG.keys())


def get_allowed_fields(
	doctype: str,
	field_group: str = "list_fields",
) -> list[str]:
	"""
	Return the allowlisted fields for a DocType and field group.
	"""

	config = get_doctype_config(doctype)

	fields = config.get(field_group)

	if fields is None:
		raise ValueError(f"Unknown field group: {field_group}")

	return list(fields)


def get_child_table_config(
	parent_doctype: str,
	table_fieldname: str,
) -> list[str]:
	"""
	Return the approved child fieldnames for a parent Table field.

	Example:
	    get_child_table_config("Tasks", "to_do_table")

	Returns:
	    [
	        "task",
	        "status",
	        "user",
	        "time",
	        "end_time",
	        "total_duration",
	    ]
	"""

	config = get_doctype_config(parent_doctype)

	child_tables = config.get("child_table_fields", {})

	allowed_fields = child_tables.get(table_fieldname)

	if not allowed_fields:
		raise ValueError(
			f"Child table field '{table_fieldname}' " f"is not configured for DocType '{parent_doctype}'."
		)

	return list(allowed_fields)


def is_child_table_allowed(
	parent_doctype: str,
	table_fieldname: str,
) -> bool:
	"""
	Check whether a parent DocType Table field is allowlisted.
	"""

	config = DOCTYPE_CONFIG.get(parent_doctype)

	if not config:
		return False

	child_tables = config.get("child_table_fields", {})

	return table_fieldname in child_tables

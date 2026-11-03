"""
Central configuration for DocTypes exposed through the Memento API.

Only DocTypes and fields declared here may be exposed by API endpoints.
Keep this configuration aligned with the DocType metadata on test.site.
"""

from copy import deepcopy

# These are the only DocTypes the Memento API may expose.
DOCTYPE_CONFIG = {
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
		],
		"search_fields": ["project_name"],
		"create_fields": [
			"project_name",
			"project_start_time",
			"project_end_time",
			"category",
			"priority_level",
			"status",
			"description",
			"created_by",
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
		],
		"default_order_by": "modified desc",
	},
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
			"created_by",
		],
		"search_fields": ["task_name"],
		"create_fields": [
			"task_name",
			"from_date",
			"to_date",
			"status",
			"project",
			"priority",
			"description",
			"members",
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
		],
		"default_order_by": "modified desc",
	},
	"Daily ToDo": {
		"label": "Daily To-Do",
		"list_fields": ["description", "status", "priority", "start_time", "date"],
		"form_fields": ["description", "status", "priority", "start_time", "date"],
		"search_fields": ["description"],
		"create_fields": ["description", "status", "priority", "start_time", "date"],
		"update_fields": ["description", "status", "priority", "start_time", "date"],
		"default_order_by": "modified desc",
	},
	"Task Log": {
		"label": "Activity Logs",
		"list_fields": [
			"today",
			"task_id",
			# "members",
		],
		"form_fields": [
			"today",
			"task_id",
			# "members",
		],
		"search_fields": ["task"],
		"create_fields": [
			"today",
			"task_id",
			# "members",
		],
		"update_fields": [
			"today",
			"task_id",
			# "members",
		],
		"default_order_by": "modified desc",
	},
}


def get_doctype_config(doctype: str) -> dict:
	config = DOCTYPE_CONFIG.get(doctype)
	if config is None:
		raise ValueError(f"Doctype is not allowed in Memento API : {doctype}")
	return deepcopy(config)


def get_allowed_doctypes() -> list[str]:
	return list(DOCTYPE_CONFIG.keys())


def get_allowed_fields(doctype: str, field_group: str = "list_fields") -> list[str]:
	config = get_doctype_config(doctype)
	fields = config.get(field_group)

	if fields is None:
		raise ValueError(f"Unknown field group: {field_group}")
	return list(fields)

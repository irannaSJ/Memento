
import frappe
from frappe import _
from frappe.model.document import Document


@frappe.whitelist()
def get_my_todos(limit=500):
    """Fetch only the current user's personal tasks."""
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please log in first."))
    limit = min(max(int(limit), 1), 500)
    todos = frappe.get_list("Daily ToDo",filters={"allocated_to": user},fields=["name", "description","status","priority","creation","modified","date"],order_by="creation asc",page_length=limit)
    return todos


@frappe.whitelist()
def create_todo(description):
    """Create a personal task for the logged-in user."""

    user = frappe.session.user

    if user == "Guest":
        frappe.throw(_("Please log in first."))

    description = (description or "").strip()

    if not description:
        frappe.throw(_("Task description is required."))

    if len(description) > 5000:
        frappe.throw(_("Task description cannot exceed 5000 characters."))

    todo = frappe.get_doc({
        "doctype": "Daily ToDo",
        "description": description,
        "allocated_to": user,
        "status": "Open",
        "priority": "Medium"
    })

    todo.insert()

    return {
        "name": todo.name,
        "message": _("Task created successfully.")
    }


@frappe.whitelist()
def update_todo_status(name, status):
    """Complete or reopen an owned personal task."""

    user = frappe.session.user

    if user == "Guest":
        frappe.throw(_("Please log in first."))

    allowed_statuses = ["Open", "Closed"]

    if status not in allowed_statuses:
        frappe.throw(_("Invalid task status."))

    todo = frappe.get_doc("Daily ToDo", name)

    # Prevent modifying another user's task.
    if todo.allocated_to != user:
        frappe.throw(
            _("You are not authorized to update this task."),
            frappe.PermissionError
        )

    if todo.status == "Cancelled":
        frappe.throw(_("Cancelled tasks cannot be updated."))

    todo.status = status
    todo.save()

    return {
        "name": todo.name,
        "status": todo.status,
        "message": _("Task updated successfully.")
    }





@frappe.whitelist()
def update_todo_description(name, description):


    # frappe.msgprint(f"Updating description for task: {name} to: {description}")
    """Update an existing personal task."""



    user = frappe.session.user

    if user == "Guest":
        frappe.throw(_("Please log in first."))

    description = (description or "").strip()



    if not description:
        frappe.throw(_("Task description cannot be empty."))

    if len(description) > 5000:
        frappe.throw(_("Task description cannot exceed 5000 characters."))

    todo = frappe.get_doc("Daily ToDo", name)

    if todo.allocated_to != user:
        frappe.throw(
            _("You are not authorized to edit this task."),
            frappe.PermissionError
        )
        return

    # if todo.status == "Cancelled":
    #     frappe.throw(_("Cancelled tasks cannot be edited."))

    todo.description = description
    todo.save(ignore_permissions=True)

    return {
        "name": todo.name,
        "description": todo.description,
        "modified": todo.modified,
        "message": _("Task updated successfully.")
    }


@frappe.whitelist()
def delete_my_todo(name):
    """Delete an owned personal task."""

    user = frappe.session.user

    if user == "Guest":
        frappe.throw(_("Please log in first."))

    todo = frappe.get_doc("ToDo", name)

    if todo.allocated_to != user:
        frappe.throw(
            _("You are not authorized to delete this task."),
            frappe.PermissionError
        )

    frappe.delete_doc(
        "ToDo",
        name,
        ignore_permissions=True
    )

    return {
        "message": _("Task deleted successfully.")
    }

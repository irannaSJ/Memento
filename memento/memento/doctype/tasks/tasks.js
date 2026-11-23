// Copyright (c) 2026, Sagar Patil and contributors
// For license information, please see license.txt

frappe.ui.form.on("Tasks", {
	setup(frm) {
		$("span.sidebar-toggle-btn").hide();
		$(".col-lg-2.layout-side-section").hide();
		frm.trigger("update_primary_action");
	},

	refresh(frm) {
        // setup_description_popup(frm); pop up not like what i thought but we can customize the height and width in future 
        setup_description_popup(frm);


        // const description_field = frm.get_field("description");
        // if (description_field && description_field.wrapper) {
        //     $(description_field.wrapper).find(".ql-editor").css({
        //         height: "750px",
        //         minHeight: "600px",
        //     });
        // }

        frm.trigger("update_primary_action");

        frm.$wrapper.on("change", () => {
            console.log("form changed");
            frm.trigger("update_primary_action");
        });


        if (frm.doc.status === "Completed") {
            frm.disable_form(); // then how to enable ? for that you can use frm.enable_form() method to enable the form again.
        }



        // if (frm.is_dirty()) {
		// 	console.log("for_month changed");
		// 	frm.page.set_primary_action(__("Save"), () => frm.save());
		// 	// frm.set_value("status", "Pending")
		// 	frm.enable_save();
		// }

        // frm.disable_save();

    
    },

    // description(frm) {

    //     if (frm.doc.description){
    //         setup_description_popup(frm);
    //     }
    // },



    update_primary_action(frm){

        if (frm.is_dirty()) {
			// if (frm.doc.status === "Pending") {
			// 	frm.set_value("status", "Not Saved");
			// }
			console.log("form is dirty Save() gets activate");
			frm.page.set_primary_action(__("Save"), () => frm.save());
			frm.enable_save();
            // frm.refresh()
			return;
		}else{
            console.log("form is not dirty Save() gets deactivate");
		    frm.disable_save();
        }

        let status_actions = {
            "Pending": __("Pending"),
            "Approved": __("Completed"),
        };

        Object.keys(status_actions).forEach(status => {

            if (frm.doc.status !== status) {
                frm.page.add_action_item(
                    status_actions[status],
                    () => {
                        frm.events.change_project_status(frm, status);
                    }
                );
            }

        });

    },

    change_project_status(frm, status) {

        frappe.confirm(
            __("Are you sure you want to change the project status to {0}?", [status]),
            () => {

                frm.set_value("status", status);

                frm.save();
            }
        );

    },


    description(frm) {
		if (frm.is_dirty()) {
			console.log("description edited Save() gets activate");
			frm.page.set_primary_action(__("Save"), () => frm.save());
			// frm.set_value("status", "Pending")
			frm.enable_save();
		}
	},
});


function setup_description_popup(frm) {
    const description_field = frm.fields_dict.description;
    if (!description_field || description_field._popup_bound) return;
    description_field._popup_bound = true;

    console.log("setup_description_popup called for field:", description_field);
    console.log("description_field", description_field);

    if (description_field && description_field.wrapper) {
        $(description_field.wrapper).find(".ql-editor").css({
            height: "750px",
            minHeight: "600px",
        });
    }


    const $wrap = $(description_field.wrapper);
    const $placeholder = $('<div class="desc-popup-placeholder"></div>').hide().insertBefore($wrap);
    const $backdrop = $('<div class="desc-popup-backdrop"></div>').hide().appendTo("body");
    let is_open = false;

    const should_popup = () => true; // e.g. () => !frm.is_new()

    function open_popup() {
        if (is_open || !should_popup()) return;
        is_open = true;

        // measure BEFORE lifting the field out of the layout
        const r = $wrap[0].getBoundingClientRect();
        $placeholder.height(r.height).show();

        // keep the popup fully on screen vertically
        const top = Math.max(60, Math.min(r.top, window.innerHeight - r.height - 20));

        $wrap.addClass("desc-popup-open").css({
            top: top + "px",
            left: r.left + "px",
            width: r.width + "px",
        });
        $backdrop.show();
        document.addEventListener("keydown", on_keydown, true);
    }

    function close_popup() {
        if (!is_open) return;
        is_open = false;
        $wrap.removeClass("desc-popup-open").css({ top: "", left: "", width: "" });
        $placeholder.hide();
        $backdrop.hide();
        document.removeEventListener("keydown", on_keydown, true);
        description_field.quill && description_field.quill.blur();
    }

    function on_keydown(e) {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close_popup();
        }
    }

    $wrap.on("focusin", ".ql-editor", open_popup);
    $backdrop.on("mousedown", close_popup);
}

frappe.dom.set_style(`
    .desc-popup-backdrop {
        position: fixed; inset: 0;
        background: rgba(0, 0, 0, 0.35);
        z-index: 1040;
    }
    .frappe-control[data-fieldname="description"].desc-popup-open {
        position: fixed;
        margin: 0;
        z-index: 1050;
        background: var(--card-bg, #fff);
        border-radius: 8px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    }
    /* hide label, help text, etc. - only the editor remains */
    .frappe-control[data-fieldname="description"].desc-popup-open .form-group > .clearfix,
    .frappe-control[data-fieldname="description"].desc-popup-open .help-box,
    .frappe-control[data-fieldname="description"].desc-popup-open .control-label {
        display: none !important;
    }
    .frappe-control[data-fieldname="description"].desc-popup-open .form-group {
        margin-bottom: 0;
    }
`, "task-description-popup");
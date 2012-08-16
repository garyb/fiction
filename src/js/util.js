/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(function () {

    "use strict";
    
    function copyProps(src, out) {
        for (var k in src) {
            if (src.hasOwnProperty(k)) {
                out[k] = src[k];
            }
        }
        return out;
    }
    
    function createForm(type, value, extras) {
        if (type !== "literal" && type !== "symbol" && type !== "list") {
            throw new Error("Form must be a literal, symbol, or list");
        }
        var form = { type: type, value: value };
        return extras ? copyProps(form, extras) : form;
    }
    
    function printRawForm(input) {
        if (!input) {
            return "null";
        }
        if (Array.isArray(input)) {
            var out = [];
            for (var i = 0, l = input.length; i < l; i++) {
                out[i] = printRawForm(input[i]);
            }
            return "[" + out.join(", ") + "]";
        }
        if (input.hasOwnProperty("type") && input.hasOwnProperty("value")) {
            var v = Array.isArray(input.value) ? printRawForm(input.value) : input.value;
            return "{ type: " + input.type + ", value: " + v + " }";
        } else {
            return input.toString();
        }
    }
    
    function printPrettyForm(form) {
        if (!form) {
            return "";
        } else if (form.type === "literal") {
            var type = typeof form.value;
            if (type === "string") {
                return '"' + form.value + '"';
            }
            if (type === "boolean") {
                return form.value ? "#t" : "#f";
            }
            return form.value;
        } else if (form.type === "list") {
            if (checkForm(form, "quote")) {
                return "'" + printPrettyForm(form.value[1]);
            } else if (checkForm(form, "unquote")) {
                return "," + printPrettyForm(form.value[1]);
            }
            var items = [];
            for (var i = 0, l = form.value.length; i < l; i++) {
                items[i] = printPrettyForm(form.value[i]);
            }
            return "(" + items.join(" ") + ")";
        } else if (form.type === "symbol") {
            return form.value;
        }
        return null;
    }
    
    function checkForm(form, type) {
        if (form.type === "list" && form.value.length > 0) {
            var car = form.value[0];
            return car.type === "symbol" && car.value === type;
        }        
        return false;
    }
    
    return {
        copyProps: copyProps,
        printRawForm: printRawForm,
        printPrettyForm: printPrettyForm,
        createForm: createForm,
        checkForm: checkForm
    };
    
});
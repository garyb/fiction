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
    
    function clone(obj) {
        return copyProps(obj, {});
    }
    
    function createForm(type, value, extras) {
        if (type !== "literal" && type !== "symbol" && type !== "list") {
            throw new Error("Form must be a literal, symbol, or list, found: " + type);
        }
        if (value === null || value === undefined) {
            throw new Error("Form value cannot be null or undefined");
        }
        if (type === "list" && !Array.isArray(value)) {
            throw new Error("List should have an array value, found: " + value);
        }
        if (type === "symbol") {
            if (typeof value !== "string") {
                throw new Error("Symbol should have a string value, found: " + value);
            }
            if (value.length === 0) {
                throw new Error("Symbol value is empty");
            }
        }
        if (type === "literal") {
            if ((typeof value !== "string") && 
                (typeof value !== "number") && 
                (typeof value !== "boolean") &&
                !(value instanceof RegExp)) {
                throw new Error("Literal value should be string, number, boolean, or regex, found: " + value);
            }
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
    
    function printPretty(form) {
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
                return "'" + printPretty(form.value[1]);
            } else if (checkForm(form, "quasiquote")) {
                return "`" + printPretty(form.value[1]);
            } else if (checkForm(form, "unquote")) {
                return "," + printPretty(form.value[1]);
            } else if (checkForm(form, "unquote-splicing")) {
                return ",@" + printPretty(form.value[1]);
            }
            var items = [];
            for (var i = 0, l = form.value.length; i < l; i++) {
                items[i] = printPretty(form.value[i]);
            }
            return "(" + items.join(" ") + ")";
        } else if (form.type === "symbol") {
            return form.value;
        } else if (form.type === "func") {
            var fn = form.value;
            if (Array.isArray(fn.args)) {
                return "#(fn (" + fn.args.join(" ") + "))"; 
            } else {
                return "#(fn " + fn.args + ")"; 
            }
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
    
    function makeMap(list) {
        var result = {};
        for (var i = 0, value = null; (value = list[i]); i++) {
            result[value] = value;
        }
        return result;
    }
    
    function flatten(list) {
        var result = [];
        for (var i = 0, l = list.length; i < l; i++) {
            result = result.concat(list[i]);
        }
        return result;
    }
    
    return {
        copyProps: copyProps,
        clone: clone,
        printRawForm: printRawForm,
        printPretty: printPretty,
        createForm: createForm,
        checkForm: checkForm,
        makeMap: makeMap,
        flatten: flatten
    };
    
});
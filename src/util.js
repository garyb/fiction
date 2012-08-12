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
        var self = {
            type: type,
            value: value
        };
        return extras ? copyProps(self, extras) : self;
    }
    
    function printRawForm(input) {
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
    
    return {
        copyProps: copyProps,
        createForm: createForm,
        printRawForm: printRawForm
    };
    
});
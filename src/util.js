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
            value: value,
            toString: function () {
                var v = Array.isArray(self.value) ? "[" + self.value.join(", ") + "]" : self.value;
                return "{ type: " + self.type + ", value: " + v + " }";
            }
        };
        return extras ? copyProps(self, extras) : self;
    }
    
    return {
        copyProps: copyProps,
        createForm: createForm
    };
    
});
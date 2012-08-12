/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(function () {

    "use strict";
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg);
    }
       
    function expandComment() {
        return null;
    }
    
    var expanders = {
        "comment": expandComment
    };

    function expand(form) {
        if (form.type === "list") {
            var car = form.value[0];
            if (car.type === "symbol") {
                var expander = expanders[car.value];
                if (expander) {
                    return expander(form);
                }
            }
            form.value = expandAll(form.value);
        }
        return form;
    }
    
    function expandAll(seq) {
        var result = [];
        for (var i = 0, l = seq.length; i < l; i++) {
            var form = expand(seq[i]);
            if (form !== null) {
                result.push(form);
            }
        }
        return result;
    }

    return { expand: expandAll };

});
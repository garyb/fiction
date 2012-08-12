/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(function () {

    "use strict";
    
    function evaluate(form, scope) {
        return { value: null, scope: scope };
    }
    
    function evaluateAll(forms) {
        var scope = {};
        var result = null;
        for (var i = 0, l = forms.length; i < l; i++) {
            var tmp = evaluate(forms[i], scope);
            result = tmp.value;
            scope = tmp.scope;
        }
        return result;
    }

    return { evaluate: evaluateAll };

});
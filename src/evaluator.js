/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util"], function (util) {

    "use strict";
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
    
    function put(scope, id, value) {
        var result = util.copyProps(scope, {});
        if (result.hasOwnProperty(id)) {
            result[id].value = value;
        } else {
            result[id] = { value: value };
        }
        return result;
    }
    
    function get(scope, id, form) {
        if (scope.hasOwnProperty(id)) {
            return scope[id].value;
        } else {
            error("Undefined identifier '" + id + "'", form);
        }
    }
    
    function evalVar(args, scope) {
        if (args[0].type !== "symbol") {
            error("Invalid identifier '" + args[1] + "'", args[1]);
        }
        var id = args[0].value;
        scope = put(scope, id, null);
        var tmp = evaluate(args[1], scope);
        return { value: tmp.value, scope: put(scope, id, tmp.value) };
    }
    
    function evalApply(fn, args, scope) {
        return { value: null, scope: scope };
    }
    
    var specialForms = {
        "var": evalVar
    };
    
    function evaluate(form, scope) {
        var result = null;
        if (form.type === "literal") {
            result = form.value;
        } else if (form.type === "symbol") {
            result = get(scope, form.value, form);
        } else if (form.type === "list") {
            if (form.value.length === 0) {
                error("Empty application", form);
            } else {
                // TODO: not sure about using car to choose special forms here, 
                // perhaps need to eval quote/unquotes? needs investigation...
                var car = form.value[0];
                var cdr = form.value.slice(1);
                var sf = car.type === "symbol" ? specialForms[car.value] : null;
                if (sf) {
                    return sf(cdr, scope);
                } else {
                    return evalApply(car, cdr, scope);
                }
            }
        }
        return { value: result, scope: scope };
    }
    
    function evaluateAll(forms, scope) {
        scope = scope || {};
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
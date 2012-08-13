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
    
    function evalFunc(args, scope, form) {
        var result = null;
        if (args.length === 1) {
            error("Empty function definition", form);
        }
        var body = args.slice(1);
        if (args[0].type === "list") {
            var argNames = [];
            var argsList = args[0].value;
            for (var i = 0, l = argsList.length; i < l; i++) {
                if (argsList[i].type !== "symbol") {
                    error("Invalid function argument definition", argsList[i]);
                }
                argNames[i] = argsList[i].value;
            }
            result = { type: "func", body: body, args: argNames, scope: scope };
        } else if (args[0].type === "symbol") {
            result = { type: "func", body: body, args: args[0].value, scope: scope };
        } else {
            error("Invalid function arguments definition", args[0]);
        }
        return { value: result, scope: scope };
    }
    
    function evalAssign(args, scope, form) {
        if (args[0].type !== "symbol") {
            error("Invalid identifier '" + args[1] + "'", args[1]);
        }
        var id = args[0].value;
        get(scope, id, args[0]);
        return evalVar(args, scope, form);
    }
    
    var specialForms = {
        "var": evalVar,
        "fn": evalFunc,
        "set!": evalAssign
        /* if, quote, quasiquote, unquote, unquote-splicing */
    };
    
    function evalApply(fn, args, scope, form) {
        var tmp = evaluate(fn, scope);
        var fnv = tmp.value;
        scope = tmp.scope;
        var argvs = [];
        for (var i = 0, l = args.length; i < l; i++) {
            tmp = evaluate(args[i], scope);
            argvs[i] = tmp.value;
            scope = tmp.scope;
        }
        if (fnv.type !== "func") {
            error("Non-function application", form);
        }
        var fnscope = fnv.scope;
        if (Array.isArray(fnv.args)) {
            if (fnv.args.length !== argvs.length) {
                error("Argument count mismatch (expected " + fnv.args.length + ", received " + argvs.length + ")", form);
            }
            for (var j = 0, m = argvs.length; j < m; j++) {
                fnscope = put(fnscope, fnv.args[j], argvs[j]);
            }
        } else {
            fnscope = put(fnscope, fnv.args, { type: "list", value: args });
        }
        return { value: evaluateAll(fnv.body, fnscope).value, scope: scope };
    }
    
    function evaluate(form, scope) {
        var result = null;
        if (form.type === "literal") {
            result = form;
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
                    return sf(cdr, scope, form);
                } else {
                    return evalApply(car, cdr, scope, form);
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
        return { value: result, scope: scope };
    }
    
    function print(value) {
        if (value === null) {
            return "";
        } else if (value.type === "literal") {
            var type = typeof value.value;
            if (type === "string") {
                // TODO: needs some work to produce valid strings
                return '"' + value.value + '"';
            }
            return value.value;
        } else if (value.type === "func") {
            if (Array.isArray(value.args)) {
                return "(fn (" + value.args.join(" ") + ") ...)"; 
            } else {
                return "(fn " + value.args + " ...)"; 
            }
        } else if (value.type === "list") {
            var items = [];
            for (var i = 0, l = value.value.length; i < l; i++) {
                items[i] = print(value.value[i]);
            }
            return "[" + items.join(" ") + "]";
        }
        // TODO: figure out what other cases need covering here
        return "??? " + util.printRawForm(value);
    }

    return { evaluate: evaluateAll, print: print };

});
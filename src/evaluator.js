/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util"], function (util) {

    "use strict";
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
    
    function put(env, id, value) {
        var result = util.copyProps(env, {});
        if (result.hasOwnProperty(id)) {
            result[id].value = value;
        } else {
            result[id] = { value: value };
        }
        return result;
    }
    
    function get(env, id, form) {
        if (env.hasOwnProperty(id)) {
            return env[id].value;
        } else {
            error("Undefined identifier '" + id + "'", form);
        }
    }
    
    function checkForm(form, type) {
        if (form.type === "list" && form.value.length > 0) {
            var car = form.value[0];
            return car.type === "symbol" && car.value === type;
        }        
        return false;
    }
    
    function evalVar(args, env) {
        if (args[0].type !== "symbol") {
            error("Invalid identifier '" + args[1] + "'", args[1]);
        }
        var id = args[0].value;
        env = put(env, id, null);
        var tmp = evaluate(args[1], env);
        return { value: tmp.value, env: put(env, id, tmp.value) };
    }
    
    function evalFunc(args, env, form) {
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
            result = { type: "func", body: body, args: argNames, env: env };
        } else if (args[0].type === "symbol") {
            result = { type: "func", body: body, args: args[0].value, env: env };
        } else {
            error("Invalid function arguments definition", args[0]);
        }
        return { value: result, env: env };
    }
    
    function evalAssign(args, env, form) {
        if (args[0].type !== "symbol") {
            error("Invalid identifier '" + args[1] + "'", args[1]);
        }
        var id = args[0].value;
        get(env, id, args[0]);
        return evalVar(args, env, form);
    }  
    
    function evalIf(args, env, form) {
        if (args.length !== 3) {
            error("If requires 3 exprs, received " + args.length, form);
        }
        var tmp = evaluate(args[0], env);
        var testv = tmp.value;
        env = tmp.env;
        if ((testv.type === "literal" && testv.value) || 
            testv.type === "func" || 
            testv.type === "symbol" ||
            (testv.type === "list" && testv.value.length > 0)) {
            return evaluate(args[1], env, form);
        } else {
            return evaluate(args[2], env, form);
        }
    }
    
    function evalQuote(args, env, form) {
        if (args.length !== 1) {
            error("Quote expects exactly one form", form);
        }
        return { value: args[0], env: env };
    }
    
    function evalQuasiQuote(args, env, form) {
        if (args.length !== 1) {
            error("Quasiquote expects exactly one form", form);
        }
        return { value: evalQuasiQuotedValue(args[0], env), env: env };
    }    
    
    function evalQuasiQuotedValue(form, env) {
        if (form.type === "literal" || form.type === "symbol") {
            return form;
        }
        if (checkForm(form, "unquote")) {
            if (form.value.length !== 2) {
                error("unquote expects exactly one form", form);
            }
            return evaluate(form.value[1], env).value;
        } else if (checkForm(form, "unquote-splicing")) {
            error("unquote-splicing used outside of list", form);
        } else {
            var result = [];
            for (var i = 0, l = form.value.length; i < l; i++) {
                var f = form.value[i];
                if (checkForm(f, "unquote-splicing")) {
                    if (f.value.length !== 2) {
                        error("unquote-splicing expects exactly one form", f);
                    }
                    var v = evalQuasiQuotedValue(evaluate(f.value[1], env).value, env);
                    if (v.type !== "list") {
                        error("unquote-splicing expects argument of type list", f);
                    }
                    Array.prototype.push.apply(result, v.value);
                } else {
                    result.push(evalQuasiQuotedValue(f, env));
                }
            }
            form.value = result;
        }
        return form;
    }
    
    function quasiQuoteScopeError(type) {
        return function () {
            error(type + " used outside of quasiquote", arguments[2]);
        };
    }
    
    var specialForms = {
        "var": evalVar,
        "fn": evalFunc,
        "set!": evalAssign,
        "if": evalIf,
        "quote": evalQuote,
        "quasiquote": evalQuasiQuote,
        "unquote": quasiQuoteScopeError("unquote"),
        "unquote-splicing": quasiQuoteScopeError("unquote-splicing")
    };
    
    function evalApply(fn, args, env, form) {
        var tmp = evaluate(fn, env);
        var fnv = tmp.value;
        env = tmp.env;
        var argvs = [];
        for (var i = 0, l = args.length; i < l; i++) {
            tmp = evaluate(args[i], env);
            argvs[i] = tmp.value;
            env = tmp.env;
        }
        if (fnv.type !== "func") {
            error("Non-function application", form);
        }
        var fnenv = fnv.env;
        if (Array.isArray(fnv.args)) {
            if (fnv.args.length !== argvs.length) {
                error("Argument count mismatch (expected " + fnv.args.length + ", received " + argvs.length + ")", form);
            }
            for (var j = 0, m = argvs.length; j < m; j++) {
                fnenv = put(fnenv, fnv.args[j], argvs[j]);
            }
        } else {
            fnenv = put(fnenv, fnv.args, { type: "list", value: args });
        }
        return { value: evaluateAll(fnv.body, fnenv).value, env: env };
    }
    
    function evaluate(form, env) {
        var result = null;
        if (form.type === "literal") {
            result = form;
        } else if (form.type === "symbol") {
            result = get(env, form.value, form);
        } else if (form.type === "list") {
            if (form.value.length === 0) {
                error("Empty application", form);
            } else {
                var car = form.value[0];
                var cdr = form.value.slice(1);
                var sf = car.type === "symbol" ? specialForms[car.value] : null;
                if (sf) {
                    return sf(cdr, env, form);
                } else {
                    return evalApply(car, cdr, env, form);
                }
            }
        }
        return { value: result, env: env };
    }
    
    function evaluateAll(forms, env) {
        env = env || {};
        var result = null;
        for (var i = 0, l = forms.length; i < l; i++) {
            var tmp = evaluate(forms[i], env);
            result = tmp.value;
            env = tmp.env;
        }
        return { value: result, env: env };
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
        } else if (value.type === "symbol") {
            return value.value;
        }
        // TODO: figure out what other cases need covering here
        return "???" + util.printRawForm(value) + "???";
    }

    return { evaluate: evaluateAll, print: print };

});
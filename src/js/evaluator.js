/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util"], function (util) {

    "use strict";
    
    var checkForm = util.checkForm;
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
    
    function createValue(type, value, form) {
        if (type !== "literal" && type !== "symbol" && type !== "list" && type !== "func") {
            error("Form must be a literal, symbol, list, or func", form);
        }
        return { type: type, value: value };
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
    
    function evalVar(args, env) {
        var id = args[0].value;
        env = put(env, id, null);
        var tmp = evaluate(args[1], env);
        return { value: tmp.value, env: put(env, id, tmp.value) };
    }
    
    function evalFunc(args, env, form) {
        var result = null;
        var body = args.slice(1);
        if (args[0].type === "list") {
            var argNames = [];
            var argsList = args[0].value;
            for (var i = 0, l = argsList.length; i < l; i++) {
                argNames[i] = argsList[i].value;
            }
            result = createValue("func", { body: body, args: argNames, env: env }, form);
        } else if (args[0].type === "symbol") {
            result = createValue("func", { body: body, args: args[0].value, env: env }, form);
        }
        return { value: result, env: env };
    }
    
    function evalAssign(args, env, form) {
        var id = args[0].value;
        get(env, id, args[0]);
        return evalVar(args, env, form);
    }  
    
    function evalIf(args, env, form) {
        var tmp = evaluate(args[0], env);
        var testv = tmp.value;
        env = tmp.env;
        if (testv.value) {
            return evaluate(args[1], env, form);
        } else {
            return evaluate(args[2], env, form);
        }
    }
    
    function evalQuote(args, env) {
        return { value: args[0], env: env };
    }
    
    function evalQuasiQuote(args, env) {
        return { value: evalQuasiQuotedValue(args[0], env), env: env };
    }    
    
    function evalQuasiQuotedValue(form, env) {
        if (form.type === "literal" || form.type === "symbol") {
            return createValue(form.type, form.value, form);
        }
        if (checkForm(form, "unquote")) {
            return evaluate(form.value[1], env).value;
        }
        var result = [];
        for (var i = 0, l = form.value.length; i < l; i++) {
            var f = form.value[i];
            if (checkForm(f, "unquote-splicing")) {
                var v = evalQuasiQuotedValue(evaluate(f.value[1], env).value, env);
                Array.prototype.push.apply(result, v.value);
            } else {
                result.push(evalQuasiQuotedValue(f, env));
            }
        }
        return createValue("list", result, form);
    }
    
    var specialForms = {
        "var": evalVar,
        "fn": evalFunc,
        "set!": evalAssign,
        "if": evalIf,
        "quote": evalQuote,
        "quasiquote": evalQuasiQuote
    };
    
    function evalApply(fnf, args, env, form) {
        var tmp = evaluate(fnf, env);
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
        var fn = fnv.value;
        var fnenv = fn.env;
        if (Array.isArray(fn.args)) {
            if (fn.args.length !== argvs.length) {
                error("Argument count mismatch (expected " + fn.args.length + ", received " + argvs.length + ")", form);
            }
            for (var j = 0, m = argvs.length; j < m; j++) {
                fnenv = put(fnenv, fn.args[j], argvs[j]);
            }
        } else {
            fnenv = put(fnenv, fn.args, { type: "list", value: args });
        }
        return { value: evaluateAll(fn.body, fnenv).value, env: env };
    }
    
    function evaluate(form, env) {
        var result = null;
        if (form.type === "literal") {
            result = createValue(form.type, form.value);
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

    return { evaluate: evaluateAll };

});
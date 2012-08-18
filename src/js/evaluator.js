/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util", "syntax"], function (util, syntax) {

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
        if (args[0].type !== "symbol") {
            error("var: invalid identifier '" + args[1] + "'", args[1]);
        }
        var id = args[0].value;
        env = put(env, id, null);
        var tmp = evaluate(args[1], env);
        return { value: tmp.value, env: put(env, id, tmp.value) };
    }
    
    function evalFunc(args, env, form) {
        var result = null;
        if (args.length !== 2) {
            error("fn: bad syntax", form);
        }
        var body = args.slice(1);
        if (args[0].type === "list") {
            var argNames = [];
            var argsList = args[0].value;
            for (var i = 0, l = argsList.length; i < l; i++) {
                if (argsList[i].type !== "symbol") {
                    error("fn: invalid argument definition", argsList[i]);
                }
                argNames[i] = argsList[i].value;
            }
            result = createValue("func", { body: body, args: argNames, env: env }, form);
        } else if (args[0].type === "symbol") {
            result = createValue("func", { body: body, args: args[0].value, env: env }, form);
        } else {
            error("fn: invalid arguments definition", args[0]);
        }
        return { value: result, env: env };
    }
    
    function evalAssign(args, env, form) {
        if (args[0].type !== "symbol") {
            error("set!: invalid identifier '" + args[1] + "'", args[1]);
        }
        var id = args[0].value;
        get(env, id, args[0]);
        return evalVar(args, env, form);
    }  
    
    function evalIf(args, env, form) {
        if (args.length !== 3) {
            error("if: bad syntax", form);
        }
        var tmp = evaluate(args[0], env);
        var testv = tmp.value;
        env = tmp.env;
        if (testv.value) {
            return evaluate(args[1], env, form);
        } else {
            return evaluate(args[2], env, form);
        }
    }
    
    function evalQuote(args, env, form) {
        if (args.length !== 1) {
            error("quote: bad syntax", form);
        }
        return { value: args[0], env: env };
    }
    
    function evalQuasiQuote(args, env, form) {
        if (args.length !== 1) {
            error("quasiquote: bad syntax", form);
        }
        return { value: evalQuasiQuotedValue(args[0], env), env: env };
    }    
    
    function evalQuasiQuotedValue(form, env) {
        if (form.type === "literal" || form.type === "symbol") {
            return createValue(form.type, form.value, form);
        }
        if (checkForm(form, "unquote")) {
            if (form.value.length !== 2) {
                error("unquote: bad syntax", form);
            }
            return evaluate(form.value[1], env).value;
        } else if (checkForm(form, "unquote-splicing")) {
            error("unquote-splicing: not in list", form);
        }
        var result = [];
        for (var i = 0, l = form.value.length; i < l; i++) {
            var f = form.value[i];
            if (checkForm(f, "unquote-splicing")) {
                if (f.value.length !== 2) {
                    error("unquote-splicing: bad syntax", f);
                }
                var v = evalQuasiQuotedValue(evaluate(f.value[1], env).value, env);
                if (v.type !== "list") {
                    error("unquote-splicing: expects argument of type list", f);
                }
                Array.prototype.push.apply(result, v.value);
            } else {
                result.push(evalQuasiQuotedValue(f, env));
            }
        }
        return createValue("list", result, form);
    }
    
    function quasiQuoteScopeError(type) {
        return function () {
            error(type + ": not in quasiquote", arguments[2]);
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
                var syntaxCheck = syntax.checks[car.value];
                if (syntaxCheck) {
                    syntaxCheck(cdr, form);
                }
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
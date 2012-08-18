/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util", "syntax", "javascript"], function (util, syntax, js) {

    "use strict";
    
    var checkForm = util.checkForm;
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
    
    var chrSubst = {
        "-": "_",
        "=": "$eq",
        ">": "$gt",
        "<": "$lt",
        "!": "$excl",
        "?": "$quest",
        "%": "$perc",
        ":": "$colon",
        "&": "$amp",
        "~": "$tilde",
        "*": "$star",
        "+": "$plus",
        "/": "$slash",
        "\\": "$bslash"
    };
    
    function makeJSId(id) {
        /*jshint regexp: false*/
        if (js.allSymbols.hasOwnProperty(id)) {
            return "$" + id;
        }
        var rx = /^[a-z0-9_$]$/gi;
        if (rx.test(id)) {
            return id;
        }
        return id.replace(/[^a-z0-9_$]/g, function (chr) {
            return chrSubst[chr] || error("Don't know how to handle non-JS-safe id character '" + chr + "' yet");
        });
    }
    
    function put(env, id, jsid) {
        jsid = makeJSId(jsid || id);
        if (env.hasOwnProperty(jsid)) {
            var n = 1;
            while (env.hasOwnProperty(jsid + n)) {
                n++;
            }
            jsid += n.toString();
        }
        var result = util.copyProps(env, {});
        result[id] = jsid;
        result[jsid] = jsid;
        return { id: jsid, env: result };
    }
    
    function get(env, id, form) {
        if (env.hasOwnProperty(id)) {
            return env[id];
        } else {
            error("Undefined identifier '" + id + "'", form);
        }
    }
    
    function compileLiteral(form) {
        if (typeof form.value === "string") {
            // TODO: cover line breaks etc. too
            return '"' + form.value.replace(/"/, '\\"') + '"';
        }
        return form.value;
    }
    
    function compileSymbol(form, env) {
        return get(env, form.value, form);
    }
    
    function compileVar(args, env) {
        var tmp = put(env, args[0].value);
        var id = tmp.id;
        tmp = compile(args[1], tmp.env);
        return { value: "var " + id + " = " + tmp.value, env: tmp.env };
    }
    
    function compileFunc(args, env) {
        var result = null, tmp = null;
        var body = args.slice(1);
        if (args[0].type === "list") {
            var argNames = [];
            var argsList = args[0].value;
            var argsEnv = env;
            for (var i = 0, l = argsList.length; i < l; i++) {
                tmp = put(argsEnv, argsList[i].value);
                argNames[i] = tmp.id;
                argsEnv = tmp.env;
            }
            tmp = compileAll(insertReturn(body), argsEnv);
            result = "(function (" + argNames.join(", ") + ") {\n\t" + tmp.value.replace(/\n/g, "\n\t") + "\n})";
        } else if (args[0].type === "symbol") {
            tmp = put(env, args[0].value);
            var restId = tmp.id;
            var restEnv = tmp.env;
            var assn = "var " + restId + " = Array.prototype.slice.call(arguments);";
            tmp = compileAll(insertReturn(body), restEnv);
            result = "(function () {\n\t" + assn + "\n\t" + tmp.value.replace(/\n/g, "\n\t") + "\n})";
        }
        return { value: result, env: env };
    }
    
    function insertReturn(forms) {
        var result = forms.slice(0, forms.length - 2);
        var lastExpr = forms[forms.length - 1];
        if (checkForm(lastExpr, "var")) {
            // if the last expression was a var decl, put it back
            result.push(lastExpr);
            // now make the last expression a reference to that var
            lastExpr = { type: "list", value: [{ type: "symbol", value: "#return" }, lastExpr.value[1]] };
        } else {
            lastExpr = { type: "list", value: [{ type: "symbol", value: "#return" }, lastExpr] };
        }
        result.push(lastExpr);
        return result;
    }
    
    function compileAssign(args, env) {
        var assignee = compileSymbol(args[0], env);
        var tmp = compile(args[1], env);
        return { value: assignee + " = " + tmp.value, env: tmp.env };
    }  
    
    function compileIf(args, env) {
        var tmp = compile(args[0], env);
        var test = tmp.value;
        tmp = compile(args[1], tmp.env);
        var then = tmp.value;
        tmp = compile(args[2], tmp.env);
        var elss = tmp.value;
        return { value: test + " ? " + then + " : " + elss, env: tmp.env };
    }
    
    function compileQuote(args, env) {
        var result = compileQuoteValue(args[0]);
        return { value: result, env: env };
    }
    
    function compileQuoteValue(arg) {
        var result = null;
        if (arg.type === "literal") {
            result = arg.value;
        } else if (arg.type === "symbol") {
            result = "symbol(\"" + arg.value + "\")";
        } else if (arg.type === "list") {
            var items = [];
            for (var i = 0, l = arg.value.length; i < l; i++) {
                items[i] = compileQuoteValue(arg.value[i]);
            }
            result = "[" + items.join(", ") + "]";
        }
        return result;
    }
    
    function compileQuasiQuote(args, env) {
        return compileQuasiQuotedValue(args[0], env);
    }
    
    function compileQuasiQuotedValue(arg, env) {
        var result = null;
        if (arg.type === "literal") {
            result = arg.value;
        } else if (arg.type === "symbol") {
            result = "symbol(\"" + arg.value + "\")";
        } else if (checkForm(arg, "unquote")) {
            return compile(arg.value[1], env);
        } else {
            var outer = [];
            var items = [];
            for (var i = 0, l = arg.value.length; i < l; i++) {
                var f = arg.value[i];
                if (checkForm(f, "unquote-splicing")) {
                    var splice = compile(f.value[1], env);
                    if (splice.value !== "[]") {
                        if (items.length > 0) {
                            outer.push("[" + items.join(", ") + "]");
                            items = [];
                        }
                        outer.push(splice.value);
                    }
                    env = splice.env;
                } else {
                    var tmp = compileQuasiQuotedValue(arg.value[i], env);
                    items.push(tmp.value);
                    env = tmp.env;
                }
            }
            if (items.length > 0) {
                outer.push("[" + items.join(", ") + "]");
            }
            if (outer.length > 1) {
                result = "(" + outer.join(").concat(") + ")";
            } else {
                result = outer[0];
            }
        }
        return { value: result, env: env };
    }
    
    function compileStatement(statement) {
        return function (args, env) {
            var tmp = compile(args[0], env);
            return { value: statement + " " + tmp.value, env: env };
        };
    }
    
    function compileArray(args, env) {
        var tmp = compileAll(args, env);
        return { value: "[" + tmp.value.join(", ") + "]", env: env };
    }    
    
    function importError() {
        error("import: not valid here", arguments[2]);
    }
    
    var specialForms = {
        "var": compileVar,
        "fn": compileFunc,
        "set!": compileAssign,
        "if": compileIf,
        "quote": compileQuote,
        "quasiquote": compileQuasiQuote,
        "import": importError,
        "#return": compileStatement("return"),
        "list": compileArray
    };
    
    function compileApply(fnf, args, env) {
        var tmp = compile(fnf, env);
        var fnv = tmp.value;
        env = tmp.env;
        var argvs = [];
        for (var i = 0, l = args.length; i < l; i++) {
            tmp = compile(args[i], env);
            env = tmp.env;
            argvs[i] = tmp.value;
        }
        return { value: fnv + "(" + argvs.join(", ") + ")", env: env };
    }
    
    function compile(form, env) {
        var result = null;
        if (form.type === "literal") {
            result = compileLiteral(form);
        } else if (form.type === "symbol") {
            result = compileSymbol(form, env);
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
                    return compileApply(car, cdr, env, form);
                }
            }
        }
        return { value: result, env: env };
    }
    
    function compileAll(forms, env) {
        var result = [];
        for (var i = 0, l = forms.length; i < l; i++) {
            var tmp = compile(forms[i], env);
            result[i] = tmp.value;
            env = tmp.env;
        }
        return { value: result.join(";\n") + ";", env: env };
    }
    
    function usesSymbolQuote(form, quoteType) {
        if (quoteType === "quasiquote" && (checkForm(form, "unquote") || checkForm(form, "unquote-splicing"))) {
            return usesSymbolQuote(form);
        }
        if (quoteType === "quote") {
            if (form.type === "symbol") {
                return true;
            }
            if (form.type === "list") {
                return anyUsesSymbolQuote(form.value, quoteType);
            }
        }
        if (quoteType === "quasiquote") {
            if (form.type === "symbol") {
                return true;
            }
            if (form.type === "list") {
                return anyUsesSymbolQuote(form.value, quoteType);
            }
        }
        if (checkForm(form, "quote")) {
            return usesSymbolQuote(form.value[1], "quote");
        }
        if (checkForm(form, "quasiquote")) {
            return usesSymbolQuote(form.value[1], "quasiquote");
        }
        if (form.type === "list") {
            return anyUsesSymbolQuote(form.value);
        }
        return false;
    }
    
    function anyUsesSymbolQuote(forms, quoteType) {
        for (var i = 0, l = forms.length; i < l; i++) {
            if (usesSymbolQuote(forms[i], quoteType)) {
                return true;
            }
        }
        return false;
    }
    
    function compileScript(forms, env) {
        env = env || {};
        var prefix = "";
        if (anyUsesSymbolQuote(forms)) {
            // TODO: this doesn't make the symbol id safe.
            var tmp = put(env, "#symbol", "symbol");
            if (tmp.id !== "symbol") {
                throw new Error("Don't know how to deal with the case where 'symbol' was already reserved in the environment");
            }
            prefix = "var symbol = (function () { var table = {}; return function (id) { return table.hasOwnProperty(id) ? table[id] : table[id] = { toString: function () { return id; } }; }; }());\n";
            env = tmp.env;
        }
        return prefix + compileAll(forms, env).value;
    }
    
    return { compile: compileScript };
    
});
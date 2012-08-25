/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, strict: true*/
/*global define*/
define(["util", "javascript"], function (util, js) {

    "use strict";
    
    var checkForm = util.checkForm;
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
    
    // ------------------------------------------------------------------------
    //  Identifier environment
    // ------------------------------------------------------------------------
    
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
    
    function makeDefaultJSId(id) {
        if (js.allSymbols.hasOwnProperty(id)) {
            return id;
        }
        return makeJSId(id);
    }
    
    function makeJSId(id) {
        /*jshint regexp: false*/
        if (js.allSymbols.hasOwnProperty(id)) {
            return "$" + id;
        }
        var rx = /^[a-z0-9_$]$/gi;
        if (rx.test(id)) {
            return id;
        }
        return id.replace(/[^a-z0-9_$]/gi, function (chr) {
            return chrSubst[chr] || error("Don't know how to handle non-JS-safe id character '" + chr + "' yet");
        });
    }
    
    function isSafeJSPropName(name) {
        return (/^[a-z_$][a-z0-9_$]*$/i).test(name) && 
               !js.keywords.hasOwnProperty(name) && 
               !js.reserved.hasOwnProperty(name);
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
        }
        if (js.values.hasOwnProperty(id)) {
            return js.values[id];
        }
        if (js.functions.hasOwnProperty(id)) {
            return js.functions[id];
        }
        if (js.objects.hasOwnProperty(id)) {
            return js.objects[id];
        }
        if (js.allOperators.hasOwnProperty(id)) {
            return js.allOperators[id];
        }
        return id;
        //error("Undefined identifier '" + id + "'", form);
    }
    
    // ------------------------------------------------------------------------
    //  Atom compilation
    // ------------------------------------------------------------------------
    
    function compileLiteral(form) {
        if (typeof form.value === "string") {
            // TODO: cover line breaks etc. too
            return '"' + form.value + '"';
        }
        return form.value;
    }
    
    function compileSymbol(form, env) {
        return env.hasOwnProperty(form.value) ? get(env, form.value, form)
                                              : makeDefaultJSId(form.value);
    }
    
    // ------------------------------------------------------------------------
    //  Special form compilation
    // ------------------------------------------------------------------------
    
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
            result = "function (" + argNames.join(", ") + ") {\n\t" + tmp.value.replace(/\n/g, "\n\t") + "\n}";
        } else if (args[0].type === "symbol") {
            tmp = put(env, args[0].value);
            var restId = tmp.id;
            var restEnv = tmp.env;
            var assn = "var " + restId + " = Array.prototype.slice.call(arguments);";
            tmp = compileAll(insertReturn(body), restEnv);
            result = "function () {\n\t" + assn + "\n\t" + tmp.value.replace(/\n/g, "\n\t") + "\n}";
        }
        return { value: result, env: env };
    }
    
    function compileObj(args, env) {
        var entries = [];
        for (var i = 0, l = args.length; i < l; i++) {
            var arg = args[i];
            var key = arg.value[0].value;
            if (!isSafeJSPropName(key)) {
                key = '"' + key + '"';
            }
            var tmp = compile(arg.value[1], env);
            env = tmp.env;
            entries[i] = key + ": " + tmp.value;
        }
        return { value: "({ " + entries.join(", ") + " })", env: env };
    }
    
    function compileProp(args, env) {
        var tmp = compile(args[0], env);
        var obj = tmp.value;
        var prop = args[1].value;
        if (args[1].type === "literal" && isSafeJSPropName(prop)) {
            return { value: obj + "." + prop, env: tmp.env };
        } else {
            tmp = compile(args[1], tmp.env);
            prop = tmp.value;
            return { value: obj + "[" + prop + "]", env: tmp.env };
        }
    }
    
    function insertReturn(forms) {
        var result = forms.slice(0, forms.length - 1);
        var lastExpr = forms[forms.length - 1];
        if (checkForm(lastExpr, "var")) {
            // if the last expression was a var decl, put it back
            result.push(lastExpr);
            // now make the last expression a reference to that var
            lastExpr = { type: "list", value: [{ type: "symbol", value: "#return" }, lastExpr.value[1]] };
        } else if (checkForm(lastExpr, "error")) {
            // do nothing, returning a throw is nonsense
            lastExpr = lastExpr;
        } else if (checkForm(lastExpr, "try")) {
            var sym = lastExpr.value[0];
            var cc = lastExpr.value[2];
            var catchClause = util.createForm("list", cc.value.slice(0, 2).concat(insertReturn(cc.value.slice(2))));
            lastExpr = util.createForm("list", [sym, insertReturn([lastExpr.value[1]])[0], catchClause]);
        } else {
            lastExpr = { type: "list", value: [{ type: "symbol", value: "#return" }, lastExpr] };
        }
        result.push(lastExpr);
        return result;
    }
    
    function compileAssign(args, env, form) {
        var assignee;
        if (args[0].type === "list") {
            var obj = compile(args[0], env);
            assignee = obj.value;
        } else {
            assignee = compileSymbol(args[0], env);
        }
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
            result = compileLiteral(arg);
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
            result = compileLiteral(arg);
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
    
    function compileError(args, env, form) {
        var values = [];
        for (var i = 0, l = args.length; i < l; i++) {
            var tmp = compile(args[i], env);
            values[i] = tmp.value;
            env = tmp.env;
        }
        return { value: "throw new Error(" + values.join(" + ") + ")", env: env };
    }
    
    function compileTry(args, env, form) {
        var tmp = compile(args[0], env);
        var tryExpr = tmp.value;
        env = tmp.env;
        var ename = compile(args[1].value[1], env).value;
        var catchExpr = compile(args[1].value[2], env).value;
        return { value: "try {\n\t" + tryExpr + "\n\t} catch (" + ename + ") {\n\t" + catchExpr + "\n\t}", env: env };
    }
    
    // ------------------------------------------------------------------------
    //  Quoted symbol usage detection
    // ------------------------------------------------------------------------
    
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
    
    // ------------------------------------------------------------------------
    //  Main
    // ------------------------------------------------------------------------
    
    var specialForms = {
        "var": compileVar,
        "fn": compileFunc,
        "obj": compileObj,
        ".": compileProp,
        "set!": compileAssign,
        "if": compileIf,
        "quote": compileQuote,
        "quasiquote": compileQuasiQuote,
        "#return": compileStatement("return"),
        "error": compileError,
        "try": compileTry
    };
    
    function addParen(value) {
        if (typeof value !== "string" ||
            value.indexOf(" ") === -1 ||
            value.charAt(0) === "\"" ||
            value.charAt(0) === "[" ||
            value.charAt(0) === "{" ||
            value.charAt(0) === "(" ||
            value.charAt(value.length - 1) === ")") {
            return value;
        }
        return "(" + value + ")";
    }
    
    function compileApply(fnf, args, env) {
        if (fnf.type === "symbol" && fnf.value.charAt(0) === ".") {
            var obj = compile(args[0], env);
            return { value: addParen(obj.value) + fnf.value, env: env };
        }
        var tmp = compile(fnf, env);
        var fnv = tmp.value;
        if (fnf.type === "symbol" && js.prefixOps.hasOwnProperty(fnv) && args.length === 1) {
            var x0 = compile(args[0], env);
            env = x0.env;
            return { value: fnv + addParen(x0.value), env: env };
        }
        if (fnf.type === "symbol" && js.infixOps.hasOwnProperty(fnv)) {
            var x = compile(args[0], env);
            env = x.env;
            var y = compile(args[1], env);
            env = y.env;
            return { value: addParen(x.value) + " " + fnv + " " + addParen(y.value), env: env };
        }
        env = tmp.env;
        var argvs = [];
        for (var i = 0, l = args.length; i < l; i++) {
            tmp = compile(args[i], env);
            env = tmp.env;
            argvs[i] = tmp.value;
        }
        return { value: addParen(fnv) + "(" + argvs.join(", ") + ")", env: env };
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
    
    function compileScript(forms, env) {
        env = env || {
            "not": "!",
            "eqv?": "==",
            "eq?": "===",
            "not-eq?": "!==",
            "not-eqv?": "!="
        };
        var prefix = "";
        if (anyUsesSymbolQuote(forms)) {
            // TODO: this doesn't make the symbol id safe.
            var tmp = put(env, "#symbol", "symbol");
            if (tmp.id !== "symbol") {
                throw new Error("Don't know how to deal with the case where 'symbol' was already reserved in the environment");
            }
            prefix = "var symbol = (function () { var table = {}; return function (id) { return table.hasOwnProperty(id) ? table[id] : table[id] = { isSymbol: true, toString: function () { return id; } }; }; }());\n";
            env = tmp.env;
        }
        return prefix + compileAll(forms, env).value;
    }
    
    return { compile: compileScript };
    
});
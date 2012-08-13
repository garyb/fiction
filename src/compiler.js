/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util"], function (util) {

    "use strict";
    
    function error(msg, form) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printRawForm(form));
    }
    
    function compileLiteral(form) {
        if (typeof form.value === "string") {
            return '"' + form.value.replace(/"/, '\\"') + '"';
        }
        return form.value;
    }
    
    function compileSymbol(form) {
        return form.value;
    }
    
    function compileVar(args) {
        if (args[0].type !== "symbol") {
            error("var: invalid identifier '" + args[1] + "'", args[1]);
        }
        return "var " + compileSymbol(args[0]) + " = " + compile(args[1]);
    }
    
    function compileFunc(args, form) {
        
    }
    
    function compileAssign(args, form) {
        if (args[0].type !== "symbol") {
            error("set!: invalid identifier '" + args[1] + "'", args[1]);
        }
        return compileSymbol(args[0]) + " = " + compile(args[1]);
    }  
    
    function compileIf(args, form) {
        if (args.length !== 3) {
            error("if: bad syntax", form);
        }
        return compile(args[0]) + " ? " + compile(args[1]) + " : " + compile(args[2]);
    }
    
    function compileQuote(args, form) {
    
    }
    
    function compileQuasiQuote(args, form) {

    }
    
    function compileQuasiQuotedValue(form) {

    }
    
    function quasiQuoteScopeError(type) {
        return function () {
            error(type + ": not in quasiquote", arguments[2]);
        };
    }
    
    var specialForms = {
        "var": compileVar,
        "fn": compileFunc,
        "set!": compileAssign,
        "if": compileIf,
        "quote": compileQuote,
        "quasiquote": compileQuasiQuote,
        "unquote": quasiQuoteScopeError("unquote"),
        "unquote-splicing": quasiQuoteScopeError("unquote-splicing")
    };
    
    function compileApply(fnf, args, form) {
        var fnv = compile(fnf);
        var argvs = [];
        for (var i = 0, l = args.length; i < l; i++) {
            argvs[i] = compile(args[i], "");
        }
        return fnv + "(" + argvs.join(", ") + ")";
    }
    
    function compile(form) {
        var result = null;
        if (form.type === "literal") {
            result = compileLiteral(form);
        } else if (form.type === "symbol") {
            result = compileSymbol(form);
        } else if (form.type === "list") {
            if (form.value.length === 0) {
                error("Empty application", form);
            } else {
                var car = form.value[0];
                var cdr = form.value.slice(1);
                var sf = car.type === "symbol" ? specialForms[car.value] : null;
                if (sf) {
                    return sf(cdr, form);
                } else {
                    return compileApply(car, cdr, form);
                }
            }
        }
        return result;
    }
    
    function compileAll(forms) {
        var result = [];
        for (var i = 0, l = forms.length; i < forms.length; i++) {
            result[i] = compile(forms[i]) + ";";
        }
        return result.join("\n");
    }
    
    return {
        compile: compileAll
    };
    
});
/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util"], function (util) {

    "use strict";

    function error(msg, expr) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printPretty(expr));
    }

    /**
     * Checks whether `expr` is a valid non-object-property id.
     */
    function isStandardId(expr) {
        return expr.type === "symbol" && expr.value.charAt(0) !== ".";
    }

    /**
     * Checks whether `expr` is a valid object property - an expression of the
     * form `(.name expr)` where `.name` is any symbol starting with `.` and
     * `expr` is any valid expression.
     */
    function isProp(expr) {
        if (expr.type === "list" && expr.value.length === 2) {
            var prop = expr.value[0];
            if (prop.type === "symbol" && prop.value.charAt(0) === ".") {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `import`. The valid form for `import` is `(import name ...)` 
     * where `name ...` is a list of non-empty string literals. The full version
     * of the form being checked is provided as `expr` for use in error 
     * messages.
     */
    function checkImport(atoms, expr) {
        if (atoms.length === 0) {
            error("import: bad syntax - empty expression", expr);
        }
        for (var i = 0, l = atoms.length; i < l; i++) {
            var name = atoms[i];
            if (name.type !== "literal" || (typeof name.value !== "string")) {
                error("import: invalid import name, should be a string", name);
            }
            if (name.value.length === 0) {
                error("import: invalid import name, empty string", name);
            }
        }
    }
    
    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `var`. The valid form for `var` is `(var id value)` where `id`
     * is any symbol not starting with `.`, and `value` is any valid
     * expression. The full version of the form being checked is provided as
     * `expr` for use in error messages.
     */
    function checkVar(atoms, expr) {
        if (atoms.length === 0) {
            error("var: bad syntax - empty expression", expr);
        }
        if (atoms.length === 1) {
            error("var: no value specified", expr);
        }
        if (atoms.length > 2) {
            error("var: expects 2 arguments", expr);
        }
        if (!isStandardId(atoms[0])) {
            error("var: invalid identifier", atoms[0]);
        }
    }

    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `fn`. The valid form for `fn` is `(fn (args ...) body ...)` or
     * `(fn rest body ...)` where `args ...` is a list of symbols not starting
     * with `.`, `rest` is a symbol not starting with `.` and `body ...` is a
     * list of any valid expressions. The full version of the form being checked
     * is provided as `expr` for use  in error messages.
     */
    function checkFunction(atoms, expr) {
        if (atoms.length === 0) {
            error("fn: empty expression", expr);
        }
        if (atoms.length === 1) {
            error("fn: no body specified", expr);
        }
        var args = atoms[0];
        if (args.type === "list") {
            for (var i = 0, l = args.value.length; i < l; i++) {
                var arg = args.value[i];
                if (!isStandardId(arg)) {
                    error("fn: invalid argument identifier", arg);
                }
            }
        } else if (!isStandardId(args)) {
            error("fn: invalid argument identifier", args);
        }
    }

    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `set!`. The valid form for `set!` is `(set! assignee value)`
     * where `assignee` is an object property or a symbol not starting with `.`,
     * and `value` is any valid expressions. The full version of the form being
     * checked is provided as `expr` for use  in error messages.
     */
    function checkAssign(atoms, expr) {
        if (atoms.length === 0) {
            error("set!: empty expression", expr);
        }
        if (atoms.length === 1) {
            error("set!: no value specified", expr);
        }
        if (atoms.length > 2) {
            error("set!: too many arguments", expr);
        }
        if (!isStandardId(atoms[0]) && !isProp(atoms[0])) {
            error("set!: invalid assignee", atoms[0]);
        }
    }

    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `if`. The valid form for `if` is `(if test then else)`
     * where `test`, `then`, and `else` are valid expressions. The full version 
     * of the form being checked is provided as `expr` for use in error  
     * messages.
     */
    function checkIf(atoms, expr) {
        if (atoms.length === 0) {
            error("if: empty expression", expr);
        }
        if (atoms.length === 1) {
            error("if: no then and else clauses", expr);
        }
        if (atoms.length === 2) {
            error("if: no else clause", expr);
        }
    }

    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `quote`. The valid form for `if` is `(quote datum)`
     * where `datum` is any s-expression. The full version of the form being 
     * checked is provided as `expr` for use in error messages.
     */
    function checkQuote(atoms, expr) {
        if (atoms.length === 0) {
            error("quote: empty expression", expr);
        }
        if (atoms.length > 1) {
            error("quote: too many arguments", expr);
        }
    }
    
    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `quasiquote`. The valid form for `quasiquote` is 
     * `(quasiquote datum)` where `datum` is any s-expression. The syntax of any
     * `unquote` or `unquote-splicing` forms within datum are also checked, 
     * although the unquoted expressions are not. The full version of the form 
     * being checked is provided as `expr` for use in error messages.
     */
    function checkQuasiQuote(atoms, expr) {
        if (atoms.length === 0) {
            error("quasiquote: empty expression", expr);
        }
        if (atoms.length > 1) {
            error("quasiquote: too many arguments", expr);
        }
        checkQuasiQuoteValue(atoms[0]);
    }
    
    /**
     * Checks `datum` for uses of `unquote` and `unquote-splicing` to ensure 
     * they are of the correct form - `(unquote expr)` or 
     * `(unquote-splicing expr)` where `expr` is any valid expression.
     */
    function checkQuasiQuoteValue(datum) {
        if (datum.type === "list" && datum.value.length > 0) {
            var car = datum.value[0];
            if (car.type === "symbol") {
                if (car.value === "unquote") {
                    if (datum.value.length === 1) {
                        error("unquote: empty expression", datum);
                    }
                    if (datum.value.length > 2) {
                        error("unquote: too many arguments", datum);
                    }
                } else if (car.value === "unquote-splicing") {
                    error("unquote-splicing: not in list", datum);
                }
            }
            for (var i = 0, l = datum.value.length; i < l; i++) {
                var f = datum.value[i];
                if (util.checkForm(f, "unquote-splicing")) {
                    if (f.value.length === 1) {
                        error("unquote-splicing: empty expression", f);
                    }
                    if (f.value.length > 2) {
                        error("unquote-splicing: too many arguments", f);
                    }
                } else {
                    checkQuasiQuoteValue(datum.value[i]);
                }
            }
        }
    }
    
    /**
     * Rasises an error for primitive form of `type` because it should only 
     * appear inside a quasiquote.
     */
    function quasiQuoteError(type) {
        return function () {
            error(type + ": not in quasiquote", arguments[1]);
        };
    }
    
    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `define-syntax`. The valid form for `define-syntax` is 
     * `(define-syntax id transformer)` where `id` is a symbol and transformer 
     * is a `syntax-rules` expression. The full version of the form 
     * being checked is provided as `expr` for use in error messages.
     */
    function checkDefineSyntax(atoms, expr) {
        if (atoms.length === 0) {
            error("define-syntax: empty expression", expr);
        }
        if (atoms.length === 1) {
            error("define-syntax: missing transformer definition", expr);
        }
        if (atoms.length > 2) {
            error("define-syntax: too many arguments", expr);
        }
        if (!util.checkForm(atoms[1], "syntax-rules")) {
            error("define-syntax: transformer should be a `syntax-rules` form");
        }
    }
    
    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `syntax-rules`. The valid form for `syntax-rules` is 
     * `(syntax-rules (reserved ...) ((pattern template) ...)` where 
     * `reserved ...` is a list of symbols, `pattern` is a list starting with a
     * symbol, and `template` is any s-expression. The full version of the form 
     * being checked is provided as `expr` for use in error messages.
     */
    function checkSyntaxRules(atoms, expr) {
        if (atoms.length === 0) {
            error("syntax-rules: empty expression", expr);
        }
        if (atoms.length === 1) {
            error("syntax-rules: missing pattern and template definitions", expr);
        }
        if (atoms.length > 2) {
            error("syntax-rules: too many arguments", expr);
        }
        var symbols = atoms[0];
        if (symbols.type !== "list") {
            error("syntax-rules: invalid reserved symbol list", symbols);
            for (var i = 0, l = symbols.value.length; i < l; i++) {
                if (symbols.value[i].type !== "symbol") {
                    error("syntax-rules: invalid reserved symbol", symbols.value[i]);
                }
            }
        }
        var rules = atoms.slice(1);
        if (rules.length === 0) {
            error("syntax-rules: empty rules list", rules);
        }
        for (var j = 0, m = rules.length; j < m; j++) {
            var rule = rules[j];
            if (rule.type !== "list") {
                error("syntax-rules: invalid rule", rule);
            }
            if (rule.value.length === 0) {
                error("syntax-rules: empty rule", rule);
            }
            if (rule.value.length === 1) {
                error("syntax-rules: rule missing template definition", rule);
            }
            if (rule.value.length > 2) {
                error("syntax-rules: rule has too many arguments", rule);
            }
            if (rule.value[0].type !== "list") {
                error("syntax-rules: pattern should be a list expression", rule.value[0]);
            }
            if (rule.value[0].value[0].type !== "symbol") {
                error("syntax-rules: pattern should start with an identifier", rule.value[0]);
            }
        }
    }

    return {
        checks: {
            "import": checkImport,
            "var": checkVar,
            "fn": checkFunction,
            "set!": checkAssign,
            "if": checkIf,
            "quote": checkQuote,
            "quasiquote": checkQuasiQuote,
            "unquote": quasiQuoteError("unquote"),
            "unquote-splicing": quasiQuoteError("unquote-splicing"),
            "define-syntax": checkDefineSyntax,
            "syntax-rules": checkSyntaxRules
        }
    };
});
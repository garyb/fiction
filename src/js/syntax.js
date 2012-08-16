/*jshint bitwise: true, camelcase: true, curly: true, eqeqeq: true, forin: true, immed: true, indent: 4, latedef: true, newcap: true, noarg: true, noempty: true, nonew: true, regexp: true, undef: true, unused: true, strict: true*/
/*global define*/
define(["util"], function (util) {

    "use strict";

    function error(msg, expr) {
        // TODO: add line/char details to forms for better errors
        throw new Error(msg + " @ " + util.printPrettyForm(expr));
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
     * primitive `var`. The valid form for `var` is `(var id value)` where `id`
     * is any symbol not starting with `.`, and `value` is any valid
     * expression. The full version of the form being checked is provided as
     * `expr` for use in error messages.
     */
    function checkVar(atoms, expr) {
        if (atoms.length === 0) {
            error("var: bad syntax - empty declaration", expr);
        }
        if (atoms.length === 1) {
            error("var: bad syntax - no value specified", expr);
        }
        if (atoms.length > 2) {
            error("var: bad syntax - expects 2 arguments", expr);
        }
        if (!isStandardId(atoms[0])) {
            error("var: bad syntax - invalid identifier", atoms[0]);
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
            error("fn: bad syntax - empty declaration", expr);
        }
        if (atoms.length === 1) {
            error("fn: bad syntax - missing arguments or body", expr);
        }
        var args = atoms[0];
        if (args.type === "list") {
            for (var i = 0, l = args.value.length; i < l; i++) {
                var arg = args.value[i];
                if (!isStandardId(arg)) {
                    error("fn: bad syntax - invalid argument identifier", arg);
                }
            }
        } else if (!isStandardId(args)) {
            error("fn: bad syntax - invalid argument identifier", args);
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
            error("set!: bad syntax - empty assignment", expr);
        }
        if (atoms.length === 1) {
            error("set!: bad syntax - missing value", expr);
        }
        if (atoms.length > 2) {
            error("set!: bad syntax - too many arguments", expr);
        }
        if (!isStandardId(atoms[0]) && !isProp(atoms[0])) {
            error("set!: bad syntax - invalid assignee", atoms[0]);
        }
    }

    /**
     * Checks whether `atoms` are valid values for an application of the
     * primitive `if`. `expr` is the full version of the form being checked, for
     * use in error messages.
     */
    function checkIf(atoms, expr) {
        if (atoms.length === 0) {
            error("if: bad syntax - empty expression", expr);
        }
        if (atoms.length === 1) {
            error("if: bad syntax - missing then and else clauses", expr);
        }
        if (atoms.length === 2) {
            error("if: bad syntax - missing else clause", expr);
        }
    }

    /**
     * Creates a function that checks whether `atoms` are valid values for an
     * application of the primitive `type`, that only expects one argument.
     * `expr` is the full version of the form being checked, for use in error
     * messages.
     */
    function checkUnaryExpr(type) {
        return function (atoms, expr) {
            if (atoms.length === 0) {
                error(type + ": bad syntax - empty expression", expr);
            }
            if (atoms.length > 1) {
                error(type + ": bad syntax - too many arguments", expr);
            }
        };
    }

    return {
        checks: {
            "var": checkVar,
            "fn": checkFunction,
            "set!": checkAssign,
            "if": checkIf,
            "quote": checkUnaryExpr("quote"),
            "quasiquote": checkUnaryExpr("quasiquote"),
            "unquote": checkUnaryExpr("unquote"),
            "unquote-splicing": checkUnaryExpr("unquote-splicing")
        }
    };
});